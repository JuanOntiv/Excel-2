# Explicación detallada de archivos clave del backend

Este documento explica **qué hace, cómo funciona, y por qué se diseñó así** cada uno de los archivos más importantes del backend. No es solo una descripción de alto nivel: se explica función por función, decisión por decisión.

---

## `app/core/config.py`

### Qué hace
Es el único lugar de todo el proyecto donde se definen los parámetros de configuración. Cualquier otro archivo que necesite saber la URL de la base de datos, la clave secreta de JWT, o los tiempos de expiración, **los lee desde acá**, no los define por su cuenta.

### Cómo funciona

```python
class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+...")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
```

Cada atributo llama a `os.getenv("NOMBRE_VARIABLE", "valor_por_defecto")`. `os.getenv` lee una **variable de entorno** del sistema operativo. Si esa variable existe (porque la seteaste en el servidor), la usa. Si no existe (porque estás en desarrollo local y no la seteaste), usa el valor por defecto que está escrito en el código.

Los valores por defecto **nunca deben usarse en producción** — son solo para que el proyecto arranque sin configuración en desarrollo local. En particular, `JWT_SECRET_KEY = "dev-secret-change-me"` es públicamente conocida (está en el código fuente), así que cualquiera podría falsificar tokens si se usara en producción.

```python
@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

`@lru_cache` es un decorador de Python que hace que la función solo se ejecute **una vez** durante toda la vida del proceso, y a partir de ahí devuelva el mismo objeto en memoria. Sin esto, cada vez que se llamara a `get_settings()` se volvería a leer todas las variables de entorno desde el sistema operativo, lo cual es innecesario e ineficiente. Con `lru_cache`, se lee una sola vez al iniciar, y el objeto `Settings` vive en memoria durante toda la sesión.

La línea `settings = get_settings()` al final del archivo crea una instancia global que los demás archivos importan directamente:

```python
from app.core.config import settings
print(settings.JWT_SECRET_KEY)
```

### Decisión de diseño
Centralizar la configuración en un solo archivo tiene dos ventajas concretas: (1) si en algún momento querés cambiar el tiempo de expiración de los tokens, hay exactamente un lugar donde tocarlo; (2) si querés pasar de variables de entorno a un archivo `.env` (usando `python-dotenv`, por ejemplo), también hay exactamente un lugar donde hacer ese cambio.

---

## `app/db/db.py`

### Qué hace
Maneja la conexión a la base de datos: crea el engine (el objeto que representa la conexión), define cómo crear las tablas, y provee sesiones de base de datos a cada request.

### Cómo funciona

```python
engine = create_engine(settings.DATABASE_URL, echo=False)
```

`create_engine` crea el objeto de conexión de SQLAlchemy hacia la base de datos cuya URL viene de `config.py`. `echo=False` significa que SQLAlchemy **no imprime en la consola** todas las queries SQL que ejecuta — en desarrollo podés cambiarlo a `True` para ver exactamente qué SQL se genera, lo cual es útil para depurar.

```python
def init_db() -> None:
    SQLModel.metadata.create_all(engine)
```

`SQLModel.metadata` es un registro interno que SQLModel mantiene de todos los modelos que tienen `table=True`. `create_all(engine)` recorre ese registro y, para cada modelo, crea la tabla en la base de datos **si todavía no existe**. Si la tabla ya existe, no la toca (no borra ni modifica datos existentes). Esto se llama al iniciar la app (`main.py`) y también desde el script de seed.

```python
def get_session():
    with Session(engine) as session:
        yield session
