"""
Crea UN usuario de demo completo (>= 100 transacciones) y al final imprime sus
credenciales de acceso.

A diferencia de `seed_demo_users.py` (dos usuarios, ~56 transacciones), este
script apunta a un solo usuario "de prueba total": datos suficientes para que
todas las vistas del frontend tengan algo que mostrar y para que toda la lógica
de negocio del backend se ejercite de verdad.

Qué crea:
  - Categorías: usa las GLOBALES ya existentes (user_id = null) y además crea
    propias. Si no hay globales en la BD, cae de vuelta a crearlas como propias
    y lo avisa (corre `python -m app.scripts.seed_categories` para tenerlas).
  - Preferencias de categoría: colores custom (incluida una global) y una oculta.
  - Wallets: 5 propias + la default que crea el registro.
  - Wallet rules: los 5 rule_type.
  - Transacciones: >= 100 (por defecto 140) repartidas en ~15 meses, ingresos y
    gastos, con y sin descripción, con y sin asignación manual de wallet.
  - Metas: los 3 goal_type, con y sin scope (wallet/categoría), en periodos
    pasado / actual / futuro, más una cancelada.
  - Recurrentes: las 5 frecuencias, ambos tipos, auto_execute true y false,
    una pausada, y se corre execute-pending (lo mismo que hace el login).

Uso:
    python3 seed_demo_user.py
    python3 seed_demo_user.py --transactions 250 --mail juan.demo@finanzas.test

Requisitos: backend levantado en http://localhost:8000 (o env API_URL / --api).
"""
import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

API = os.getenv("API_URL", "http://localhost:8000")
TIMEOUT = 90          # el free tier de Render tarda en despertar
RETRIES = 4           # reintentos ante fallos transitorios (cold start / 5xx)

# Códigos que valen la pena reintentar: son el servicio despertando o un
# proxy sin backend detrás, no un error del payload que mandamos.
_RETRYABLE = {502, 503, 504}


# --------------------------------------------------------------------------
# Helpers HTTP (stdlib, sin dependencias externas)
# --------------------------------------------------------------------------
def _request_once(method, path, token=None, json_body=None, form_body=None):
    url = f"{API}{path}"
    headers = {}
    data = None
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif form_body is not None:
        data = urllib.parse.urlencode(form_body).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, (json.loads(body) if body else None)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = body
        return e.code, parsed


def _request(method, path, token=None, json_body=None, form_body=None):
    """Igual que _request_once pero reintentando lo transitorio con backoff.
    Contra Render esto no es opcional: el servicio duerme, así que la primera
    petición de la corrida (y alguna suelta después) puede tardar o dar 502."""
    delay = 3
    last = None
    for attempt in range(1, RETRIES + 1):
        try:
            status, data = _request_once(method, path, token, json_body, form_body)
            if status not in _RETRYABLE:
                return status, data
            last = f"{status}: {data}"
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last = str(e)
        if attempt < RETRIES:
            print(f"    ↻ {method} {path} falló ({last}); reintento en {delay}s…", flush=True)
            time.sleep(delay)
            delay *= 2
    raise RuntimeError(f"{method} {path} falló tras {RETRIES} intentos -> {last}")


def wake_up():
    """Despierta el servicio antes de empezar. Sin esto, el primer POST real
    se comería el cold start y sería más difícil distinguir un servicio
    dormido de una URL equivocada."""
    print(f"Contactando {API} …", flush=True)
    status, _ = _request("GET", "/")
    if status >= 400:
        raise RuntimeError(f"El backend respondió {status} en GET / — ¿es la URL correcta?")
    print("  backend despierto ✓")


def post(path, token=None, body=None):
    status, data = _request("POST", path, token=token, json_body=body)
    if status >= 400:
        raise RuntimeError(f"POST {path} -> {status}: {data}")
    return data


def patch(path, token=None, body=None):
    status, data = _request("PATCH", path, token=token, json_body=body)
    if status >= 400:
        raise RuntimeError(f"PATCH {path} -> {status}: {data}")
    return data


