# Excel 2

Aplicación web de finanzas personales multiusuario: cada usuario gestiona sus propios ingresos, gastos, wallets (billeteras) con asignación automática por reglas, y transacciones recurrentes.


## Qué hace la app

- **Multiusuario**: cada persona tiene su propia cuenta, con sus propios datos completamente aislados del resto.
- **Transacciones**: registro unificado de ingresos y gastos, categorizados.
- **Categorías**: algunas son globales (disponibles para todos), otras privadas (creadas por cada usuario).
- **Wallets**: además de un wallet "default" que siempre contiene absolutamente todo, el usuario puede crear wallets custom (ej. "Viajes 2026", "Ahorro emergencia") y definir **reglas** que asignan transacciones a esos wallets automáticamente — por categoría, tipo de transacción, palabra clave, rango de fechas, o rango de montos. Una transacción puede vivir en varios wallets a la vez.
- **Transacciones recurrentes**: suscripciones, sueldos, alquileres — cualquier cosa que se repita en el tiempo (diario, semanal, quincenal, mensual, anual), con la opción de que se generen solas o de requerir confirmación manual cada vez.
- **Administración**: un rol de admin acotado (gestionado solo por línea de comandos, nunca desde la app) puede ver y moderar cuentas de usuario.



## Instalacion
Se recomienda usar un entorno virtual:

```bash
python -m venv .venv

source .venv/bin/activate
# Windows (PowerShell)
.venv\Scripts\Activate.ps1
```


## Iniciar
Ejecuta:

```bash
cd docker
docker compose up --build

En caso de haber una migracion nueva:

docker exec -it nombre_contenedor bash
alembic upgrade head
```