```

Esta es una **función generadora** (tiene `yield` en vez de `return`). FastAPI la usa como dependencia inyectable: cuando un endpoint declara `session: Session = Depends(get_session)`, FastAPI llama a `get_session()`, ejecuta el código hasta el `yield`, entrega el objeto `session` al endpoint, y cuando el endpoint termina (con o sin error), continúa la ejecución después del `yield`. El bloque `with Session(engine) as session` garantiza que la sesión se cierra correctamente al final, sin importar si hubo excepción o no. De esta forma, cada request HTTP tiene su propia sesión aislada, y nunca hay riesgo de que dos requests compartan el mismo estado de base de datos.

### Decisión de diseño
`init_db()` con `create_all` es conveniente para desarrollo, pero **no es la solución para producción**. El problema es que si en el futuro agregás una columna a un modelo (por ejemplo, agregarle `is_verified` a `User`), `create_all` no va a modificar la tabla existente — simplemente la ignora porque ya existe. Para eso se necesita Alembic (migraciones versionadas), que está en la lista de pendientes del proyecto.

---

## `app/auth/dependencies.py`

### Qué hace
Define `get_current_user`, la función que actúa como **portero** de todas las rutas protegidas. Cualquier endpoint que requiera que el usuario esté logueado declara esta función como dependencia, y FastAPI la ejecuta automáticamente antes del endpoint.

### Cómo funciona

```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
```

`OAuth2PasswordBearer` es un helper de FastAPI que sabe cómo extraer el token del header `Authorization: Bearer <token>` de cada request. `tokenUrl` es solo informativo para la documentación automática de Swagger (`/docs`) — le dice a Swagger dónde está el endpoint de login para que el botón "Authorize" funcione.

```python
def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
```

FastAPI inyecta el token (extraído del header por `oauth2_scheme`) y una sesión de base de datos. La función tiene tres pasos:

**Paso 1 — Validar el token:**
```python
user_id = decode_access_token(token)
if user_id is None:
    raise credentials_exception
```
Llama a `decode_access_token` (en `auth/jwt.py`) que verifica la firma criptográfica del JWT y extrae el `user_id`. Si el token es inválido, está manipulado, o expiró, devuelve `None` y se levanta un error 401.

**Paso 2 — Verificar que el usuario todavía existe y está activo:**
```python
user = session.get(User, user_id)
if user is None or not user.is_active:
    raise credentials_exception
```
Aunque el token sea criptográficamente válido, se hace **siempre una consulta a la base de datos** para verificar que el usuario no fue desactivado desde que se emitió el token. Este es el punto clave: si un admin desactiva una cuenta, esa cuenta queda bloqueada en el próximo request, sin esperar a que el token expire.

**Paso 3 — Devolver el usuario:**
Si todo está bien, devuelve el objeto `User` completo, que queda disponible en el endpoint como `current_user`.

### Decisión de diseño
Hacer la consulta a BD en cada request tiene un costo de rendimiento pequeño pero real. La alternativa (no consultar la BD y solo validar la firma del JWT) es más rápida pero significa que una cuenta desactivada sigue funcionando hasta que expire su access token (hasta 15 minutos). Para una app de finanzas, con datos sensibles, el costo de la consulta vale la pena.

---

## `app/auth/dependencies_admin.py`

### Qué hace
Define `get_current_admin`, que extiende `get_current_user` añadiendo una verificación extra: que el usuario sea admin. Es el portero de las rutas de administración.

### Cómo funciona

```python
def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
```

FastAPI ejecuta primero `get_current_user` (token válido + cuenta activa), y si eso pasa, esta función verifica `is_admin`. Si no es admin, devuelve 403 (Forbidden, distinto de 401 Unauthorized: el usuario sí está autenticado, pero no tiene permiso para esto). Si es admin, devuelve el mismo objeto `User`.

La diferencia entre **401** y **403** es importante: 401 significa "no sé quién sos", 403 significa "sé quién sos pero no podés hacer esto".

### Decisión de diseño
Se decidió hacer este archivo separado de `dependencies.py` (en vez de agregar un parámetro `require_admin=True` a `get_current_user`) para que quede explícito en el código de cada ruta cuál es el nivel de acceso requerido. Al leer un endpoint, ver `Depends(get_current_admin)` vs `Depends(get_current_user)` comunica inmediatamente la intención, sin tener que buscar qué parámetros se pasaron.

---

## `app/scripts/seed_admin.py`

### Qué hace
Es el **único mecanismo en todo el sistema** para crear o promover un usuario a admin. No existe ningún endpoint HTTP que haga esto. Se ejecuta desde la línea de comandos con acceso directo al servidor.

### Cómo funciona

```python
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python -m app.scripts.seed_admin <mail>")
        sys.exit(1)
    promote_or_create_admin(sys.argv[1])
```

El bloque `if __name__ == "__main__"` ejecuta código **solo cuando el archivo se corre directamente** (no cuando se importa desde otro módulo). Lee el mail del primer argumento de línea de comandos (`sys.argv[1]`) y llama a la función principal.

```python
def promote_or_create_admin(mail: str) -> None:
    init_db()
    with Session(engine) as session:
        user = session.exec(select(User).where(User.mail == mail)).first()
