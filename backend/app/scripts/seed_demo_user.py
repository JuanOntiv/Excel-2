"""
Crea UN usuario de demo completo (>= 100 transacciones) escribiendo directo a
la BD, y al final imprime sus credenciales de acceso.

Es la versión "de BD" del script `backend/seed_demo_user.py` (que hace lo mismo
vía HTTP contra la API). Se invoca igual que el resto de scripts del proyecto:

    python -m app.scripts.seed_demo_user
    DATABASE_URL="postgresql://…" python -m app.scripts.seed_demo_user
    python -m app.scripts.seed_demo_user --transactions 250 --mail juan@x.test

Escribir directo NO significa saltarse la lógica de negocio: este script llama a
los mismos servicios que llaman las rutas — `create_default_wallet`,
`assign_wallets_for_transaction`, `recalculate_assignments_for_rule`,
`evaluate_goal_completions`, `flag_expired_goals`, `create_notification`,
`hash_password` — para que el estado derivado (asignaciones de wallet por regla,
status de metas, notificaciones) quede exactamente igual que si el usuario
hubiera hecho todo desde la app. Lo único que queda fuera son las validaciones
de las rutas (que la categoría cuadre con el tipo, que la wallet sea tuya), que
aquí no aplican porque el script controla sus propios datos.

Qué crea:
  - Categorías: reutiliza las GLOBALES existentes (user_id = null) y crea propias.
    Si no hay globales, las crea como propias y lo avisa (corre antes
    `python -m app.scripts.seed_categories` para tenerlas).
  - Preferencias de categoría: colores custom (incluida una global) y una oculta.
  - Wallets: 5 propias + la default que crea el registro.
  - Wallet rules: los 5 rule_type.
  - Transacciones: >= 100 (por defecto 140) repartidas en ~15 meses, ingresos y
    gastos, con y sin descripción, con y sin asignación manual de wallet.
  - Metas: los 3 goal_type, con y sin scope, en periodos pasado/actual/futuro,
    más una cancelada. Terminan repartidas en los 4 status.
  - Recurrentes: las 5 frecuencias, ambos tipos, auto_execute mixto, una pausada,
    y se ejecutan las vencidas igual que hace execute-pending en el login.
"""
import argparse
import random
import sys
from datetime import date, timedelta

from sqlmodel import Session, select

# Importar el paquete completo registra todos los modelos en el mapper de
# SQLModel; sin esto, resolver las relaciones falla (ver seed_categories).
import app.models  # noqa: F401
from app.db.db import engine
from app.models.categories import Category, CategoryType
from app.models.goals import Goal, GoalStatus, GoalType
from app.models.notifications import NotificationType
from app.models.recurring_transactions import (
    RecurringTransaction,
    RecurringTransactionFrequency,
    RecurringTransactionStatus,
    RecurringTransactionType,
)
from app.models.transactions import Transaction, TransactionType
from app.models.transactions_wallets import AssignmentType, TransactionWallet
from app.models.user_category_preferences import UserCategoryPreference
from app.models.users import User
from app.models.wallet_rules import WalletRule, WalletRuleTransactionType, WalletRuleType
from app.models.wallets import Wallet
from app.routes.recurring_transactions import _advance_date
from app.services.goals import (
    compute_goal_progress,
    evaluate_goal_completions,
    flag_expired_goals,
)
from app.services.notifications import create_notification
from app.services.wallet_assignment import (
    assign_wallets_for_transaction,
    recalculate_assignments_for_rule,
)
from app.services.wallets import create_default_wallet
from app.utils.password import hash_password, validate_password_strength

TODAY = date.today()


# --------------------------------------------------------------------------
# Helpers de fechas
# --------------------------------------------------------------------------
def months_ago(n):
    """Primer día del mes n meses atrás."""
    month, year = TODAY.month - n, TODAY.year
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1)


def month_iter(start, end):
    """Itera (year, month) desde `start` hasta `end`, ambos inclusive."""
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        yield y, m
        m += 1
        if m > 12:
            m, y = 1, y + 1


def day_in_month(year, month, day):
    """Fecha segura dentro del mes, recortada a hoy si cae en el futuro."""
    for candidate in range(day, 0, -1):
        try:
            d = date(year, month, candidate)
            break
        except ValueError:
            continue
    return min(d, TODAY)


