"""Pruebas de autenticacion: login (form-encoded), rechazo de credenciales
invalidas, proteccion de rutas y rotacion de refresh tokens."""
from uuid import UUID

from app.models import User


def test_login_success_returns_tokens(client, make_user):
    make_user(mail="a@test.com", password="Secret123")
    resp = client.post("/auth/login", data={"username": "a@test.com", "password": "Secret123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["token_type"] == "bearer"


def test_login_wrong_password_401(client, make_user):
    make_user(mail="a@test.com", password="Secret123")
    resp = client.post("/auth/login", data={"username": "a@test.com", "password": "wrong"})
    assert resp.status_code == 401


def test_login_unknown_user_401(client):
    resp = client.post("/auth/login", data={"username": "ghost@test.com", "password": "x"})
    assert resp.status_code == 401


def test_login_inactive_user_401(client, make_user):
    make_user(mail="off@test.com", password="Secret123", is_active=False)
    resp = client.post("/auth/login", data={"username": "off@test.com", "password": "Secret123"})
    assert resp.status_code == 401


def test_protected_route_requires_token(client):
    assert client.get("/users/me").status_code == 401


def test_protected_route_rejects_garbage_token(client):
    resp = client.get("/users/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


def test_me_with_valid_token(client, make_user, login):
    make_user(mail="a@test.com", password="Secret123", name="Ana")
    headers = login("a@test.com", "Secret123")
    resp = client.get("/users/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["mail"] == "a@test.com"
    assert resp.json()["name"] == "Ana"


def test_refresh_rotates_token(client, make_user):
    make_user(mail="a@test.com", password="Secret123")
    tokens = client.post("/auth/login", data={"username": "a@test.com", "password": "Secret123"}).json()
    old_refresh = tokens["refresh_token"]

    resp = client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 200
    new_refresh = resp.json()["refresh_token"]
    assert new_refresh != old_refresh

    # El refresh viejo ya fue rotado (revocado): reintentarlo debe fallar.
    reused = client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert reused.status_code == 401


def test_refresh_with_invalid_token_401(client):
    resp = client.post("/auth/refresh", json={"refresh_token": "bogus"})
    assert resp.status_code == 401


# ---------- La sesion sigue el estado de la cuenta ----------
# Un refresh token vivo no basta: si la cuenta dejo de estar activa (o cambio
# la contrasena), renovar tiene que fallar. Antes /auth/refresh solo miraba la
# fila del token, asi que una cuenta dada de baja seguia emitiendo access
# tokens hasta 30 dias y el frontend nunca mandaba al usuario a login.

def _refresh(client, refresh_token):
    return client.post("/auth/refresh", json={"refresh_token": refresh_token})


def _set_active(db_session, user_id, is_active):
    user = db_session.get(User, UUID(user_id))
    user.is_active = is_active
    db_session.add(user)
    db_session.commit()


def test_refresh_rejected_when_account_is_deactivated(client, make_user, db_session):
    user = make_user(mail="a@test.com", password="Secret123")
    tokens = client.post("/auth/login", data={"username": "a@test.com", "password": "Secret123"}).json()

    # La baja se hace directamente en BD para aislar el guard de /auth/refresh
    # de si el endpoint de baja revoca o no (eso se prueba aparte, mas abajo).
    _set_active(db_session, user["id"], False)

    assert _refresh(client, tokens["refresh_token"]).status_code == 401


def test_refresh_of_deactivated_account_revokes_the_whole_family(client, make_user, db_session):
    """El 401 ademas revoca los tokens del usuario: si solo rechazara, el
    cliente seguiria reintentando (y rotando) en cada peticion."""
    user = make_user(mail="a@test.com", password="Secret123")
    tokens = client.post("/auth/login", data={"username": "a@test.com", "password": "Secret123"}).json()

    _set_active(db_session, user["id"], False)
    assert _refresh(client, tokens["refresh_token"]).status_code == 401

    # Reactivar la cuenta no resucita la sesion vieja: hay que loguear de nuevo.
    _set_active(db_session, user["id"], True)
    assert _refresh(client, tokens["refresh_token"]).status_code == 401


def test_deactivating_own_account_revokes_refresh_tokens(client, make_user):
    make_user(mail="a@test.com", password="Secret123")
    tokens = client.post("/auth/login", data={"username": "a@test.com", "password": "Secret123"}).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    assert client.delete("/users/me", headers=headers).status_code == 200
    assert _refresh(client, tokens["refresh_token"]).status_code == 401


def test_admin_deactivation_revokes_user_refresh_tokens(client, make_user, login):
    victim = make_user(mail="v@test.com", password="Secret123")
    make_user(mail="root@test.com", password="Secret123", is_admin=True)
    victim_tokens = client.post("/auth/login", data={"username": "v@test.com", "password": "Secret123"}).json()
    admin_headers = login("root@test.com", "Secret123")

    assert client.delete(f"/users/{victim['id']}/deactivate", headers=admin_headers).status_code == 200
    assert _refresh(client, victim_tokens["refresh_token"]).status_code == 401


def test_change_password_revokes_every_session(client, make_user):
    """Caso de uso real: "creo que alguien entro a mi cuenta". Dejar vivos los
    refresh tokens ya emitidos no echaria al intruso, asi que caen todos,
    incluida la sesion que hizo el cambio."""
    make_user(mail="a@test.com", password="OldPass123!")
    first = client.post("/auth/login", data={"username": "a@test.com", "password": "OldPass123!"}).json()
    second = client.post("/auth/login", data={"username": "a@test.com", "password": "OldPass123!"}).json()

    resp = client.post(
        "/users/me/change-password",
        json={"current_password": "OldPass123!", "new_password": "NewPass123!"},
        headers={"Authorization": f"Bearer {first['access_token']}"},
    )
    assert resp.status_code == 200

    assert _refresh(client, first["refresh_token"]).status_code == 401
    assert _refresh(client, second["refresh_token"]).status_code == 401


# ---------- Rate limiting de login ----------

def test_login_blocked_after_max_failed_attempts(client, make_user):
    make_user(mail="a@test.com", password="Secret123!")

    # El limite por defecto es 5 intentos; los 5 primeros fallos dan 401.
    for _ in range(5):
        r = client.post("/auth/login", data={"username": "a@test.com", "password": "wrong"})
        assert r.status_code == 401

    # El 6to intento se bloquea con 429 y expone Retry-After. El primer bloqueo
    # es el escalon mas bajo del backoff (1 min por defecto).
    blocked = client.post("/auth/login", data={"username": "a@test.com", "password": "wrong"})
    assert blocked.status_code == 429
    headers = {k.lower(): v for k, v in blocked.headers.items()}
    assert "retry-after" in headers
    assert 0 < int(headers["retry-after"]) <= 61

    # Estando bloqueado, ni siquiera las credenciales correctas pasan.
    correct = client.post("/auth/login", data={"username": "a@test.com", "password": "Secret123!"})
    assert correct.status_code == 429


def test_lockout_is_per_account_not_global(client, make_user):
    """Regresion: el limiter iba por IP, y detras de un proxy todos los usuarios
    comparten IP, asi que un solo usuario fallando bloqueaba el login de todos."""
    make_user(mail="a@test.com", password="Secret123!")
    make_user(mail="b@test.com", password="Secret123!")

    for _ in range(5):
        client.post("/auth/login", data={"username": "a@test.com", "password": "wrong"})
    assert client.post(
        "/auth/login", data={"username": "a@test.com", "password": "Secret123!"}
    ).status_code == 429

    # La otra cuenta, desde la misma IP, entra sin problema.
    assert client.post(
        "/auth/login", data={"username": "b@test.com", "password": "Secret123!"}
    ).status_code == 200


def test_lockout_key_is_normalized(client, make_user):
    """Variar mayusculas/espacios no debe servir para esquivar el bloqueo."""
    make_user(mail="a@test.com", password="Secret123!")

    for _ in range(5):
        client.post("/auth/login", data={"username": "a@test.com", "password": "wrong"})

    blocked = client.post("/auth/login", data={"username": " A@Test.com ", "password": "wrong"})
    assert blocked.status_code == 429


def test_unknown_email_is_also_rate_limited(client):
    """Los correos inexistentes cuentan igual: si no, recibir 401 en vez de 429
    delataria que correos estan registrados (enumeracion de usuarios)."""
    for _ in range(5):
        r = client.post("/auth/login", data={"username": "ghost@test.com", "password": "wrong"})
        assert r.status_code == 401

    assert client.post(
        "/auth/login", data={"username": "ghost@test.com", "password": "wrong"}
    ).status_code == 429


def test_successful_login_resets_attempt_counter(client, make_user):
    make_user(mail="a@test.com", password="Secret123!")

    # 4 fallos: por debajo del limite, aun no bloquea.
    for _ in range(4):
        assert client.post("/auth/login", data={"username": "a@test.com", "password": "wrong"}).status_code == 401

    # Un login correcto limpia el contador de esa IP.
    assert client.post("/auth/login", data={"username": "a@test.com", "password": "Secret123!"}).status_code == 200

    # Vuelvo a tener el cupo completo: otros 4 fallos no bloquean.
    for _ in range(4):
        assert client.post("/auth/login", data={"username": "a@test.com", "password": "wrong"}).status_code == 401
    assert client.post("/auth/login", data={"username": "a@test.com", "password": "Secret123!"}).status_code == 200