```

Primero llama a `init_db()` para asegurarse de que las tablas existan (útil si se corre antes de iniciar la app por primera vez). Luego busca en la base de datos si ya existe un usuario con ese mail.

**Rama 1 — El usuario ya existe:**
```python
if user:
    if user.is_admin:
        print(f"El usuario '{mail}' ya es admin.")
        return
    user.is_admin = True
    session.add(user)
    session.commit()
```
Si ya es admin, no hace nada. Si no lo es, le setea `is_admin = True` y guarda el cambio.

**Rama 2 — El usuario no existe:**
```python
name = input("Nombre: ").strip()
password = getpass.getpass("Password: ").strip()
password_confirm = getpass.getpass("Confirmar password: ").strip()

if password != password_confirm:
    sys.exit(1)
```
Pide los datos interactivamente. `getpass.getpass` muestra el prompt pero **no muestra lo que se escribe** — como el input de contraseña en cualquier terminal. Esto es importante porque si usaras `input()` para la contraseña, quedaría visible en la pantalla y en cualquier log de terminal que alguien pueda estar mirando.

Se pide confirmación de contraseña para evitar errores de tipeo, que serían muy difíciles de recuperar para una cuenta admin.

### Decisión de diseño
Que la única forma de crear un admin sea un script que requiere acceso al servidor (no un endpoint HTTP) elimina completamente la superficie de ataque de "escalación de privilegios por API". No importa si hay un bug en el código de autenticación, un usuario malicioso nunca puede convertirse en admin sin acceso físico/SSH al servidor. Esta fue la razón concreta por la que se eligió este enfoque (Opción B) sobre permitir que un admin promueva a otros admins vía la API.

---

## `app/utils/password.py`

### Qué hace
Provee dos funciones para manejar contraseñas de forma segura: convertir una contraseña en texto plano a un hash irreversible, y verificar si una contraseña en texto plano corresponde a un hash guardado.

### Cómo funciona

```python
_MAX_PASSWORD_BYTES = 72

def hash_password(plain_password: str) -> str:
    password_bytes = plain_password.encode("utf-8")
    if len(password_bytes) > _MAX_PASSWORD_BYTES:
        raise ValueError(...)
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")
```

**Por qué el límite de 72 bytes:** bcrypt tiene una limitación interna — silenciosamente ignora todo lo que venga después del byte 72 de la contraseña. Esto significa que "micontraseña123AAAA...AAAA" y "micontraseña123BBBB...BBBB" (donde la diferencia está en el byte 73 en adelante) producirían **exactamente el mismo hash**. La validación explícita hace que el sistema lance un error en vez de comportarse de forma sorpresiva y silenciosa.

**El salt:** `bcrypt.gensalt()` genera una cadena aleatoria única por cada llamada. El salt se incorpora al hash resultante. Esto significa que dos usuarios con la misma contraseña van a tener hashes completamente distintos. La razón: sin salt, si dos usuarios tienen la misma contraseña, sus hashes serían iguales, y alguien que obtenga la base de datos podría darse cuenta ("estos dos usuarios tienen la misma contraseña") y atacar ambas cuentas a la vez con una sola operación.

```python
def verify_password(plain_password: str, password_hash: str) -> bool:
    password_bytes = plain_password.encode("utf-8")
    hash_bytes = password_hash.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hash_bytes)
