
"""Calculo de progreso de una meta (Goal).

El progreso NO se almacena: se calcula al vuelo sumando las transacciones del
usuario dentro del periodo de la meta (mismo enfoque que services/wallets.py y
el endpoint /transactions/summary). La meta solo persiste su definicion y su
status de negocio; el numero de avance siempre se deriva de las transacciones.
"""
from uuid import UUID
from datetime import datetime, date
from typing import Optional

from sqlmodel import Session, select

from app.models.goals import Goal, GoalType, GoalStatus
from app.models.transactions import Transaction, TransactionType
from app.models.transactions_wallets import TransactionWallet
from app.models.notifications import NotificationType
from app.services.notifications import create_notification


def _sum_transactions(goal: Goal, session: Session) -> dict:
    """Suma income/expense de las transacciones activas del usuario dentro del
    periodo de la meta, respetando el scope opcional por wallet y categoria."""
    query = select(Transaction).where(
        Transaction.user_id == goal.user_id,
        Transaction.is_active == True,
        Transaction.date >= goal.start_date,
        Transaction.date <= goal.end_date,
    )

    if goal.category_id is not None:
        query = query.where(Transaction.category_id == goal.category_id)

    if goal.wallet_id is not None:
        # Filtra por asociacion a la wallet via la tabla join (manual o por regla),
        # igual que GET /transactions cuando recibe wallet_id.
        query = (
            query
            .join(TransactionWallet, TransactionWallet.transaction_id == Transaction.id)
            .where(TransactionWallet.wallet_id == goal.wallet_id)
            .distinct()
        )

    results = session.exec(query).all()
    total_income = sum(t.amount for t in results if t.type == TransactionType.INCOME)
    total_expenses = sum(t.amount for t in results if t.type == TransactionType.EXPENSE)
    return {"income": total_income, "expenses": total_expenses}


def compute_goal_progress(goal: Goal, session: Session) -> dict:
    """Devuelve current_amount, remaining, percentage e is_on_track segun el tipo.

    - income:        current = ingresos; on_track si current >= target.
    - expense_limit: current = gastos;   on_track si current <= target (aun por debajo del tope).
    - savings:       current = ingresos - gastos; on_track si current >= target.
    """
    sums = _sum_transactions(goal, session)
    target = float(goal.target_amount)

    if goal.goal_type == GoalType.EXPENSE_LIMIT:
        current = float(sums["expenses"])
        # En un presupuesto, "on_track" = todavia no se rebaso el tope.
        is_on_track = current <= target
    elif goal.goal_type == GoalType.SAVINGS:
        current = float(sums["income"] - sums["expenses"])
        is_on_track = current >= target
    else:  # GoalType.INCOME
        current = float(sums["income"])
        is_on_track = current >= target

    remaining = target - current
    percentage = (current / target * 100.0) if target else 0.0

    return {
        "current_amount": current,
        "remaining": remaining,
        "percentage": percentage,
        "is_on_track": is_on_track,
    }


def _money(amount: float) -> str:
    return f"${amount:,.2f}"


def _as_date(value) -> date:
    """Normaliza start_date/end_date (declarados datetime, columna Date) a date."""
    return value.date() if isinstance(value, datetime) else value


def _flag_goal(goal: Goal, status: GoalStatus, notif_type: NotificationType,
               title: str, message: str, session: Session) -> None:
    """Cambia el status de la meta y encola la notificacion (sin commit)."""
    goal.status = status
    goal.updated_at = datetime.now()
    session.add(goal)
    create_notification(
        session,
        user_id=goal.user_id,
        type=notif_type,
        title=title,
        message=message,
        entity_type="goal",
        entity_id=goal.id,
        commit=False,
    )


