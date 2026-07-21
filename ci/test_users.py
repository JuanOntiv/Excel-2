"""Pruebas del ciclo de vida de un usuario normal: registro, perfil, cambio de
contrasena y desactivacion de la propia cuenta."""


def test_register_creates_user_and_default_wallet(client, login):
    resp = client.post(
        "/users/register",
        json={"name": "Nuevo", "mail": "nuevo@test.com", "password": "Secret123!"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["mail"] == "nuevo@test.com"
    assert body["is_admin"] is False
    assert body["is_active"] is True

    # El registro crea una wallet default; deberia poder loguear y listarla.
    headers = login("nuevo@test.com", "Secret123!")
    wallets = client.get("/wallets/", headers=headers)
    assert wallets.status_code == 200
    assert len(wallets.json()) >= 1


def test_register_duplicate_mail_400(client, make_user):
    make_user(mail="dup@test.com", password="Secret123")
    resp = client.post(
        "/users/register",
        json={"name": "Otro", "mail": "dup@test.com", "password": "Secret123"},
    )
    assert resp.status_code == 400


def test_update_profile(client, make_user, login):
    make_user(mail="a@test.com", password="Secret123", name="Ana")
    headers = login("a@test.com", "Secret123")
    resp = client.patch("/users/me", json={"name": "Ana Maria"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Ana Maria"


def test_change_password_flow(client, make_user, login):
    make_user(mail="a@test.com", password="OldPass123!")
    headers = login("a@test.com", "OldPass123!")

    resp = client.post(
        "/users/me/change-password",
        json={"current_password": "OldPass123!", "new_password": "NewPass123!"},
        headers=headers,
    )
    assert resp.status_code == 200

    # La contrasena vieja ya no sirve; la nueva si.
    assert client.post("/auth/login", data={"username": "a@test.com", "password": "OldPass123!"}).status_code == 401
    assert client.post("/auth/login", data={"username": "a@test.com", "password": "NewPass123!"}).status_code == 200


def test_change_password_wrong_current_400(client, make_user, login):
    make_user(mail="a@test.com", password="OldPass123!")
    headers = login("a@test.com", "OldPass123!")
    resp = client.post(
        "/users/me/change-password",
        json={"current_password": "WRONG", "new_password": "NewPass123!"},
        headers=headers,
    )
    assert resp.status_code == 400


def test_deactivate_own_account(client, make_user, login):
    make_user(mail="a@test.com", password="Secret123")
    headers = login("a@test.com", "Secret123")
    assert client.delete("/users/me", headers=headers).status_code == 200
    # Cuenta desactivada: ya no puede loguear.
    assert client.post("/auth/login", data={"username": "a@test.com", "password": "Secret123"}).status_code == 401
