"""Pruebas del panel de administracion: control de acceso (is_admin) y las
acciones sobre usuarios (listar, desactivar, reactivar, resetear contrasena,
borrado fisico con cascada)."""
from datetime import date
from uuid import UUID

from sqlmodel import Session

from app.db.db import engine
from app.models import (
    Category,
    CategoryType,
    Goal,
    GoalType,
    UserCategoryPreference,
)


# ---------- Control de acceso ----------

def test_list_users_forbidden_for_normal_user(client, make_user, login):
    make_user(mail="a@test.com", password="Secret123")
    headers = login("a@test.com", "Secret123")
    assert client.get("/users/", headers=headers).status_code == 403


def test_admin_actions_forbidden_for_normal_user(client, make_user, login):
    normal = make_user(mail="a@test.com", password="Secret123")
    victim = make_user(mail="b@test.com", password="Secret123")
    headers = login(normal["mail"], normal["password"])

    assert client.delete(f"/users/{victim['id']}/deactivate", headers=headers).status_code == 403
    assert client.post(f"/users/{victim['id']}/reactivate", headers=headers).status_code == 403
    assert client.post(
        f"/users/{victim['id']}/reset-password",
        json={"new_password": "Whatever123"},
        headers=headers,
    ).status_code == 403


# ---------- Listado ----------

def test_admin_lists_users(client, admin, admin_headers, make_user):
    make_user(mail="b@test.com", password="Secret123")
    resp = client.get("/users/", headers=admin_headers)
    assert resp.status_code == 200
    mails = {u["mail"] for u in resp.json()}
    assert {"admin@test.com", "b@test.com"} <= mails


def test_admin_list_excludes_inactive_by_default(client, admin, admin_headers, make_user):
    make_user(mail="off@test.com", password="Secret123", is_active=False)
    default = client.get("/users/", headers=admin_headers).json()
    assert "off@test.com" not in {u["mail"] for u in default}

    with_inactive = client.get("/users/?include_inactive=true", headers=admin_headers).json()
    assert "off@test.com" in {u["mail"] for u in with_inactive}


# ---------- Desactivar / reactivar ----------

def test_admin_deactivate_then_reactivate(client, admin, admin_headers, make_user):
    victim = make_user(mail="b@test.com", password="Secret123")

    assert client.delete(f"/users/{victim['id']}/deactivate", headers=admin_headers).status_code == 200
    # Desactivado: no puede loguear.
    assert client.post("/auth/login", data={"username": "b@test.com", "password": "Secret123"}).status_code == 401

    assert client.post(f"/users/{victim['id']}/reactivate", headers=admin_headers).status_code == 200
    # Reactivado: vuelve a poder loguear.
    assert client.post("/auth/login", data={"username": "b@test.com", "password": "Secret123"}).status_code == 200


def test_admin_cannot_deactivate_another_admin(client, admin, admin_headers, make_user):
    other_admin = make_user(mail="boss@test.com", password="Secret123", is_admin=True)
    resp = client.delete(f"/users/{other_admin['id']}/deactivate", headers=admin_headers)
    assert resp.status_code == 400


def test_deactivate_missing_user_404(client, admin, admin_headers):
    resp = client.delete(f"/users/{UUID(int=0)}/deactivate", headers=admin_headers)
    assert resp.status_code == 404


# ---------- Reset de contrasena ----------

def test_admin_reset_password(client, admin, admin_headers, make_user):
    victim = make_user(mail="b@test.com", password="OldPass123")

    resp = client.post(
        f"/users/{victim['id']}/reset-password",
        json={"new_password": "BrandNew123!"},
        headers=admin_headers,
    )
    assert resp.status_code == 200

    assert client.post("/auth/login", data={"username": "b@test.com", "password": "OldPass123"}).status_code == 401
    assert client.post("/auth/login", data={"username": "b@test.com", "password": "BrandNew123!"}).status_code == 200


def test_admin_reset_password_revokes_refresh_tokens(client, admin, admin_headers, make_user):
    victim = make_user(mail="b@test.com", password="OldPass123")
    tokens = client.post("/auth/login", data={"username": "b@test.com", "password": "OldPass123"}).json()

    client.post(
        f"/users/{victim['id']}/reset-password",
        json={"new_password": "BrandNew123!"},
        headers=admin_headers,
    )

    # El refresh token emitido antes del reset ya no debe servir.
    assert client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401


def test_admin_reset_password_too_short_400(client, admin, admin_headers, make_user):
    victim = make_user(mail="b@test.com", password="OldPass123")
    resp = client.post(
        f"/users/{victim['id']}/reset-password",
        json={"new_password": "short"},
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_admin_cannot_reset_another_admin_password(client, admin, admin_headers, make_user):
    other_admin = make_user(mail="boss@test.com", password="Secret123", is_admin=True)
    resp = client.post(
        f"/users/{other_admin['id']}/reset-password",
        json={"new_password": "Whatever123"},
        headers=admin_headers,
    )
    assert resp.status_code == 400


# ---------- Borrado fisico con cascada ----------

def test_admin_hard_delete_cascades_goals_and_preferences(client, admin, admin_headers, make_user):
    """El hard-delete debe borrar tambien Goals y UserCategoryPreference del
    usuario; si no, la FK contra users/categories haria fallar el borrado."""
    victim = make_user(mail="b@test.com", password="Secret123")
    victim_id = UUID(victim["id"])

    with Session(engine) as session:
        # Categoria global (user_id null) para colgar una preferencia.
        cat = Category(user_id=None, name="Comida", type=CategoryType.EXPENSE)
        session.add(cat)
        session.commit()
        session.refresh(cat)

        session.add(Goal(
            user_id=victim_id,
            name="Meta",
            goal_type=GoalType.INCOME,
            target_amount=1000,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        ))
        session.add(UserCategoryPreference(
            user_id=victim_id,
            category_id=cat.id,
            is_hidden=True,
        ))
        session.commit()

    resp = client.delete(f"/users/{victim['id']}/hard", headers=admin_headers)
    assert resp.status_code == 200, resp.text

    # El usuario ya no existe.
    assert client.get(f"/users/{victim['id']}", headers=admin_headers).status_code == 404


def test_admin_cannot_hard_delete_another_admin(client, admin, admin_headers, make_user):
    other_admin = make_user(mail="boss@test.com", password="Secret123", is_admin=True)
    resp = client.delete(f"/users/{other_admin['id']}/hard", headers=admin_headers)
    assert resp.status_code == 400
