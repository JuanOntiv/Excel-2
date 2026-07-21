"""Pruebas de la política de fortaleza de contraseña: se exige al FIJAR una
contrasena (registro, cambio propio, reset de admin), no al iniciar sesion."""
import pytest


# Cada una falla una sola regla (todas las demas cumplen).
WEAK_PASSWORDS = [
    "Ab1!xy",       # 6 caracteres: demasiado corta
    "lowercase1!",  # sin mayuscula
    "NoDigits!!",   # sin numero
    "NoSymbol123",  # sin simbolo
]

STRONG = "Strong1!pass"


@pytest.mark.parametrize("pw", WEAK_PASSWORDS)
def test_register_rejects_weak_password(client, pw):
    resp = client.post(
        "/users/register",
        json={"name": "X", "mail": "weak@test.com", "password": pw},
    )
    assert resp.status_code == 400


def test_register_accepts_strong_password(client):
    resp = client.post(
        "/users/register",
        json={"name": "X", "mail": "strong@test.com", "password": STRONG},
    )
    assert resp.status_code == 201


def test_change_password_rejects_weak(client, make_user, login):
    make_user(mail="a@test.com", password="Secret123!")
    headers = login("a@test.com", "Secret123!")
    resp = client.post(
        "/users/me/change-password",
        json={"current_password": "Secret123!", "new_password": "weakpass"},
        headers=headers,
    )
    assert resp.status_code == 400


def test_admin_reset_rejects_weak(client, admin, admin_headers, make_user):
    victim = make_user(mail="b@test.com", password="Secret123!")
    resp = client.post(
        f"/users/{victim['id']}/reset-password",
        json={"new_password": "weakpass"},
        headers=admin_headers,
    )
    assert resp.status_code == 400


def test_validate_password_strength_unit():
    """Prueba directa del validador, independiente de la capa HTTP."""
    from app.utils.password import validate_password_strength

    # Valida sin lanzar.
    validate_password_strength("Strong1!pass")

    for weak in WEAK_PASSWORDS:
        with pytest.raises(ValueError):
            validate_password_strength(weak)