def get(path, token=None):
    status, data = _request("GET", path, token=token)
    if status >= 400:
        raise RuntimeError(f"GET {path} -> {status}: {data}")
    return data


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
def register(name, mail, password):
    """Devuelve True si se creó, False si el mail ya estaba registrado."""
    status, data = _request(
        "POST", "/users/register", json_body={"name": name, "mail": mail, "password": password}
    )
    if status == 201:
        return True
    if status == 400 and "already registered" in str(
        data.get("detail", "") if isinstance(data, dict) else data
    ):
        return False
    raise RuntimeError(f"register {mail} -> {status}: {data}")


def register_fresh(name, mail, password):
    """Registra `mail`; si ya existe, prueba demo2@, demo3@... hasta encontrar
    uno libre. Se busca un usuario NUEVO a propósito: sembrar encima de uno ya
    poblado duplicaría categorías, wallets y reglas."""
    local, _, domain = mail.partition("@")
    for attempt in range(1, 51):
        candidate = mail if attempt == 1 else f"{local}{attempt}@{domain}"
        if register(name, candidate, password):
            return candidate
        print(f"  · {candidate} ya existe, probando el siguiente…")
    raise RuntimeError("No se encontró un correo libre tras 50 intentos")


def login(mail, password):
    status, data = _request(
        "POST", "/auth/login", form_body={"username": mail, "password": password}
    )
    if status != 200:
        raise RuntimeError(f"login {mail} -> {status}: {data}")
    return data["access_token"]


# --------------------------------------------------------------------------
# Datos de demo
# --------------------------------------------------------------------------
TODAY = date.today()


def iso_dt(d):
    return f"{d.isoformat()}T12:00:00"


def months_ago(n):
    """Primer día del mes n meses atrás."""
    month = TODAY.month - n
    year = TODAY.year
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1)


def month_iter(start, end):
    """Itera (year, month) desde `start` hasta `end`, ambos inclusive."""
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        yield y, m
        m += 1
        if m > 12:
            m = 1
            y += 1


def day_in_month(year, month, day):
    """Fecha segura dentro del mes, recortada a hoy si cae en el futuro."""
    for candidate in range(day, 0, -1):
        try:
            d = date(year, month, candidate)
            break
        except ValueError:
            continue
    return min(d, TODAY)


# Categorías PROPIAS del usuario (las globales se reutilizan tal cual).
OWN_CATEGORIES = [
    ("Mascotas", "expense"),
    ("Suscripciones", "expense"),
    ("Regalos", "both"),
    ("Café de especialidad", "expense"),
    ("Ingresos varios", "income"),
    ("Categoría archivada (demo)", "expense"),  # se oculta vía preferencias
]

# (nombre, categoría, tipo de categoría esperado, rango de monto)
# Los nombres de categoría que existen en el seed global se resuelven contra
# las globales; el resto son propias. Ver resolve_category().
EXPENSE_TEMPLATES = [
    ("Súper de la semana", "Comida", (450, 1600)),
    ("Comida rápida", "Comida", (90, 340)),
    ("Restaurante con amigos", "Comida", (250, 900)),
    ("Uber al trabajo", "Transporte", (60, 260)),
    ("Uber nocturno", "Transporte", (90, 400)),
    ("Gasolina", "Transporte", (500, 1300)),
    ("Recarga de transporte público", "Transporte", (50, 220)),
    ("Recibo de luz (CFE)", "Servicios", (380, 1400)),
    ("Internet", "Servicios", (450, 700)),
    ("Agua", "Servicios", (150, 420)),
    ("Teléfono", "Servicios", (200, 600)),
    ("Netflix", "Suscripciones", (219, 299)),
    ("Spotify", "Suscripciones", (115, 199)),
    ("Cine", "Entretenimiento", (120, 420)),
    ("Concierto", "Entretenimiento", (600, 2800)),
    ("Videojuego", "Entretenimiento", (300, 1500)),
    ("Consulta médica", "Salud", (500, 1800)),
    ("Farmacia", "Salud", (90, 700)),
    ("Curso en línea", "Educación", (300, 2500)),
    ("Libros", "Educación", (180, 900)),
    ("Ropa", "Vestimenta", (300, 2200)),
    ("Tenis nuevos", "Vestimenta", (900, 3200)),
    ("Vuelo", "Viajes", (1800, 7500)),
    ("Hotel", "Viajes", (1200, 5000)),
    ("Croquetas y veterinario", "Mascotas", (300, 2000)),
    ("Café de especialidad", "Café de especialidad", (60, 180)),
    ("Regalo de cumpleaños", "Regalos", (200, 1500)),
    ("Artículos de limpieza", "Vivienda", (120, 520)),
    ("Reparación menor", "Vivienda", (200, 1800)),
    ("Gasto varios", "Otro gasto", (80, 900)),
]