```

`bcrypt.checkpw` hashea la contraseña con el mismo salt que está embebido en `password_hash` y compara el resultado. **Nunca se "desencripta" el hash** — bcrypt es una función de una sola vía. Lo que se hace es repetir el proceso de hasheo y comparar si el resultado es igual.

### Decisión de diseño
Se usa `bcrypt` directamente (sin `passlib`) porque `passlib`, la librería que el código viejo usaba, lleva años sin mantenimiento activo y tiene un bug de incompatibilidad con versiones modernas de `bcrypt` (falla en tiempo de ejecución). Detectado al correr el código por primera vez. En vez de buscar un workaround para `passlib`, se migró a `bcrypt` directamente, que es lo que `passlib` usaba internamente de todas formas.

---

## `app/utils/logs_decorator.py`

### Qué hace
Define `@log_action`, un decorador que se puede poner encima de cualquier función de endpoint y hace que, si la función termina con éxito, se guarde automáticamente un registro en la tabla `Logs`. Si la función lanza una excepción (por ejemplo, un `HTTPException` de validación), **no se guarda ningún log**.

### Cómo funciona

Un decorador en Python es una función que recibe otra función y devuelve una función modificada. La estructura de tres niveles de este decorador puede parecer confusa al principio, así que la explicamos paso a paso:

```python
def log_action(action, table=None, level=LogLevel.INFO):   # nivel 1: configura el decorador
    def decorator(func):                                     # nivel 2: recibe la funcion a decorar
        @wraps(func)
        def wrapper(*args, **kwargs):                        # nivel 3: la funcion que reemplaza a func
            result = func(*args, **kwargs)                   # ejecuta el endpoint original

            session = kwargs.get("session")
            current_user = kwargs.get("current_user")

            if session is not None:
                log_entry = Log(
                    user_id=current_user.id if current_user else None,
                    action=action,
                    level=level,
                    table=table,
                )
                session.add(log_entry)
                session.commit()

            return result
        return wrapper
    return decorator
```

Cuando escribís:
```python
@log_action(action=LogAction.CREATE, table="categories")
def create_category(category_data, session, current_user):
    ...
