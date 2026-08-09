import re

import bcrypt

_MAX_PASSWORD_BYTES = 72

# Símbolo = cualquier cosa que no sea letra ni dígito.
_SYMBOL_RE = re.compile(r"[^A-Za-z0-9]")


def validate_password_strength(password: str) -> None:
    """Valida que la contrasena cumpla la política mínima de fortaleza:
    al menos 8 caracteres, 1 mayúscula, 1 número y 1 símbolo.

    Lanza ValueError con un mensaje legible (en español) si no cumple. Las
    rutas lo convierten en HTTPException 400. No se aplica en login: los
    usuarios con contrasenas antiguas deben poder seguir entrando; solo se
    exige al FIJAR una contrasena nueva."""
    problems = []
    if len(password) < 8:
        problems.append("al menos 8 caracteres")
    if not any(c.isupper() for c in password):
        problems.append("una mayúscula")
    if not any(c.isdigit() for c in password):
        problems.append("un número")
    if not _SYMBOL_RE.search(password):
        problems.append("un símbolo")

    if problems:
        raise ValueError("La contraseña debe tener " + ", ".join(problems) + ".")


def hash_password(plain_password: str) -> str:
    password_bytes = plain_password.encode("utf-8")
    if len(password_bytes) > _MAX_PASSWORD_BYTES:
        raise ValueError(f"La contrasena no puede superar los {_MAX_PASSWORD_BYTES} bytes")

    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    password_bytes = plain_password.encode("utf-8")
    hash_bytes = password_hash.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hash_bytes)
