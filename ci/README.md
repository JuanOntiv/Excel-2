# CI — Pruebas automatizadas

Suite de pruebas de integracion del backend (FastAPI + SQLModel), pensada para
correr en GitHub Actions (`.github/workflows/ci.yml`) y tambien en local.

## Que cubre

| Archivo          | Cobertura |
|------------------|-----------|
| `test_auth.py`   | Login form-encoded, rechazo de credenciales, proteccion de rutas, rotacion de refresh tokens |
| `test_users.py`  | Registro (+ wallet default), perfil, cambio de contrasena, desactivacion propia |
| `test_admin.py`  | Control de acceso `is_admin`, listar/desactivar/reactivar/reset-password, hard-delete con cascada |
| `test_goals.py`  | CRUD de metas, validacion de periodo, soft-delete, calculo de avance con transacciones reales |

## Requisitos

- Python 3.11
- Un Postgres accesible. Las pruebas usan un **Postgres real** (no SQLite) a
  proposito: el proyecto ya fue mordido por diferencias especificas de Postgres
  (tipos ENUM, UUID).

La URL se toma de `DATABASE_URL`; si no se define, usa
`postgresql+psycopg2://postgres:postgres@localhost:5432/finanzas_test`.

> ⚠️ La suite hace `TRUNCATE` de todas las tablas entre tests y `DROP` del
> esquema al final. **Apunta siempre a una base de datos de pruebas dedicada**,
> nunca a una con datos reales.

## Correr en local

```bash
# 1) Levantar un Postgres de pruebas (ejemplo con docker)
docker run --rm -d --name finanzas_test_db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=finanzas_test \
  -p 5432:5432 postgres:15-alpine

# 2) Instalar dependencias
pip install -r backend/requirements.txt -r ci/requirements-test.txt

# 3) Correr la suite
DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5432/finanzas_test" \
  pytest ci -v
```

En CI todo esto lo hace el workflow automaticamente.
