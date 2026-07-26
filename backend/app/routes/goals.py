from datetime import datetime
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db.db import get_session
from app.models.goals import (
    Goal,
    GoalCreate,
    GoalUpdate,
    GoalRead,
    GoalProgressRead,
    GoalStatus,
)
from app.models.users import User
from app.models.wallets import Wallet
from app.models.categories import Category
from app.models.logs import LogAction, LogLevel
from app.auth.dependencies import get_current_user
from app.utils.logs_decorator import log_action
from app.services.goals import compute_goal_progress

router = APIRouter(prefix="/goals", tags=["Goals"])


def _validate_wallet_ownership(wallet_id: UUID, current_user: User, session: Session) -> None:
    wallet = session.get(Wallet, wallet_id)
    if not wallet or not wallet.is_active or wallet.user_id != current_user.id:
        raise HTTPException(404, "Wallet not found")


def _validate_category_scope(category_id: UUID, current_user: User, session: Session) -> None:
    # Una meta puede apuntar a una categoria global (user_id null) o propia.
    category = session.get(Category, category_id)
    if not category or not category.is_active:
        raise HTTPException(404, "Category not found")
    if category.user_id is not None and category.user_id != current_user.id:
        raise HTTPException(403, "Category not yours")


def _validate_scope(goal_in, current_user: User, session: Session) -> None:
    if goal_in.wallet_id is not None:
        _validate_wallet_ownership(goal_in.wallet_id, current_user, session)
    if goal_in.category_id is not None:
        _validate_category_scope(goal_in.category_id, current_user, session)


@router.post("/", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
@log_action(action=LogAction.CREATE, table="goals")
def create_goal(
    goal_in: GoalCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if goal_in.end_date < goal_in.start_date:
        raise HTTPException(400, "end_date must be on or after start_date")

    _validate_scope(goal_in, current_user, session)

    new_goal = Goal(
        user_id=current_user.id,
        name=goal_in.name,
        description=goal_in.description,
        goal_type=goal_in.goal_type,
        target_amount=goal_in.target_amount,
        start_date=goal_in.start_date,
        end_date=goal_in.end_date,
        wallet_id=goal_in.wallet_id,
        category_id=goal_in.category_id,
    )
    session.add(new_goal)
    session.commit()
    session.refresh(new_goal)
    return new_goal


@router.get("/", response_model=List[GoalRead])
def list_goals(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
):
    goals = session.exec(
        select(Goal)
        .where(Goal.user_id == current_user.id, Goal.is_active == True)
        .offset(skip)
        .limit(limit)
    ).all()
    return goals


# IMPORTANTE: declarar /progress ANTES de /{goal_id} para que la ruta dinamica
# no capture "progress" (mismo cuidado que /transactions/summary).
@router.get("/{goal_id}/progress", response_model=GoalProgressRead)
def get_goal_progress(
    goal_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    goal = session.get(Goal, goal_id)
    if not goal or not goal.is_active or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")

    progress = compute_goal_progress(goal, session)
    return GoalProgressRead(**goal.model_dump(), **progress)


@router.get("/{goal_id}", response_model=GoalRead)
def get_goal(
    goal_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    goal = session.get(Goal, goal_id)
    if not goal or not goal.is_active or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.patch("/{goal_id}", response_model=GoalRead)
@log_action(action=LogAction.UPDATE, table="goals")
def update_goal(
    goal_id: UUID,
    goal_in: GoalUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    goal = session.get(Goal, goal_id)
    if not goal or not goal.is_active or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")

    update_data = goal_in.model_dump(exclude_unset=True)

    # Valida coherencia del periodo con los valores resultantes.
    new_start = update_data.get("start_date", goal.start_date)
    new_end = update_data.get("end_date", goal.end_date)
    if new_end < new_start:
        raise HTTPException(400, "end_date must be on or after start_date")

    if update_data.get("wallet_id") is not None:
        _validate_wallet_ownership(update_data["wallet_id"], current_user, session)
    if update_data.get("category_id") is not None:
        _validate_category_scope(update_data["category_id"], current_user, session)

    for key, value in update_data.items():
        setattr(goal, key, value)

    goal.updated_at = datetime.now()
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal


@router.post("/{goal_id}/cancel", response_model=GoalRead)
@log_action(action=LogAction.UPDATE, table="goals")
def cancel_goal(
    goal_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Estado de negocio suave (distinto del soft-delete is_active).
    goal = session.get(Goal, goal_id)
    if not goal or not goal.is_active or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.status = GoalStatus.CANCELLED
    goal.updated_at = datetime.now()
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=200)
@log_action(action=LogAction.DELETE, level=LogLevel.WARNING, table="goals")
def deactivate_goal(
    goal_id: UUID,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    goal = session.get(Goal, goal_id)
    if not goal or not goal.is_active or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.is_active = False
    goal.updated_at = datetime.now()
    session.add(goal)
    session.commit()
    return {"message": "Goal deactivated successfully", "name": goal.name}