def evaluate_goal_completions(user_id: UUID, session: Session) -> None:
    """Tiempo real: tras escribir una transaccion, revisa las metas ACTIVAS del
    usuario y marca las que acaban de cruzar su condicion "durante el periodo":

    - income / savings: current >= target  -> ACHIEVED (GOAL_ACHIEVED)
    - expense_limit:     current  > target  -> FAILED   (GOAL_EXCEEDED)

    El caso "termino el periodo sin cumplir" (income/savings) y "se respeto el
    presupuesto" (expense_limit) NO se detectan aqui: dependen del end_date y los
    resuelve flag_expired_goals() en el login.

    La deduplicacion sale gratis: al pasar status a ACHIEVED/FAILED, la meta deja
    de ser ACTIVE y no vuelve a evaluarse.
    """
    active_goals = session.exec(
        select(Goal).where(
            Goal.user_id == user_id,
            Goal.is_active == True,
            Goal.status == GoalStatus.ACTIVE,
        )
    ).all()

    changed = False
    for goal in active_goals:
        progress = compute_goal_progress(goal, session)
        current = progress["current_amount"]
        target = float(goal.target_amount)

        if goal.goal_type == GoalType.EXPENSE_LIMIT:
            if current > target:
                _flag_goal(
                    goal, GoalStatus.FAILED, NotificationType.GOAL_EXCEEDED,
                    "Límite de gasto rebasado",
                    f'Rebasaste el presupuesto de "{goal.name}": '
                    f"{_money(current)} de {_money(target)}.",
                    session,
                )
                changed = True
        else:  # INCOME / SAVINGS
            if current >= target:
                _flag_goal(
                    goal, GoalStatus.ACHIEVED, NotificationType.GOAL_ACHIEVED,
                    "¡Meta cumplida!",
                    f'Alcanzaste tu meta "{goal.name}": '
                    f"{_money(current)} de {_money(target)}.",
                    session,
                )
                changed = True

    if changed:
        session.commit()


def flag_expired_goals(user_id: UUID, session: Session) -> None:
    """Login: resuelve el desenlace de las metas ACTIVAS cuyo periodo ya termino
    (end_date < hoy). Este es el detonante time-based que ninguna escritura de
    transaccion provoca:

    - income / savings: current >= target -> ACHIEVED, si no -> FAILED (GOAL_FAILED)
    - expense_limit:    current <= target -> ACHIEVED (se respeto el presupuesto);
      si estuviera por encima ya se habria marcado FAILED en tiempo real.
    """
    today = date.today()
    active_goals = session.exec(
        select(Goal).where(
            Goal.user_id == user_id,
            Goal.is_active == True,
            Goal.status == GoalStatus.ACTIVE,
        )
    ).all()

    changed = False
    for goal in active_goals:
        if _as_date(goal.end_date) >= today:
            continue  # sigue en curso

        progress = compute_goal_progress(goal, session)
        current = progress["current_amount"]
        target = float(goal.target_amount)

        if goal.goal_type == GoalType.EXPENSE_LIMIT:
            _flag_goal(
                goal, GoalStatus.ACHIEVED, NotificationType.GOAL_ACHIEVED,
                "Presupuesto respetado",
                f'Cerraste "{goal.name}" sin rebasar el límite: '
                f"{_money(current)} de {_money(target)}.",
                session,
            )
            changed = True
        else:  # INCOME / SAVINGS
            if current >= target:
                _flag_goal(
                    goal, GoalStatus.ACHIEVED, NotificationType.GOAL_ACHIEVED,
                    "¡Meta cumplida!",
                    f'Cerraste tu meta "{goal.name}" alcanzando '
                    f"{_money(current)} de {_money(target)}.",
                    session,
                )
            else:
                _flag_goal(
                    goal, GoalStatus.FAILED, NotificationType.GOAL_FAILED,
                    "Meta no cumplida",
                    f'Terminó el periodo de "{goal.name}" sin alcanzar la meta: '
                    f"{_money(current)} de {_money(target)}.",
                    session,
                )
        changed = True

    if changed:
        session.commit()
