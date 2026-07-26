"""Pruebas de autenticacion: login (form-encoded), rechazo de credenciales
invalidas, proteccion de rutas y rotacion de refresh tokens."""


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


# ---------- Rate limiting de login ----------

def test_login_blocked_after_max_failed_attempts(client, make_user):
    make_user(mail="a@test.com", password="Secret123!")

    # El limite por defecto es 5 intentos; los 5 primeros fallos dan 401.
    for _ in range(5):
        r = client.post("/auth/login", data={"username": "a@test.com", "password": "wrong"})
        assert r.status_code == 401

    # El 6to intento se bloquea con 429 y expone Retry-After.
    blocked = client.post("/auth/login", data={"username": "a@test.com", "password": "wrong"})
    assert blocked.status_code == 429
    assert "retry-after" in {k.lower() for k in blocked.headers}

    # Estando bloqueado, ni siquiera las credenciales correctas pasan.
    correct = client.post("/auth/login", data={"username": "a@test.com", "password": "Secret123!"})
    assert correct.status_code == 429


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