```

Python ejecuta `log_action(action=LogAction.CREATE, table="categories")` que devuelve `decorator`. Luego aplica `decorator(create_category)`, que devuelve `wrapper`. A partir de ahí, cada vez que alguien llama a `create_category(...)`, en realidad está llamando a `wrapper(...)`.

`wrapper` hace tres cosas en orden:
1. Ejecuta `func(*args, **kwargs)` — el endpoint original, con todos sus argumentos. Si esto lanza una excepción, se propaga hacia afuera y el código siguiente nunca se ejecuta (por eso los logs fallidos no se registran).
2. Si no hubo excepción, extrae `session` y `current_user` de los `kwargs` (los argumentos que FastAPI inyectó al endpoint via `Depends`). Los busca por nombre, no por posición.
3. Crea y guarda el registro en `Logs`.

`@wraps(func)` copia el nombre, docstring y otros metadatos de la función original a `wrapper`. Sin esto, FastAPI y las herramientas de debugging verían a todos los endpoints como funciones llamadas "wrapper", lo cual rompería el sistema de rutas.

### Decisión de diseño
La alternativa a un decorador sería llamar manualmente a `session.add(Log(...))` al final de cada endpoint. El problema es que eso significa que cada persona que escriba un endpoint nuevo tiene que acordarse de hacerlo, y si se olvida, ese endpoint queda sin auditoría sin ningún error visible. El decorador hace que sea imposible olvidarse: lo ponés una vez en el endpoint y el logging es automático.

---

## `app/services/wallet_assignment.py`

### Qué hace
Es el servicio central que mantiene sincronizada la tabla `transaction_wallets`. Cada vez que cambia algo relevante (una transacción, una regla), este servicio determina qué filas deben existir en `transaction_wallets` y actualiza la tabla en consecuencia.

### Cómo funciona: función por función

**`_rule_matches_transaction(rule, transaction) → bool`**

Evalúa si una wallet rule específica aplica a una transacción específica, según el `rule_type` de la regla:

- `CATEGORY`: compara `rule.category_id == transaction.category_id`. Si coinciden, matchea.
- `TRANSACTION_TYPE`: compara el valor string del tipo (`rule.transaction_type.value == transaction.type.value`) en vez de comparar los Enums directamente — esto es más robusto porque dos Enums del mismo valor pero de clases distintas pueden no ser iguales en Python.
- `KEYWORD`: convierte todo a minúsculas y busca si la keyword está contenida en el `name` O en la `description`. El `or ""` protege contra `None` (si el campo es null, `None.lower()` lanzaría excepción).
- `DATE_RANGE`: verifica que la fecha de la transacción caiga dentro del rango `[date_from, date_to]` inclusive.
- `AMOUNT_RANGE`: igual pero con el monto.

Si la regla está desactivada (`is_active=False`), devuelve `False` directamente sin siquiera evaluar el criterio.

**`set_manual_wallet(transaction, wallet_id, session)`**

Maneja la asignación manual (la que el usuario elige explícitamente):
1. Busca si ya existe una fila `Manual` en `transaction_wallets` para esta transacción.
2. Si existe, la borra con `session.delete()` + `session.flush()` (flush envía el DELETE a la BD dentro de la transacción activa, pero sin hacer commit todavía — importante para que el INSERT siguiente no viole el índice único que garantiza "máximo una asignación Manual por transacción").
3. Si `wallet_id` no es `None`, crea la fila nueva `Manual`.
4. Si `wallet_id` es `None`, no crea nada — el efecto es "quitar la asignación manual".

**`recalculate_rule_assignments_for_transaction(transaction, session)`**

Recalcula las asignaciones por regla para UNA transacción:
1. Borra todas las filas `Rule` existentes para esa transacción (sin tocar la `Manual`).
2. Carga todas las wallet rules activas del usuario.
3. Para cada regla, llama a `_rule_matches_transaction`. Si matchea, crea una fila nueva en `transaction_wallets`.

**`assign_wallets_for_transaction(transaction, session, manual_wallet_id, update_manual)`**

Es el **punto de entrada principal**, el que llaman los endpoints de `transactions` y `recurring_transactions`. Orquesta los dos pasos:
- Si `update_manual=True` (el default): llama a `set_manual_wallet` para actualizar/crear/borrar la asignación manual.
- Siempre: llama a `recalculate_rule_assignments_for_transaction` para refrescar las asignaciones por regla.
- Hace `commit()` al final para persistir todos los cambios.

El parámetro `update_manual=False` existe para el caso de editar una transacción sin mandar `wallet_id` en el body — en ese caso, el usuario no tocó la asignación manual (no mandó nada), así que no debemos modificarla.

**`recalculate_assignments_for_rule(rule, session)`**

Se llama cuando **cambia una regla** (se crea o se edita). A diferencia de la función anterior que trabaja sobre una transacción, esta trabaja sobre todas las transacciones del usuario:
1. Borra todas las filas de `transaction_wallets` que tengan `rule_id` igual a esta regla (independientemente de qué transacciones sean).
2. Si la regla está desactivada, termina ahí (commit y return).
3. Si está activa, carga **todas** las transacciones activas del usuario y evalúa la regla contra cada una. Genera las filas nuevas que correspondan.

**`remove_assignments_for_rule(rule_id, session)`**

El caso más simple: cuando se desactiva o borra una regla, solo hay que limpiar. No hace falta evaluar nada — simplemente borra todas las filas de `transaction_wallets` que referencien esa regla.

### Por qué `flush()` en vez de `commit()` dentro de las funciones internas

`session.flush()` envía los cambios a la base de datos dentro de la transacción activa (para que sean visibles en queries posteriores de la misma sesión), pero **sin hacer commit**. Si algo falla después, todo se puede revertir con un rollback. El `commit()` definitivo solo ocurre al final de `assign_wallets_for_transaction`, cuando todo el procesamiento terminó correctamente. Esto garantiza que nunca quedes con un estado parcial (ej. la manual actualizada pero las reglas a medio recalcular).

---

## `app/main.py`

### Qué hace
Es el **punto de entrada** de la aplicación. Define el objeto `app` de FastAPI, registra todas las rutas, y configura lo que debe ocurrir al iniciar el servidor.

### Cómo funciona

```python
app = FastAPI(title="Finanzas API", version="1.0.0")
```

Crea la aplicación FastAPI. `title` y `version` aparecen en la documentación automática de Swagger (`/docs`) — no afectan el funcionamiento, son solo informativos.

```python
@app.on_event("startup")
def on_startup():
    init_db()
```

`@app.on_event("startup")` registra una función que FastAPI ejecuta **una sola vez**, antes de empezar a aceptar requests, cuando el servidor arranca. `init_db()` crea las tablas que no existan todavía. Esto significa que al levantar el servidor por primera vez contra una base de datos vacía, las tablas se crean automáticamente sin tener que correr ningún comando extra.

```python
app.include_router(auth.router)
app.include_router(users.router)
# ... y los demas
```

`include_router` registra todas las rutas definidas en cada archivo de `routes/`. Cada archivo de rutas define un `APIRouter` con su prefijo (ej. `prefix="/users"`), y `include_router` lo añade a la app principal. El orden acá no afecta el funcionamiento, pero está puesto de lo más general (auth, users) a lo más específico.

```python
@app.get("/")
def root():
    return {"message": "Finanzas API running"}