# --------------------------------------------------------------------------
# Catálogo de datos de demo
# --------------------------------------------------------------------------
OWN_CATEGORIES = [
    ("Mascotas", CategoryType.EXPENSE),
    ("Suscripciones", CategoryType.EXPENSE),
    ("Regalos", CategoryType.BOTH),
    ("Café de especialidad", CategoryType.EXPENSE),
    ("Ingresos varios", CategoryType.INCOME),
    ("Categoría archivada (demo)", CategoryType.EXPENSE),  # se oculta vía preferencias
]

# (nombre, categoría, rango de monto). Los nombres que existen en el seed global
# se resuelven contra las globales; el resto son propias. Ver resolve_category().
EXPENSE_TEMPLATES = [
    ("Súper de la semana", "Comida", (450, 1600)),
    ("Comida rápida", "Comida", (90, 340)),
    ("Restaurante con amigos", "Comida", (250, 900)),
    ("Uber al trabajo", "Transporte", (60, 260)),
    ("Uber nocturno", "Transporte", (90, 400)),
    ("Gasolina", "Transporte", (500, 1300)),
    ("Recarga de transporte público", "Transporte", (50, 220)),
    ("Recibo de luz (CFE)", "Servicios", (380, 1400)),
    ("Internet", "Servicios", (450, 700)),
    ("Agua", "Servicios", (150, 420)),
    ("Teléfono", "Servicios", (200, 600)),
    ("Netflix", "Suscripciones", (219, 299)),
    ("Spotify", "Suscripciones", (115, 199)),
    ("Cine", "Entretenimiento", (120, 420)),
    ("Concierto", "Entretenimiento", (600, 2800)),
    ("Videojuego", "Entretenimiento", (300, 1500)),
    ("Consulta médica", "Salud", (500, 1800)),
    ("Farmacia", "Salud", (90, 700)),
    ("Curso en línea", "Educación", (300, 2500)),
    ("Libros", "Educación", (180, 900)),
    ("Ropa", "Vestimenta", (300, 2200)),
    ("Tenis nuevos", "Vestimenta", (900, 3200)),
    ("Vuelo", "Viajes", (1800, 7500)),
    ("Hotel", "Viajes", (1200, 5000)),
    ("Croquetas y veterinario", "Mascotas", (300, 2000)),
    ("Café de especialidad", "Café de especialidad", (60, 180)),
    ("Regalo de cumpleaños", "Regalos", (200, 1500)),
    ("Artículos de limpieza", "Vivienda", (120, 520)),
    ("Reparación menor", "Vivienda", (200, 1800)),
    ("Gasto varios", "Otro gasto", (80, 900)),
]

INCOME_TEMPLATES = [
    ("Proyecto freelance", "Freelance", (2500, 9000)),
    ("Anticipo de cliente", "Freelance", (1500, 5000)),
    ("Dividendos", "Inversiones", (300, 2500)),
    ("Venta de garaje", "Ingresos varios", (300, 1900)),
    ("Reembolso", "Otro ingreso", (200, 1500)),
    ("Bono", "Salario", (2000, 8000)),
]


# --------------------------------------------------------------------------
# Seeding
# --------------------------------------------------------------------------
def _free_mail(session, mail):
    """Devuelve `mail` si está libre; si no, demo2@, demo3@… Se busca un usuario
    NUEVO a propósito: sembrar encima de uno ya poblado duplicaría categorías,
    wallets y reglas."""
    local, _, domain = mail.partition("@")
    for attempt in range(1, 51):
        candidate = mail if attempt == 1 else f"{local}{attempt}@{domain}"
        if not session.exec(select(User).where(User.mail == candidate)).first():
            return candidate
        print(f"  · {candidate} ya existe, probando el siguiente…")
    raise SystemExit("No se encontró un correo libre tras 50 intentos")


