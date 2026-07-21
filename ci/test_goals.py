"""Pruebas de la funcionalidad de Metas (Goals): CRUD, validacion del periodo,
soft-delete y el calculo de avance a partir de transacciones reales."""
import pytest
from sqlmodel import Session

from app.db.db import engine
from app.models import Category, CategoryType


@pytest.fixture
def income_category():
    """Categoria global de ingresos, reutilizable como scope de una meta."""
    with Session(engine) as session:
        cat = Category(user_id=None, name="Salario", type=CategoryType.INCOME)
        session.add(cat)
        session.commit()
        session.refresh(cat)
        return str(cat.id)


@pytest.fixture
def user_headers(make_user, login):
    make_user(mail="u@test.com", password="Secret123")
    return login("u@test.com", "Secret123")


def _goal_payload(**overrides):
    payload = {
        "name": "Meta de ingresos",
        "goal_type": "income",
        "target_amount": 1000,
        "start_date": "2026-01-01T00:00:00",
        "end_date": "2026-12-31T00:00:00",
    }
    payload.update(overrides)
    return payload


def test_create_goal(client, user_headers, income_category):
    resp = client.post("/goals/", json=_goal_payload(category_id=income_category), headers=user_headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Meta de ingresos"
    assert body["status"] == "active"
    assert body["is_active"] is True


def test_create_goal_end_before_start_400(client, user_headers):
    resp = client.post(
        "/goals/",
        json=_goal_payload(start_date="2026-12-31T00:00:00", end_date="2026-01-01T00:00:00"),
        headers=user_headers,
    )
    assert resp.status_code == 400


def test_list_returns_only_active_goals(client, user_headers):
    created = client.post("/goals/", json=_goal_payload(), headers=user_headers).json()

    assert len(client.get("/goals/", headers=user_headers).json()) == 1

    client.delete(f"/goals/{created['id']}", headers=user_headers)
    # Tras el soft-delete no debe aparecer en el listado ni por id.
    assert client.get("/goals/", headers=user_headers).json() == []
    assert client.get(f"/goals/{created['id']}", headers=user_headers).status_code == 404


def test_update_goal(client, user_headers):
    created = client.post("/goals/", json=_goal_payload(), headers=user_headers).json()
    resp = client.patch(f"/goals/{created['id']}", json={"target_amount": 500}, headers=user_headers)
    assert resp.status_code == 200
    assert resp.json()["target_amount"] == 500


def test_cancel_goal(client, user_headers):
    created = client.post("/goals/", json=_goal_payload(), headers=user_headers).json()
    resp = client.post(f"/goals/{created['id']}/cancel", headers=user_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_progress_reflects_transactions(client, user_headers, income_category):
    created = client.post(
        "/goals/",
        json=_goal_payload(target_amount=1000, category_id=income_category),
        headers=user_headers,
    ).json()

    # Sin transacciones: 0%.
    zero = client.get(f"/goals/{created['id']}/progress", headers=user_headers).json()
    assert zero["current_amount"] == 0
    assert zero["percentage"] == 0
    assert zero["is_on_track"] is False

    # Un ingreso de 400 en la categoria y periodo de la meta.
    tx = client.post(
        "/transactions/",
        json={
            "name": "Pago",
            "description": "test",
            "amount": 400,
            "date": "2026-06-15",
            "type": "income",
            "category_id": income_category,
        },
        headers=user_headers,
    )
    assert tx.status_code in (200, 201), tx.text

    progress = client.get(f"/goals/{created['id']}/progress", headers=user_headers).json()
    assert progress["current_amount"] == 400
    assert progress["remaining"] == 600
    assert progress["percentage"] == 40


def test_goal_of_other_user_is_not_accessible(client, make_user, login):
    make_user(mail="owner@test.com", password="Secret123")
    make_user(mail="intruder@test.com", password="Secret123")
    owner_headers = login("owner@test.com", "Secret123")
    intruder_headers = login("intruder@test.com", "Secret123")

    created = client.post("/goals/", json=_goal_payload(), headers=owner_headers).json()

    assert client.get(f"/goals/{created['id']}", headers=intruder_headers).status_code == 404
    assert client.get("/goals/", headers=intruder_headers).json() == []