```

Una ruta mínima en la raíz para verificar rápidamente que el servidor está vivo. Es lo que se llama un "health check" básico.

---

## `test_e2e.py`

### Qué hace
Prueba el sistema completo de extremo a extremo haciendo **requests HTTP reales** contra la app, simulando exactamente lo que haría el frontend. No prueba funciones de Python directamente — prueba el sistema como un todo, incluyendo autenticación, validaciones, lógica de negocio y base de datos.

### Cómo funciona: el setup

```python
os.environ["DATABASE_URL"] = "sqlite://"
```

Esta línea se ejecuta **antes de importar nada de la app**. Setea la variable de entorno que `config.py` va a leer, forzando que la app use SQLite en memoria en vez de Postgres. Funciona porque `os.environ` es global al proceso Python.

```python
from sqlalchemy.pool import StaticPool
import app.db.db as db_module

db_module.engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
```

SQLite en memoria (`sqlite://` sin nombre de archivo) normalmente crea una base de datos nueva por cada conexión y la descarta al cerrarla. Esto significa que si el `TestClient` abre una conexión para el primer request y otra para el segundo, serían dos bases de datos distintas y vacías — los datos del primer request desaparecerían. `StaticPool` hace que todas las conexiones del proceso compartan el mismo pool, efectivamente usando la misma base de datos en memoria durante toda la prueba. `check_same_thread=False` deshabilita una validación de SQLite que no permite usar la misma conexión desde múltiples threads — necesario porque FastAPI puede usar threads internamente.

Se reasigna `db_module.engine` directamente (en vez de usar `create_engine` desde cero) porque `db.py` ya había creado su propio engine al importarse. Al reemplazarlo aquí, cualquier código que haga `from app.db.db import engine` va a obtener este engine de SQLite.

```python
from app.main import app
from app.db.db import init_db
init_db()

client = TestClient(app)
```

Se importa la app **después** de parchear el engine. `init_db()` crea las tablas en el SQLite en memoria. `TestClient` es un cliente HTTP que FastAPI provee para pruebas: actúa exactamente como un cliente HTTP real (hace requests con headers, body, etc.) pero sin necesitar que el servidor esté levantado en un puerto real.

### Cómo funciona: la estructura de pruebas

El archivo prueba 21 escenarios en secuencia. Cada uno hace uno o más requests y verifica el resultado con `assert`:

```python
resp = client.post("/users/register", json={"name": "Ana", ...})
assert resp.status_code == 201
user_id = resp.json()["id"]
```

Si un `assert` falla, Python lanza `AssertionError` y el script termina ahí, mostrando en qué punto falló. Esto hace que los errores sean inmediatamente visibles.

Los escenarios están diseñados para cubrir los casos más importantes del diseño:

- **Escenarios 1-3:** flujo básico de registro y autenticación.
- **Escenarios 4-8:** el flujo central de wallets + reglas: se crea una regla que dice "categoría Comida → wallet Viajes 2026", y luego se crea una transacción con esa categoría; el test verifica que `transaction_wallets` efectivamente tenga la fila `Rule` generada automáticamente por el servicio.
- **Escenario 9:** validación cruzada de tipos — intentar crear una transacción `expense` con una categoría de tipo `income` debe devolver 400.
- **Escenarios 10-11:** recurrencias — se crea una recurrencia mensual, se ejecuta manualmente, y se verifica que `next_execution` avanzó correctamente de Junio a Julio, y que la transacción real se generó.
- **Escenarios 12-13:** rotación de refresh tokens — al hacer refresh, el token viejo queda inválido y el nuevo funciona.
- **Escenario 14:** los logs se generaron durante todo el flujo anterior vía el decorador.
- **Escenarios 15-21:** flujo completo de administración — usuario normal bloqueado, promoción a admin vía seed, operaciones de admin, y la protección de que un admin no puede desactivar a otro admin.

### Por qué este enfoque en vez de tests unitarios

Los tests unitarios prueban funciones aisladas. Los tests end-to-end prueban que **todas las piezas funcionen juntas**: que FastAPI inyecte las dependencias correctamente, que la autenticación bloquee lo que tiene que bloquear, que el servicio de wallets se dispare desde el endpoint correcto, que los datos persistan en la base de datos entre requests. Varios bugs reales se encontraron durante la construcción de estos tests (el timezone mismatch en los refresh tokens, el hard-delete sin cascada) precisamente porque se probaba el sistema completo, no funciones aisladas.
