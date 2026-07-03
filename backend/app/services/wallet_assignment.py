"""
Servicio central de asignacion de wallets a transacciones.

Resume la logica de negocio que definimos en el diseno:
- Transaction_Wallets es una "cache" derivada de las reglas activas
  del usuario + la asignacion manual (si existe).
- El wallet default nunca aparece aca: es implicito, siempre contiene
  todas las transacciones del usuario sin filtrar.
- Una transaccion puede tener 1 asignacion Manual (a lo sumo) y N
  asignaciones Rule (todas las reglas que matcheen, sin prioridad).

Disparadores que usan este servicio:
- Crear una transaccion nueva.
- Editar una transaccion existente (cambia categoria, monto, fecha, etc).
- Crear una wallet rule nueva.
- Editar una wallet rule existente.
- Desactivar/borrar una wallet rule (solo limpieza, no necesita evaluar).
"""
from uuid import UUID
from typing import Optional
from sqlmodel import Session, select

from app.models.transactions import Transaction
from app.models.wallet_rules import WalletRule, WalletRuleType
from app.models.transactions_wallets import TransactionWallet, AssignmentType


def _rule_matches_transaction(rule: WalletRule, transaction: Transaction) -> bool:
    """Evalua si una regla aplica a una transaccion dada, segun su rule_type."""
    if not rule.is_active:
        return False

    if rule.rule_type == WalletRuleType.CATEGORY:
        return rule.category_id is not None and rule.category_id == transaction.category_id

    if rule.rule_type == WalletRuleType.TRANSACTION_TYPE:
        return rule.transaction_type is not None and rule.transaction_type.value == transaction.type.value

    if rule.rule_type == WalletRuleType.KEYWORD:
        if not rule.keyword:
            return False
        keyword = rule.keyword.lower()
        name_match = keyword in (transaction.name or "").lower()
        desc_match = keyword in (transaction.description or "").lower()
        return name_match or desc_match

    if rule.rule_type == WalletRuleType.DATE_RANGE:
        if rule.date_from is None or rule.date_to is None:
            return False
        return rule.date_from <= transaction.date <= rule.date_to

    if rule.rule_type == WalletRuleType.AMOUNT_RANGE:
        if rule.amount_from is None or rule.amount_to is None:
            return False
        return rule.amount_from <= transaction.amount <= rule.amount_to

    return False


def set_manual_wallet(
    transaction: Transaction,
    wallet_id: Optional[UUID],
    session: Session,
) -> None:
    """Crea, reemplaza, o elimina la asignacion Manual de una transaccion.
    wallet_id=None significa "sin asignacion manual" (se borra si existia)."""
    existing_manual = session.exec(
        select(TransactionWallet).where(
            TransactionWallet.transaction_id == transaction.id,
            TransactionWallet.assignment_type == AssignmentType.MANUAL,
        )
    ).first()

    if existing_manual:
        session.delete(existing_manual)
        session.flush()

    if wallet_id is not None:
        new_manual = TransactionWallet(
            transaction_id=transaction.id,
            wallet_id=wallet_id,
            assignment_type=AssignmentType.MANUAL,
            rule_id=None,
        )
        session.add(new_manual)
        session.flush()


def recalculate_rule_assignments_for_transaction(
    transaction: Transaction,
    session: Session,
) -> None:
    """Borra todas las asignaciones Rule de esta transaccion y las
    vuelve a calcular contra las wallet_rules activas del usuario.
    No toca la asignacion Manual."""
    existing_rule_assignments = session.exec(
        select(TransactionWallet).where(
            TransactionWallet.transaction_id == transaction.id,
            TransactionWallet.assignment_type == AssignmentType.RULE,
        )
    ).all()
    for assignment in existing_rule_assignments:
        session.delete(assignment)
    session.flush()

    active_rules = session.exec(
        select(WalletRule).where(
            WalletRule.user_id == transaction.user_id,
            WalletRule.is_active == True,
        )
    ).all()

    for rule in active_rules:
        if _rule_matches_transaction(rule, transaction):
            session.add(
                TransactionWallet(
                    transaction_id=transaction.id,
                    wallet_id=rule.wallet_id,
                    assignment_type=AssignmentType.RULE,
                    rule_id=rule.id,
                )
            )
    session.flush()


def assign_wallets_for_transaction(
    transaction: Transaction,
    session: Session,
    manual_wallet_id: Optional[UUID] = None,
    update_manual: bool = True,
) -> None:
    """Punto de entrada principal: se llama al crear o editar una
    transaccion. Resuelve tanto la asignacion manual como las reglas.

    update_manual=False permite recalcular solo las reglas sin tocar
    la asignacion manual existente (util cuando lo que cambio fue la
    transaccion y no se mando un wallet_id explicito).
    """
    if update_manual:
        set_manual_wallet(transaction, manual_wallet_id, session)

    recalculate_rule_assignments_for_transaction(transaction, session)
    session.commit()


def recalculate_assignments_for_rule(rule: WalletRule, session: Session) -> None:
    """Se llama al crear o editar una wallet_rule: borra todas las
    asignaciones Rule generadas por esta regla especifica y las vuelve
    a calcular contra TODAS las transacciones del usuario."""
    existing_assignments = session.exec(
        select(TransactionWallet).where(TransactionWallet.rule_id == rule.id)
    ).all()
    for assignment in existing_assignments:
        session.delete(assignment)
    session.flush()

    if not rule.is_active:
        session.commit()
        return

    user_transactions = session.exec(
        select(Transaction).where(
            Transaction.user_id == rule.user_id,
            Transaction.is_active == True,
        )
    ).all()

    for transaction in user_transactions:
        if _rule_matches_transaction(rule, transaction):
            session.add(
                TransactionWallet(
                    transaction_id=transaction.id,
                    wallet_id=rule.wallet_id,
                    assignment_type=AssignmentType.RULE,
                    rule_id=rule.id,
                )
            )
    session.commit()


def remove_assignments_for_rule(rule_id: UUID, session: Session) -> None:
    """Se llama al borrar/desactivar una wallet_rule: solo limpia,
    no necesita re-evaluar nada."""
    existing_assignments = session.exec(
        select(TransactionWallet).where(TransactionWallet.rule_id == rule_id)
    ).all()
    for assignment in existing_assignments:
        session.delete(assignment)
    session.commit()
