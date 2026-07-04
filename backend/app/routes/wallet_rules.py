from datetime import datetime
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db.db import get_session
from app.models.wallet_rules import WalletRule, WalletRuleCreate, WalletRuleUpdate, WalletRuleRead, WalletRuleType
from app.models.wallets import Wallet
from app.models.categories import Category
from app.models.users import User
from app.models.logs import LogAction, LogLevel
from app.auth.dependencies import get_current_user
from app.utils.logs_decorator import log_action
from app.services.wallet_assignment import recalculate_assignments_for_rule, remove_assignments_for_rule

router = APIRouter(prefix="/wallet-rules", tags=["Wallet Rules"])


def _validate_rule_fields(rule_type: WalletRuleType, data: dict) -> None:
    """Valida que el set de campos enviados corresponda al rule_type
    elegido (ej. una regla CATEGORY debe traer category_id)."""
    if rule_type == WalletRuleType.CATEGORY and not data.get("category_id"):
        raise HTTPException(400, "category_id is required for rule_type=Category")
    if rule_type == WalletRuleType.TRANSACTION_TYPE and not data.get("transaction_type"):
        raise HTTPException(400, "transaction_type is required for rule_type=TransactionType")
    if rule_type == WalletRuleType.KEYWORD and not data.get("keyword"):
        raise HTTPException(400, "keyword is required for rule_type=Keyword")
    if rule_type == WalletRuleType.DATE_RANGE and not (data.get("date_from") and data.get("date_to")):
        raise HTTPException(400, "date_from and date_to are required for rule_type=DateRange")
    if rule_type == WalletRuleType.AMOUNT_RANGE and not (data.get("amount_from") is not None and data.get("amount_to") is not None):
        raise HTTPException(400, "amount_from and amount_to are required for rule_type=AmountRange")


@router.post("/", response_model=WalletRuleRead, status_code=status.HTTP_201_CREATED)
@log_action(action=LogAction.CREATE, table="wallet_rules")
def create_wallet_rule(
    rule_in: WalletRuleCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    wallet = session.get(Wallet, rule_in.wallet_id)
    if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
        raise HTTPException(404, "Wallet not found")

    rule_data = rule_in.model_dump()
    _validate_rule_fields(rule_in.rule_type, rule_data)

    if rule_in.category_id:
        category = session.get(Category, rule_in.category_id)
        if not category or not category.is_active:
            raise HTTPException(404, "Category not found")
        if category.user_id is not None and category.user_id != current_user.id:
            raise HTTPException(403, "Category not yours")

    db_rule = WalletRule(
        user_id=current_user.id,
        wallet_id=rule_in.wallet_id,
        rule_type=rule_in.rule_type,
        category_id=rule_in.category_id,
        transaction_type=rule_in.transaction_type,
        keyword=rule_in.keyword,
        date_from=rule_in.date_from,
        date_to=rule_in.date_to,
        amount_from=rule_in.amount_from,
        amount_to=rule_in.amount_to,
    )
    session.add(db_rule)
    session.commit()
    session.refresh(db_rule)

    # Disparador: nueva regla -> evaluar contra todas las transacciones
    # existentes del usuario.
    recalculate_assignments_for_rule(db_rule, session)

    return db_rule


@router.get("/", response_model=List[WalletRuleRead])
def list_wallet_rules(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    wallet_id: UUID = None,
):
    query = select(WalletRule).where(
        WalletRule.user_id == current_user.id,
        WalletRule.is_active == True,
    )
    if wallet_id:
        query = query.where(WalletRule.wallet_id == wallet_id)
    return session.exec(query).all()


@router.get("/{rule_id}", response_model=WalletRuleRead)
def get_wallet_rule(
    rule_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    rule = session.get(WalletRule, rule_id)
    if not rule or not rule.is_active or rule.user_id != current_user.id:
        raise HTTPException(404, "Wallet rule not found")
    return rule


@router.patch("/{rule_id}", response_model=WalletRuleRead)
@log_action(action=LogAction.UPDATE, table="wallet_rules")
def update_wallet_rule(
    rule_id: UUID,
    rule_in: WalletRuleUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    rule = session.get(WalletRule, rule_id)
    if not rule or not rule.is_active or rule.user_id != current_user.id:
        raise HTTPException(404, "Wallet rule not found")

    update_data = rule_in.model_dump(exclude_unset=True)

    if "wallet_id" in update_data:
        wallet = session.get(Wallet, update_data["wallet_id"])
        if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
            raise HTTPException(404, "Wallet not found")

    for key, value in update_data.items():
        setattr(rule, key, value)

    # Validar consistencia final (por si cambio el rule_type sin mandar
    # los campos nuevos correspondientes)
    _validate_rule_fields(rule.rule_type, rule.model_dump())

    rule.updated_at = datetime.now()
    session.add(rule)
    session.commit()
    session.refresh(rule)

    # Disparador: regla editada -> borrar sus asignaciones viejas y
    # recalcular contra todas las transacciones del usuario.
    recalculate_assignments_for_rule(rule, session)

    return rule


@router.delete("/{rule_id}", status_code=200)
@log_action(action=LogAction.DELETE, level=LogLevel.WARNING, table="wallet_rules")
def deactivate_wallet_rule(
    rule_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    rule = session.get(WalletRule, rule_id)
    if not rule or not rule.is_active or rule.user_id != current_user.id:
        raise HTTPException(404, "Wallet rule not found")

    rule.is_active = False
    rule.updated_at = datetime.now()
    session.add(rule)
    session.commit()

    # Disparador: regla desactivada -> solo limpiar sus asignaciones,
    # no hace falta re-evaluar nada.
    remove_assignments_for_rule(rule.id, session)

    return {"message": "Wallet rule deactivated successfully"}