INCOME_TEMPLATES = [
    ("Proyecto freelance", "Freelance", (2500, 9000)),
    ("Anticipo de cliente", "Freelance", (1500, 5000)),
    ("Dividendos", "Inversiones", (300, 2500)),
    ("Venta de garaje", "Ingresos varios", (300, 1900)),
    ("Reembolso", "Otro ingreso", (200, 1500)),
    ("Bono", "Salario", (2000, 8000)),
]


def build_category_index(token):
    """Devuelve (por_nombre, globales, propias). El índice mezcla globales y
    propias: `resolve_category` prefiere la global cuando existe, para que la
    demo ejercite ambos orígenes (gotcha #7: las globales son compartidas)."""
    cats = get("/categories/?include_hidden=true", token)
    globals_ = {c["name"]: c for c in cats if c["user_id"] is None}
    own = {c["name"]: c for c in cats if c["user_id"] is not None}
    return globals_, own


def seed(args):
    name, mail, password = args.name, args.mail, args.password

    wake_up()
    mail = register_fresh(name, mail, password)
    token = login(mail, password)
    print(f"Usuario creado: {name} <{mail}>")

    # ---- Categorías: globales existentes + propias ----
    global_cats, _ = build_category_index(token)
    if not global_cats:
        print(
            "  ⚠ No hay categorías globales en la BD. Se crearán todas como propias.\n"
            "    Para tener globales: docker compose exec backend python -m app.scripts.seed_categories"
        )
    for cname, ctype in OWN_CATEGORIES:
        post("/categories/", token, {"name": cname, "type": ctype})

    global_cats, own_cats = build_category_index(token)
    fallback_created = []

    def resolve_category(cat_name, needed_type):
        """id de la categoría por nombre. Si no existe ni como global ni como
        propia (BD sin seed de globales), la crea como propia."""
        for source in (global_cats, own_cats):
            if cat_name in source:
                return source[cat_name]["id"]
        created = post("/categories/", token, {"name": cat_name, "type": needed_type})
        own_cats[cat_name] = created
        fallback_created.append(cat_name)
        return created["id"]

    # ---- Preferencias por categoría (color propio + una oculta) ----
    # El color vive en user_category_preferences, no en la categoría: por eso
    # se puede pintar una GLOBAL sin afectar a los demás usuarios (gotcha #7).
    colors = [("Comida", "#e07a5f"), ("Transporte", "#3d5a80"), ("Mascotas", "#8a5cf6")]
    colored = 0
    for cat_name, color in colors:
        target = global_cats.get(cat_name) or own_cats.get(cat_name)
        if target:
            patch(f"/categories/{target['id']}/preferences", token, {"color": color})
            colored += 1
    hidden = own_cats.get("Categoría archivada (demo)")
    if hidden:
        patch(f"/categories/{hidden['id']}/preferences", token, {"is_hidden": True})

    print(
        f"  categorías: {len(global_cats)} globales reutilizadas, "
        f"{len(own_cats)} propias · {colored} con color, 1 oculta"
    )

    # ---- Wallets ----
    wallet_defs = [
        ("Efectivo", "Gastos en efectivo del día a día"),
        ("Tarjeta de crédito", "Movimientos de la TDC"),
        ("Ahorros", "Fondo de ahorro e ingresos"),
        ("Viajes", "Gastos de viajes y salidas"),
        ("Casa", "Gastos del hogar y servicios"),
    ]
    wallets = {}
    for wname, wdesc in wallet_defs:
        wallets[wname] = post("/wallets/", token, {"name": wname, "description": wdesc})["id"]
    print(f"  wallets: {len(wallets)} propias (+ la default 'General')")

    # ---- Wallet rules: los 5 rule_type ----
    # Se crean ANTES de las transacciones a propósito: así cada POST las evalúa
    # en caliente y no hay que recalcular sobre un histórico ya grande.
    rules = [
        {"wallet_id": wallets["Casa"], "rule_type": "Category",
         "category_id": resolve_category("Servicios", "expense")},
        {"wallet_id": wallets["Ahorros"], "rule_type": "TransactionType",
         "transaction_type": "income"},
        {"wallet_id": wallets["Tarjeta de crédito"], "rule_type": "Keyword", "keyword": "netflix"},
        {"wallet_id": wallets["Viajes"], "rule_type": "Keyword", "keyword": "uber"},
        {"wallet_id": wallets["Ahorros"], "rule_type": "AmountRange",
         "amount_from": 6000, "amount_to": 1000000},
        {"wallet_id": wallets["Viajes"], "rule_type": "DateRange",
         "date_from": months_ago(3).isoformat(), "date_to": (months_ago(2) - timedelta(days=1)).isoformat()},
    ]
    for r in rules:
        post("/wallet-rules/", token, r)
    print(f"  wallet rules: {len(rules)} (los 5 tipos)")

    # ---- Transacciones ----
    target_total = max(100, args.transactions)
    start_month = months_ago(14)
    wallet_ids = list(wallets.values())
    created = 0

    def make_transaction(nm, cat_name, ttype, amount, d, force_wallet=None):
        nonlocal created
        body = {
            "name": nm,
            "amount": amount,
            "date": iso_dt(d),
            "type": ttype,
            "category_id": resolve_category(
                cat_name, "income" if ttype == "income" else "expense"
            ),
        }
        # ~60% con descripción: el resto ejercita el caso description = null.
        if random.random() < 0.6:
            body["description"] = f"{nm} — movimiento de demo"
        # ~30% con asignación MANUAL de wallet; el resto queda solo con lo que
        # deriven las reglas (gotcha #16: wallet_id vs wallet_ids).
        if force_wallet:
            body["wallet_id"] = force_wallet
        elif random.random() < 0.3:
            body["wallet_id"] = random.choice(wallet_ids)
        post("/transactions/", token, body)
        created += 1
        if created % 20 == 0:
            print(f"    … {created} transacciones", flush=True)

    # Base mensual: sueldo + renta en cada mes, para que las gráficas de
    # tendencia y los totales por periodo tengan una línea de fondo estable.
    for year, month in month_iter(start_month, TODAY):
        make_transaction("Salario", "Salario", "income",
                         round(random.uniform(15000, 19000), 2),
                         day_in_month(year, month, 5),
                         force_wallet=wallets["Ahorros"])
        make_transaction("Renta del departamento", "Vivienda", "expense",
                         6500.00, day_in_month(year, month, 2),
                         force_wallet=wallets["Casa"])
        for _ in range(random.randint(4, 7)):
            nm, cat, (lo, hi) = random.choice(EXPENSE_TEMPLATES)
            make_transaction(nm, cat, "expense", round(random.uniform(lo, hi), 2),
                             day_in_month(year, month, random.randint(1, 28)))
        if random.random() < 0.55:
            nm, cat, (lo, hi) = random.choice(INCOME_TEMPLATES)
            make_transaction(nm, cat, "income", round(random.uniform(lo, hi), 2),
                             day_in_month(year, month, random.randint(1, 28)))

    # Relleno aleatorio hasta el objetivo. Se deja un hueco de 6 para las
    # transacciones post-metas (ver abajo).
    span_days = (TODAY - start_month).days
    while created < target_total - 6:
        if random.random() < 0.78:
            nm, cat, (lo, hi) = random.choice(EXPENSE_TEMPLATES)
            ttype = "expense"
        else:
            nm, cat, (lo, hi) = random.choice(INCOME_TEMPLATES)
            ttype = "income"
        make_transaction(nm, cat, ttype, round(random.uniform(lo, hi), 2),
                         start_month + timedelta(days=random.randint(0, span_days)))
    print(f"  transacciones: {created}")

    # ---- Metas: los 3 goal_type, periodos pasado / actual / futuro ----
    this_month_start = date(TODAY.year, TODAY.month, 1)
    next_month_start = (this_month_start + timedelta(days=32)).replace(day=1)
    this_month_end = next_month_start - timedelta(days=1)

    goals = [
        # Pasada y ya cerrada: la cierra flag_expired_goals en execute-pending.
        {"name": "Ahorro para el enganche", "description": "Meta cerrada del semestre pasado",
         "goal_type": "savings", "target_amount": 25000,
         "start_date": iso_dt(months_ago(12)), "end_date": iso_dt(months_ago(2))},
        # Mes en curso, límite bajo a propósito -> se marca FAILED en caliente.
        {"name": "Presupuesto de comida", "description": "Límite mensual de comida",
         "goal_type": "expense_limit", "target_amount": 3000,
         "start_date": iso_dt(this_month_start), "end_date": iso_dt(this_month_end),
         "category_id": resolve_category("Comida", "expense")},
        # Mes en curso, alcanzable -> ACHIEVED cuando entre el sueldo.
        {"name": "Ingresos del mes", "goal_type": "income", "target_amount": 12000,
         "start_date": iso_dt(this_month_start), "end_date": iso_dt(this_month_end)},
        # Con scope de wallet y periodo futuro -> se queda ACTIVE.
        {"name": "Fondo de viajes", "description": "Juntar para el viaje de fin de año",
         "goal_type": "savings", "target_amount": 30000,
         "start_date": iso_dt(this_month_start),
         "end_date": iso_dt(this_month_start + timedelta(days=180)),
         "wallet_id": wallets["Viajes"]},
        # Anual con scope de categoría.
        {"name": "Ingresos freelance del año", "goal_type": "income", "target_amount": 60000,
         "start_date": iso_dt(date(TODAY.year, 1, 1)), "end_date": iso_dt(date(TODAY.year, 12, 31)),
         "category_id": resolve_category("Freelance", "income")},
        # Esta se cancela para ejercitar el estado 'cancelled'.
        {"name": "Límite de entretenimiento", "goal_type": "expense_limit", "target_amount": 2500,
         "start_date": iso_dt(this_month_start), "end_date": iso_dt(this_month_end),
         "category_id": resolve_category("Entretenimiento", "expense")},
    ]
    for g in goals:
        goal = post("/goals/", token, g)
        if g["name"] == "Límite de entretenimiento":
            post(f"/goals/{goal['id']}/cancel", token)
    print(f"  metas: {len(goals)} (1 cancelada)")

    # Transacciones DESPUÉS de las metas, y todas dentro del mes en curso, por
    # dos razones: evaluate_goal_completions solo corre al escribir una
    # transacción (sin esto las metas recién creadas se quedarían en ACTIVE
    # aunque sus números digan otra cosa), y las metas del mes actual
    # arrancarían casi vacías si el mes acaba de empezar.
    month_days = (TODAY - this_month_start).days
    closing = [("Comida", "expense")] * 3 + [("Entretenimiento", "expense")] * 2 + [(None, None)]
    for cat_name, ttype in closing:
        if cat_name is None:
            nm, cat_name, (lo, hi) = random.choice(INCOME_TEMPLATES)
            ttype = "income"
        else:
            nm, _, (lo, hi) = random.choice(
                [t for t in EXPENSE_TEMPLATES if t[1] == cat_name]
            )
        make_transaction(nm, cat_name, ttype, round(random.uniform(lo, hi), 2),
                         this_month_start + timedelta(days=random.randint(0, month_days)))

    # ---- Recurrentes: las 5 frecuencias, ambos tipos, auto_execute mixto ----
    # start_date cerca de hoy a propósito: execute-pending ejecuta UNA vez por
    # llamada, así que una recurrente que arranca hace meses quedaría vencida
    # de forma permanente en vez de ponerse al día.
    recurring = [
        {"name": "Renta", "description": "Renta mensual del depto", "amount": 6500,
         "type": "expense", "frequency": "Monthly",
         "start_date": (TODAY - timedelta(days=10)).isoformat(), "auto_execute": True,
         "category_id": resolve_category("Vivienda", "expense")},
        {"name": "Netflix", "description": "Suscripción Netflix", "amount": 299,
         "type": "expense", "frequency": "Monthly",
         "start_date": (TODAY - timedelta(days=6)).isoformat(), "auto_execute": True,
         "category_id": resolve_category("Suscripciones", "expense")},
        {"name": "Café diario", "description": "Café de la mañana", "amount": 65,
         "type": "expense", "frequency": "Daily",
         "start_date": TODAY.isoformat(), "auto_execute": True,
         "category_id": resolve_category("Café de especialidad", "expense")},
        {"name": "Gimnasio", "description": "Mensualidad del gym", "amount": 250,
         "type": "expense", "frequency": "Weekly",
         "start_date": (TODAY - timedelta(days=3)).isoformat(), "auto_execute": True,
         "category_id": resolve_category("Salud", "expense")},
        {"name": "Seguro de auto", "description": "Póliza anual del auto", "amount": 8500,
         "type": "expense", "frequency": "Yearly",
         "start_date": (TODAY - timedelta(days=20)).isoformat(), "auto_execute": True,
         "category_id": resolve_category("Transporte", "expense")},
        # auto_execute=False y ya vencida -> cae en pending-confirmation.
        {"name": "Salario quincenal", "description": "Nómina quincenal", "amount": 12000,
         "type": "income", "frequency": "Biweekly",
         "start_date": (TODAY - timedelta(days=2)).isoformat(), "auto_execute": False,
         "category_id": resolve_category("Salario", "income")},
        # Esta se pausa.
        {"name": "Clases de inglés", "description": "Colegiatura semanal", "amount": 700,
         "type": "expense", "frequency": "Weekly",
         "start_date": (TODAY - timedelta(days=1)).isoformat(), "auto_execute": True,
         "category_id": resolve_category("Educación", "expense")},
    ]
    rec_ids = []
    for rc in recurring:
        rec_ids.append((rc["name"], post("/recurring-transactions/", token, rc)["id"]))
    paused_name, paused_id = rec_ids[-1]
    post(f"/recurring-transactions/{paused_id}/pause", token)

    # Mismo hook que dispara el frontend en el login (AuthContext.login).
    res = post("/recurring-transactions/execute-pending", token)
    print(
        f"  recurrentes: {len(recurring)} (1 pausada: '{paused_name}') · "
        f"{res.get('executed', 0)} ejecutadas ahora"
    )
    if fallback_created:
        print(f"  ⚠ categorías creadas como propias por falta de global: {', '.join(sorted(set(fallback_created)))}")

    return mail, token