def seed(session, args):
    mail = _free_mail(session, args.mail)

    # ---- Usuario + wallet default (mismo camino que POST /users/register) ----
    validate_password_strength(args.password)
    user = User(name=args.name, mail=mail, password=hash_password(args.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    create_default_wallet(user.id, session)
    print(f"Usuario creado: {args.name} <{mail}>")

    # ---- Categorías: globales existentes + propias ----
    global_cats = {
        c.name: c
        for c in session.exec(
            select(Category).where(Category.user_id == None, Category.is_active == True)  # noqa: E711
        ).all()
    }
    if not global_cats:
        print(
            "  ⚠ No hay categorías globales en la BD; se crearán todas como propias.\n"
            "    Para tenerlas: python -m app.scripts.seed_categories"
        )

    own_cats = {}
    for cname, ctype in OWN_CATEGORIES:
        cat = Category(user_id=user.id, name=cname, type=ctype)
        session.add(cat)
        own_cats[cname] = cat
    session.commit()

    fallback_created = []

    def resolve_category(cat_name, needed_type):
        """Categoría por nombre, prefiriendo la GLOBAL cuando existe para que la
        demo ejercite ambos orígenes. Si no existe en ningún lado (BD sin seed de
        globales), la crea como propia."""
        if cat_name in global_cats:
            return global_cats[cat_name]
        if cat_name in own_cats:
            return own_cats[cat_name]
        cat = Category(user_id=user.id, name=cat_name, type=needed_type)
        session.add(cat)
        session.commit()
        session.refresh(cat)
        own_cats[cat_name] = cat
        fallback_created.append(cat_name)
        return cat

    # ---- Preferencias por categoría (color propio + una oculta) ----
    # El color y is_hidden viven en user_category_preferences, no en la
    # categoría: por eso se puede pintar una GLOBAL sin afectar a los demás
    # usuarios (gotcha #7 del CLAUDE.md).
    colored = 0
    for cat_name, color in (("Comida", "#e07a5f"), ("Transporte", "#3d5a80"), ("Mascotas", "#8a5cf6")):
        target = global_cats.get(cat_name) or own_cats.get(cat_name)
        if target:
            session.add(UserCategoryPreference(user_id=user.id, category_id=target.id, color=color))
            colored += 1
    session.add(
        UserCategoryPreference(
            user_id=user.id,
            category_id=own_cats["Categoría archivada (demo)"].id,
            is_hidden=True,
        )
    )
    session.commit()
    print(
        f"  categorías: {len(global_cats)} globales reutilizadas, "
        f"{len(own_cats)} propias · {colored} con color, 1 oculta"
    )

    # ---- Wallets ----
    wallet_defs = [
        ("Efectivo", "Gastos en efectivo del día a día"),
        ("Tarjeta de crédito", "Movimientos de la TDC"),
        ("Ahorros", "Fondo de ahorro e ingresos"),
        ("Viajes", "Gastos de viajes y salidas"),
        ("Casa", "Gastos del hogar y servicios"),
    ]
    wallets = {}
    for wname, wdesc in wallet_defs:
        w = Wallet(user_id=user.id, name=wname, description=wdesc)
        session.add(w)
        wallets[wname] = w
    session.commit()
    print(f"  wallets: {len(wallets)} propias (+ la default 'General')")

    # ---- Transacciones ----
    # Se crean ANTES que las reglas, al revés que en la versión HTTP. El
    # resultado es idéntico: allá cada POST evaluaba las reglas una por una,
    # aquí `recalculate_assignments_for_rule` hace una sola pasada por regla
    # sobre todo el histórico — que es exactamente lo que hace la ruta de
    # wallet-rules. Mismas filas en transaction_wallets, muchos menos commits.
    target_total = max(100, args.transactions)
    start_month = months_ago(14)
    wallet_list = list(wallets.values())
    manual_pairs = []  # (transaction, wallet) con asignación MANUAL

    def make_transaction(nm, cat_name, ttype, amount, d, force_wallet=None):
        category = resolve_category(
            cat_name, CategoryType.INCOME if ttype == TransactionType.INCOME else CategoryType.EXPENSE
        )
        trx = Transaction(
            user_id=user.id,
            name=nm,
            # ~60% con descripción: el resto ejercita el caso description = null.
            description=f"{nm} — movimiento de demo" if random.random() < 0.6 else None,
            amount=amount,
            type=ttype,
            date=d,
            category_id=category.id,
        )
        session.add(trx)
        # ~30% con asignación MANUAL; el resto queda solo con lo que deriven las
        # reglas (gotcha #16: wallet_id manual vs wallet_ids completo).
        wallet = force_wallet or (random.choice(wallet_list) if random.random() < 0.3 else None)
        if wallet is not None:
            manual_pairs.append((trx, wallet))
        return trx

    created = 0
    # Base mensual: sueldo + renta en cada mes, para que las gráficas de
    # tendencia y los totales por periodo tengan una línea de fondo estable.
    for year, month in month_iter(start_month, TODAY):
        make_transaction("Salario", "Salario", TransactionType.INCOME,
                         round(random.uniform(15000, 19000), 2),
                         day_in_month(year, month, 5), force_wallet=wallets["Ahorros"])
        make_transaction("Renta del departamento", "Vivienda", TransactionType.EXPENSE,
                         6500.00, day_in_month(year, month, 2), force_wallet=wallets["Casa"])
        created += 2
        for _ in range(random.randint(4, 7)):
            nm, cat, (lo, hi) = random.choice(EXPENSE_TEMPLATES)
            make_transaction(nm, cat, TransactionType.EXPENSE, round(random.uniform(lo, hi), 2),
                             day_in_month(year, month, random.randint(1, 28)))
            created += 1
        if random.random() < 0.55:
            nm, cat, (lo, hi) = random.choice(INCOME_TEMPLATES)
            make_transaction(nm, cat, TransactionType.INCOME, round(random.uniform(lo, hi), 2),
                             day_in_month(year, month, random.randint(1, 28)))
            created += 1

    # Relleno aleatorio hasta el objetivo, dejando hueco para las 6
    # transacciones de cierre (ver más abajo).
    span_days = (TODAY - start_month).days
    while created < target_total - 6:
        if random.random() < 0.78:
            nm, cat, (lo, hi) = random.choice(EXPENSE_TEMPLATES)
            ttype = TransactionType.EXPENSE
        else:
            nm, cat, (lo, hi) = random.choice(INCOME_TEMPLATES)
            ttype = TransactionType.INCOME
        make_transaction(nm, cat, ttype, round(random.uniform(lo, hi), 2),
                         start_month + timedelta(days=random.randint(0, span_days)))
        created += 1

    session.commit()
    # La fila MANUAL es lo único que `set_manual_wallet` crea para una
    # transacción recién nacida (no hay asignación previa que reemplazar), así
    # que se insertan en bloque en vez de una llamada por transacción.
    for trx, wallet in manual_pairs:
        session.add(
            TransactionWallet(
                transaction_id=trx.id,
                wallet_id=wallet.id,
                assignment_type=AssignmentType.MANUAL,
            )
        )
    session.commit()
    print(f"  transacciones: {created} ({len(manual_pairs)} con wallet manual)")

    # ---- Wallet rules: los 5 rule_type ----
    rule_defs = [
        dict(wallet=wallets["Casa"], rule_type=WalletRuleType.CATEGORY,
             category_id=resolve_category("Servicios", CategoryType.EXPENSE).id),
        dict(wallet=wallets["Ahorros"], rule_type=WalletRuleType.TRANSACTION_TYPE,
             transaction_type=WalletRuleTransactionType.INCOME),
        dict(wallet=wallets["Tarjeta de crédito"], rule_type=WalletRuleType.KEYWORD, keyword="netflix"),
        dict(wallet=wallets["Viajes"], rule_type=WalletRuleType.KEYWORD, keyword="uber"),
        dict(wallet=wallets["Ahorros"], rule_type=WalletRuleType.AMOUNT_RANGE,
             amount_from=6000, amount_to=1000000),
        dict(wallet=wallets["Viajes"], rule_type=WalletRuleType.DATE_RANGE,
             date_from=months_ago(3), date_to=months_ago(2) - timedelta(days=1)),
    ]
    for rd in rule_defs:
        wallet = rd.pop("wallet")
        rule = WalletRule(user_id=user.id, wallet_id=wallet.id, **rd)
        session.add(rule)
        session.commit()
        session.refresh(rule)
        # Igual que POST /wallet-rules: recalcula las asignaciones de ESTA regla
        # contra todas las transacciones del usuario.
        recalculate_assignments_for_rule(rule, session)
    print(f"  wallet rules: {len(rule_defs)} (los 5 tipos)")

    # ---- Metas: los 3 goal_type, periodos pasado / actual / futuro ----
    this_month_start = date(TODAY.year, TODAY.month, 1)
    this_month_end = (this_month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)

    goal_defs = [
        # Pasada y ya cerrada: la cierra flag_expired_goals.
        dict(name="Ahorro para el enganche", description="Meta cerrada del semestre pasado",
             goal_type=GoalType.SAVINGS, target_amount=25000,
             start_date=months_ago(12), end_date=months_ago(2)),
        # Mes en curso, límite bajo a propósito -> se marca FAILED.
        dict(name="Presupuesto de comida", description="Límite mensual de comida",
             goal_type=GoalType.EXPENSE_LIMIT, target_amount=3000,
             start_date=this_month_start, end_date=this_month_end,
             category_id=resolve_category("Comida", CategoryType.EXPENSE).id),
        # Mes en curso, alcanzable -> ACHIEVED con el sueldo del mes.
        dict(name="Ingresos del mes", goal_type=GoalType.INCOME, target_amount=12000,
             start_date=this_month_start, end_date=this_month_end),
        # Scope de wallet y periodo que sigue abierto -> se queda ACTIVE.
        dict(name="Fondo de viajes", description="Juntar para el viaje de fin de año",
             goal_type=GoalType.SAVINGS, target_amount=30000,
             start_date=this_month_start, end_date=this_month_start + timedelta(days=180),
             wallet_id=wallets["Viajes"].id),
        # Anual con scope de categoría.
        dict(name="Ingresos freelance del año", goal_type=GoalType.INCOME, target_amount=60000,
             start_date=date(TODAY.year, 1, 1), end_date=date(TODAY.year, 12, 31),
             category_id=resolve_category("Freelance", CategoryType.INCOME).id),
        # Esta se cancela, para ejercitar el status 'cancelled'.
        dict(name="Límite de entretenimiento", goal_type=GoalType.EXPENSE_LIMIT, target_amount=2500,
             start_date=this_month_start, end_date=this_month_end,
             category_id=resolve_category("Entretenimiento", CategoryType.EXPENSE).id),
    ]
    for gd in goal_defs:
        goal = Goal(user_id=user.id, **gd)
        if gd["name"] == "Límite de entretenimiento":
            goal.status = GoalStatus.CANCELLED
        session.add(goal)
    session.commit()
    print(f"  metas: {len(goal_defs)} (1 cancelada)")

    # Transacciones de cierre, dentro del mes en curso: si el mes acaba de
    # empezar, las metas mensuales arrancarían casi vacías y no se vería nada.
    month_days = (TODAY - this_month_start).days
    closing = [("Comida",)] * 3 + [("Entretenimiento",)] * 2 + [(None,)]
    for (cat_name,) in closing:
        if cat_name is None:
            nm, cat_name, (lo, hi) = random.choice(INCOME_TEMPLATES)
            ttype = TransactionType.INCOME
        else:
            nm, _, (lo, hi) = random.choice([t for t in EXPENSE_TEMPLATES if t[1] == cat_name])
            ttype = TransactionType.EXPENSE
        trx = make_transaction(nm, cat_name, ttype, round(random.uniform(lo, hi), 2),
                               this_month_start + timedelta(days=random.randint(0, month_days)))
        session.commit()
        # Estas sí pasan por el servicio completo, una a una: es el mismo camino
        # que POST /transactions y deja las asignaciones por regla resueltas.
        assign_wallets_for_transaction(trx, session)
        created += 1

    # ---- Recurrentes: las 5 frecuencias, ambos tipos, auto_execute mixto ----
    # start_date cerca de hoy a propósito: execute-pending ejecuta UNA vez por
    # llamada, así que una recurrente que arrancara hace meses quedaría vencida
    # de forma permanente en vez de ponerse al día.
    E, I = RecurringTransactionType.EXPENSE, RecurringTransactionType.INCOME
    F = RecurringTransactionFrequency
    recurring_defs = [
        ("Renta", "Renta mensual del depto", 6500, E, F.MONTHLY, 10, True, "Vivienda"),
        ("Netflix", "Suscripción Netflix", 299, E, F.MONTHLY, 6, True, "Suscripciones"),
        ("Café diario", "Café de la mañana", 65, E, F.DAILY, 0, True, "Café de especialidad"),
        ("Gimnasio", "Mensualidad del gym", 250, E, F.WEEKLY, 3, True, "Salud"),
        ("Seguro de auto", "Póliza anual del auto", 8500, E, F.YEARLY, 20, True, "Transporte"),
        # auto_execute=False y ya vencida -> cae en pending-confirmation.
        ("Salario quincenal", "Nómina quincenal", 12000, I, F.BIWEEKLY, 2, False, "Salario"),
        # Esta se pausa.
        ("Clases de inglés", "Colegiatura semanal", 700, E, F.WEEKLY, 1, True, "Educación"),
    ]
    recurrings = []
    for nm, desc, amount, rtype, freq, days_back, auto, cat_name in recurring_defs:
        start = TODAY - timedelta(days=days_back)
        rec = RecurringTransaction(
            user_id=user.id, name=nm, description=desc, amount=amount, type=rtype,
            frequency=freq, start_date=start,
            next_execution=start,  # la primera ejecución es en start_date
            auto_execute=auto,
            category_id=resolve_category(
                cat_name, CategoryType.INCOME if rtype == I else CategoryType.EXPENSE
            ).id,
        )
        session.add(rec)
        recurrings.append(rec)
    recurrings[-1].status = RecurringTransactionStatus.PAUSED
    session.commit()

    # ---- Ejecuta las vencidas (mismo hook que dispara el login) ----
    executed = 0
    for rec in recurrings:
        if (rec.status != RecurringTransactionStatus.ACTIVE
                or not rec.auto_execute
                or rec.next_execution > TODAY):
            continue
        trx = Transaction(
            user_id=user.id, name=rec.name, description=rec.description,
            amount=rec.amount, type=rec.type, date=rec.next_execution,
            category_id=rec.category_id,
        )
        session.add(trx)
        session.commit()
        session.refresh(trx)
        assign_wallets_for_transaction(trx, session)
        rec.last_executed = rec.next_execution
        rec.next_execution = _advance_date(rec.next_execution, rec.frequency)
        session.add(rec)
        session.commit()
        create_notification(
            session, user_id=user.id, type=NotificationType.RECURRING_EXECUTED,
            title="Transacción recurrente registrada",
            message=f'Se registró automáticamente "{rec.name}" por ${float(rec.amount):,.2f}.',
            entity_type="recurring_transaction", entity_id=rec.id,
        )
        executed += 1
        created += 1

    # Las auto_execute=False vencidas no se ejecutan solas: solo se avisa.
    for rec in recurrings:
        if (rec.status == RecurringTransactionStatus.ACTIVE
                and not rec.auto_execute
                and rec.next_execution <= TODAY):
            create_notification(
                session, user_id=user.id, type=NotificationType.RECURRING_PENDING,
                title="Recurrente esperando confirmación",
                message=f'"{rec.name}" venció y espera tu confirmación.',
                entity_type="recurring_transaction", entity_id=rec.id, dedupe=True,
            )

    print(f"  recurrentes: {len(recurring_defs)} (1 pausada: '{recurrings[-1].name}') · "
          f"{executed} ejecutadas ahora")

    # ---- Cierre de metas ----
    # evaluate_goal_completions solo corre al escribir transacciones y
    # flag_expired_goals solo en el login; sin esta pareja final las metas
    # quedarían todas en ACTIVE aunque sus números ya digan otra cosa.
    evaluate_goal_completions(user.id, session)
    flag_expired_goals(user.id, session)

    if fallback_created:
        print(f"  ⚠ categorías creadas como propias por falta de global: "
              f"{', '.join(sorted(set(fallback_created)))}")

    return user


def report(session, user, password):
    """Relee de la BD lo que quedó sembrado (no confía en los contadores del
    seeding) y lo imprime."""
    from app.models.notifications import Notification

    txs = session.exec(
        select(Transaction).where(Transaction.user_id == user.id, Transaction.is_active == True)
    ).all()
    incomes = [t for t in txs if t.type == TransactionType.INCOME]
    expenses = [t for t in txs if t.type == TransactionType.EXPENSE]
    dates = sorted(t.date for t in txs)

    wallets = session.exec(
        select(Wallet).where(Wallet.user_id == user.id, Wallet.is_active == True)
    ).all()
    assignments = session.exec(
        select(TransactionWallet).where(
            TransactionWallet.transaction_id.in_([t.id for t in txs])
        )
    ).all()
    goals = session.exec(
        select(Goal).where(Goal.user_id == user.id, Goal.is_active == True)
    ).all()
    recurrings = session.exec(
        select(RecurringTransaction).where(
            RecurringTransaction.user_id == user.id,
            RecurringTransaction.is_active == True,
        )
    ).all()
    cats = session.exec(
        select(Category).where(
            Category.is_active == True,
            (Category.user_id == None) | (Category.user_id == user.id),  # noqa: E711
        )
    ).all()
    prefs = session.exec(
        select(UserCategoryPreference).where(UserCategoryPreference.user_id == user.id)
    ).all()
    unread = len(session.exec(
        select(Notification).where(
            Notification.user_id == user.id, Notification.is_read == False
        )
    ).all())

    print("\n" + "=" * 62)
    print("  RESUMEN DEL USUARIO SEMBRADO")
    print("=" * 62)
    print(f"  Transacciones : {len(txs)}  ({len(incomes)} ingresos / {len(expenses)} gastos)")
    print(f"  Rango fechas  : {dates[0]} → {dates[-1]}")
    print(f"  Ingresos      : ${sum(float(t.amount) for t in incomes):,.2f}")
    print(f"  Gastos        : ${sum(float(t.amount) for t in expenses):,.2f}")
    print(f"  Categorías    : {len(cats)} visibles "
          f"({len([c for c in cats if c.user_id is None])} globales, "
          f"{len([c for c in cats if c.user_id])} propias, "
          f"{len([p for p in prefs if p.is_hidden])} oculta(s))")
    print(f"  Wallets       : {len(wallets)} (incluye la default)")
    for w in wallets:
        if w.is_default:
            # La default es implícita: no tiene filas en transaction_wallets,
            # contiene TODO por definición (gotcha #6 del CLAUDE.md).
            print(f"                   · {w.name} ★ default: {len(txs)} (todas, implícita)")
        else:
            n = len({a.transaction_id for a in assignments if a.wallet_id == w.id})
            print(f"                   · {w.name}: {n} movimientos asignados")
    print(f"  Metas         : {len(goals)}")
    for g in goals:
        p = compute_goal_progress(g, session)
        print(f"                   · {g.name}: {g.status.value} — {p['percentage']:.0f}% "
              f"(${p['current_amount']:,.2f} / ${float(g.target_amount):,.2f})")
    pending = [r for r in recurrings
               if r.status == RecurringTransactionStatus.ACTIVE
               and not r.auto_execute and r.next_execution <= TODAY]
    print(f"  Recurrentes   : {len(recurrings)} "
          f"({len([r for r in recurrings if r.status == RecurringTransactionStatus.ACTIVE])} activas, "
          f"{len([r for r in recurrings if r.status == RecurringTransactionStatus.PAUSED])} pausadas, "
          f"{len(pending)} esperando confirmación)")
    print(f"  Notificaciones: {unread} sin leer")

    print("\n" + "=" * 62)
    print("  CREDENCIALES DE ACCESO")
    print("=" * 62)
    print(f"  Nombre     : {user.name}")
    print(f"  Correo     : {user.mail}")
    print(f"  Contraseña : {password}")
    print("=" * 62 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Siembra un usuario de demo completo.")
    parser.add_argument("--name", default="Demo Finanzas")
    parser.add_argument("--mail", default="demo@finanzas.test")
    parser.add_argument("--password", default="Demo1234!",
                        help="Debe cumplir la política: 8+, mayúscula, número y símbolo")
    parser.add_argument("--transactions", type=int, default=140,
                        help="Objetivo de transacciones (mínimo 100)")
    parser.add_argument("--seed", type=int, default=None,
                        help="Semilla aleatoria; por defecto cada corrida varía")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    try:
        validate_password_strength(args.password)
    except ValueError as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(1)

    print(f"BD: {engine.url.render_as_string(hide_password=True)}")
    with Session(engine) as session:
        user = seed(session, args)
        report(session, user, args.password)


if __name__ == "__main__":
    main()
