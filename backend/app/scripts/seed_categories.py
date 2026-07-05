from sqlmodel import Session, select
from app.db.db import engine
from app.models.categories import Category, CategoryType

DEFAULT_CATEGORIES = [
    ("Salario", CategoryType.INCOME),
    ("Freelance", CategoryType.INCOME),
    ("Inversiones", CategoryType.INCOME),
    ("Otro ingreso", CategoryType.INCOME),
    ("Comida", CategoryType.EXPENSE),
    ("Transporte", CategoryType.EXPENSE),
    ("Vivienda", CategoryType.EXPENSE),
    ("Servicios", CategoryType.EXPENSE),
    ("Salud", CategoryType.EXPENSE),
    ("Entretenimiento", CategoryType.EXPENSE),
    ("Educación", CategoryType.EXPENSE),
    ("Otro gasto", CategoryType.EXPENSE),
]


def seed_categories():
    with Session(engine) as session:
        for name, cat_type in DEFAULT_CATEGORIES:
            existing = session.exec(
                select(Category).where(Category.name == name, Category.user_id == None)
            ).first()
            if existing:
                print(f"Ya existe: {name}, se omite.")
                continue

            session.add(Category(user_id=None, name=name, type=cat_type))
            print(f"Creada: {name} ({cat_type.value})")

        session.commit()
    print("Seed de categorías completado.")


if __name__ == "__main__":
    seed_categories()