def report(mail, password, name, token):
    """Verifica contra la API lo que quedó sembrado (no confía en los contadores
    locales) y lo imprime."""
    txs = []
    while True:
        page = get(f"/transactions/?skip={len(txs)}&limit=500", token)
        txs.extend(page)
        if len(page) < 500:
            break
    incomes = [t for t in txs if t["type"] == "income"]
    expenses = [t for t in txs if t["type"] == "expense"]
    dates = sorted(t["date"][:10] for t in txs)

    goals = get("/goals/", token)
    wallets = get("/wallets/", token)
    cats = get("/categories/?include_hidden=true", token)
    recurring = get("/recurring-transactions/", token)
    pending = get("/recurring-transactions/pending-confirmation/list", token)
    unread = get("/notifications/unread-count", token)

    print("\n" + "=" * 62)
    print("  RESUMEN DEL USUARIO SEMBRADO")
    print("=" * 62)
    print(f"  Transacciones : {len(txs)}  ({len(incomes)} ingresos / {len(expenses)} gastos)")
    print(f"  Rango fechas  : {dates[0]} → {dates[-1]}")
    print(f"  Ingresos      : ${sum(float(t['amount']) for t in incomes):,.2f}")
    print(f"  Gastos        : ${sum(float(t['amount']) for t in expenses):,.2f}")
    print(f"  Categorías    : {len(cats)} visibles para el usuario "
          f"({len([c for c in cats if c['user_id'] is None])} globales, "
          f"{len([c for c in cats if c['user_id']])} propias, "
          f"{len([c for c in cats if c['is_hidden']])} oculta(s))")
    print(f"  Wallets       : {len(wallets)} (incluye la default)")
    for w in wallets:
        if w["is_default"]:
            # La default es implícita: no tiene filas en transaction_wallets,
            # contiene TODO por definición (gotcha #6 del CLAUDE.md).
            print(f"                   · {w['name']} ★ default: {len(txs)} (todas, implícita)")
        else:
            n = len([t for t in txs if w["id"] in t["wallet_ids"]])
            print(f"                   · {w['name']}: {n} movimientos asignados")
    print(f"  Metas         : {len(goals)}")
    for g in goals:
        print(f"                   · {g['name']}: {g['status']} — {g['percentage']:.0f}% "
              f"(${float(g['current_amount']):,.2f} / ${float(g['target_amount']):,.2f})")
    print(f"  Recurrentes   : {len(recurring)} "
          f"({len([r for r in recurring if r['status'] == 'active'])} activas, "
          f"{len([r for r in recurring if r['status'] == 'paused'])} pausadas, "
          f"{len(pending)} esperando confirmación)")
    print(f"  Notificaciones: {unread.get('count', unread)} sin leer")

    print("\n" + "=" * 62)
    print("  CREDENCIALES DE ACCESO")
    print("=" * 62)
    print(f"  Nombre     : {name}")
    print(f"  Correo     : {mail}")
    print(f"  Contraseña : {password}")
    print("=" * 62 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Siembra un usuario de demo completo.")
    parser.add_argument("--api", default=None, help="URL base del backend (default: $API_URL)")
    parser.add_argument("--name", default="Demo Finanzas")
    parser.add_argument("--mail", default="demo@finanzas.test")
    parser.add_argument("--password", default="Demo1234!",
                        help="Debe cumplir la política: 8+, mayúscula, número y símbolo")
    parser.add_argument("--transactions", type=int, default=140,
                        help="Objetivo de transacciones (mínimo 100)")
    parser.add_argument("--seed", type=int, default=None,
                        help="Semilla aleatoria; por defecto cada corrida varía")
    args = parser.parse_args()

    global API
    if args.api:
        API = args.api
    if args.seed is not None:
        random.seed(args.seed)

    try:
        mail, token = seed(args)
    except RuntimeError as e:
        print(f"\n❌ {e}", file=sys.stderr)
        sys.exit(1)
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"\n❌ No se pudo conectar a {API}: {e}", file=sys.stderr)
        sys.exit(1)

    report(mail, args.password, args.name, token)


if __name__ == "__main__":
    main()
