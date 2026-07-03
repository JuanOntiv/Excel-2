
"""
Script de seed para crear o promover un usuario admin.

Esta es la UNICA forma de otorgar privilegios de admin en todo el
sistema. No existe ningun endpoint HTTP que permita hacerlo, a
proposito: evita que una cuenta comprometida pueda escalar privilegios
o crear admins en cadena.

Uso:
    python -m app.scripts.seed_admin ana@test.com

Si el mail ya existe, lo promueve a admin (is_admin=True).
Si no existe, pide los datos y crea el usuario directamente como admin.
"""
import sys
import getpass

from sqlmodel import Session, select

from app.db.db import engine, init_db
from app.models.users import User
from app.utils.password import hash_password


def promote_or_create_admin(mail: str) -> None:
    init_db()

    with Session(engine) as session:
        user = session.exec(select(User).where(User.mail == mail)).first()

        if user:
            if user.is_admin:
                print(f"El usuario '{mail}' ya es admin. Nada que hacer.")
                return
            user.is_admin = True
            session.add(user)
            session.commit()
            print(f"Usuario '{mail}' promovido a admin correctamente.")
            return

        print(f"No existe un usuario con mail '{mail}'. Se creara uno nuevo como admin.")
        name = input("Nombre: ").strip()
        password = getpass.getpass("Password: ").strip()
        password_confirm = getpass.getpass("Confirmar password: ").strip()

        if password != password_confirm:
            print("Las contrasenas no coinciden. Abortado.")
            sys.exit(1)

        new_admin = User(
            name=name,
            mail=mail,
            password_hash=hash_password(password),
            is_admin=True,
        )
        session.add(new_admin)
        session.commit()
        print(f"Usuario admin '{mail}' creado correctamente.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python -m app.scripts.seed_admin <mail>")
        sys.exit(1)

    promote_or_create_admin(sys.argv[1])
