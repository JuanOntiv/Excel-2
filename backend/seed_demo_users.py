"""
Script de seeding para poblar DOS usuarios de demo con datos ricos y variados,
usando EXCLUSIVAMENTE la API pública (misma ruta que usa el frontend), para
ejercitar toda la lógica de negocio (validación de categorías, asignación de
wallets por reglas, ejecución de recurrentes, cómputo de metas, etc.).

Uso:  python3 seed_demo_users.py
Requisitos: backend levantado en http://localhost:8000 (o env API_URL).
"""
import json
import os
import random
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

API = os.getenv("API_URL", "http://localhost:8000")

# Semilla fija -> corridas reproducibles (mismos montos/fechas).
random.seed(1234)


# --------------------------------------------------------------------------
# Helpers HTTP (stdlib, sin dependencias externas)
# --------------------------------------------------------------------------
def _request(method, path, token=None, json_body=None, form_body=None):
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
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, (json.loads(body) if body else None)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = body
        return e.code, parsed


def post(path, token=None, body=None):
    status, data = _request("POST", path, token=token, json_body=body)
    if status >= 400:
        raise RuntimeError(f"POST {path} -> {status}: {data}")
    return data


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
def register(name, mail, password):
    status, data = _request(
        "POST", "/users/register", json_body={"name": name, "mail": mail, "password": password}
    )
    if status == 201:
        return "created"
    if status == 400 and isinstance(data, dict) and "already registered" in str(data.get("detail", "")):
        return "exists"
    raise RuntimeError(f"register {mail} -> {status}: {data}")


def login(mail, password):
    status, data = _request(
        "POST", "/auth/login", form_body={"username": mail, "password": password}
    )
    if status != 200:
        raise RuntimeError(f"login {mail} -> {status}: {data}")
    return data["access_token"]


# --------------------------------------------------------------------------
# Seeding de un usuario
# --------------------------------------------------------------------------
TODAY = date(2026, 7, 19)  # fecha "actual" del proyecto


def iso_dt(d):
    return f"{d.isoformat()}T12:00:00"


def seed_user(profile):
    name, mail, password = profile["name"], profile["mail"], profile["password"]
    state = register(name, mail, password)
    token = login(mail, password)
    print(f"\n=== {name} <{mail}>  (registro: {state}) ===")

    # ---- Categorías (variando type: expense / income / both) ----
    cat_defs = [
        ("Comida", "expense"),
        ("Transporte", "expense"),
        ("Servicios", "expense"),
        ("Entretenimiento", "expense"),
        ("Hogar", "expense"),
        ("Salario", "income"),
        ("Extra", "both"),
    ]
    cats = {}
    for cname, ctype in cat_defs:
        c = post("/categories/", token, {"name": cname, "type": ctype})
        cats[cname] = c["id"]
    print(f"  categorías: {len(cats)}")

    # ---- Wallets ----
    wallet_defs = [
        ("Efectivo", "Gastos en efectivo del día a día"),
        ("Tarjeta de crédito", "Movimientos de la TDC"),
        ("Ahorros", "Fondo de ahorro e ingresos"),
        ("Viajes", "Gastos de viajes y salidas"),
    ]
    wallets = {}
    for wname, wdesc in wallet_defs:
        w = post("/wallets/", token, {"name": wname, "description": wdesc})
        wallets[wname] = w["id"]
    print(f"  wallets: {len(wallets)} (+ default implícita)")

    # ---- Wallet rules (los 5 rule_type, polimórficas) ----
    rules = [
        # CATEGORY: toda "Comida" cae en Efectivo
        {"wallet_id": wallets["Efectivo"], "rule_type": "Category", "category_id": cats["Comida"]},
        # TRANSACTION_TYPE: todo ingreso cae en Ahorros
        {"wallet_id": wallets["Ahorros"], "rule_type": "TransactionType", "transaction_type": "income"},
        # KEYWORD: "netflix" -> Tarjeta de crédito
        {"wallet_id": wallets["Tarjeta de crédito"], "rule_type": "Keyword", "keyword": "netflix"},
        # KEYWORD: "uber" -> Viajes
        {"wallet_id": wallets["Viajes"], "rule_type": "Keyword", "keyword": "uber"},
        # AMOUNT_RANGE: montos grandes (>=5000) -> Ahorros
        {"wallet_id": wallets["Ahorros"], "rule_type": "AmountRange", "amount_from": 5000, "amount_to": 1000000},
        # DATE_RANGE: junio 2026 -> Viajes
        {"wallet_id": wallets["Viajes"], "rule_type": "DateRange", "date_from": "2026-06-01", "date_to": "2026-06-30"},
    ]
    for r in rules:
        post("/wallet-rules/", token, r)
    print(f"  wallet rules: {len(rules)} (los 5 tipos)")

    # ---- Transacciones (>=50, mayoría gastos) ----
    # Plantillas de gasto: (nombre, categoría, rango de monto)
    expense_templates = [
        ("Súper de la semana", "Comida", (350, 1400)),
        ("Comida rápida", "Comida", (80, 320)),
        ("Café", "Comida", (45, 130)),
        ("Uber al trabajo", "Transporte", (60, 240)),
        ("Gasolina", "Transporte", (500, 1200)),
        ("Recarga transporte público", "Transporte", (50, 200)),
        ("Recibo de luz (CFE)", "Servicios", (400, 1300)),
        ("Internet", "Servicios", (450, 650)),
        ("Agua", "Servicios", (150, 400)),
        ("Netflix", "Entretenimiento", (219, 299)),
        ("Cine", "Entretenimiento", (120, 380)),
        ("Concierto", "Entretenimiento", (600, 2500)),
        ("Renta parcial", "Hogar", (2000, 3500)),
        ("Artículos de limpieza", "Hogar", (120, 480)),
        ("Reparación menor", "Hogar", (200, 1500)),
    ]
    income_templates = [
        ("Pago freelance", "Extra", (1500, 6000)),
        ("Venta de garaje", "Extra", (300, 1800)),
        ("Salario", "Salario", (9000, 18000)),
        ("Bono", "Salario", (2000, 7000)),
    ]

    start = date(2026, 2, 1)
    span_days = (TODAY - start).days
    tx_count = 0
    # ~46 gastos
    for _ in range(46):
        nm, cat, (lo, hi) = random.choice(expense_templates)
        amount = round(random.uniform(lo, hi), 2)
        d = start + timedelta(days=random.randint(0, span_days))
        body = {
            "name": nm,
            "description": f"{nm} — gasto de demo",
            "amount": amount,
            "date": iso_dt(d),
            "type": "expense",
            "category_id": cats[cat],
        }
        # ~1 de cada 4 con asignación manual explícita a una wallet
        if random.random() < 0.25:
            body["wallet_id"] = wallets[random.choice(list(wallets))]
        post("/transactions/", token, body)
        tx_count += 1
    # ~10 ingresos
    for _ in range(10):
        nm, cat, (lo, hi) = random.choice(income_templates)
        amount = round(random.uniform(lo, hi), 2)
        d = start + timedelta(days=random.randint(0, span_days))
        post("/transactions/", token, {
            "name": nm,
            "description": f"{nm} — ingreso de demo",
            "amount": amount,
            "date": iso_dt(d),
            "type": "income",
            "category_id": cats[cat],
        })
        tx_count += 1
    print(f"  transacciones creadas: {tx_count}")

    # ---- Metas (los 3 goal_type, con y sin scope) ----
    goals = [
        {"name": "Meta de ingresos Q2", "goal_type": "income", "target_amount": 30000,
         "start_date": iso_dt(date(2026, 4, 1)), "end_date": iso_dt(date(2026, 6, 30))},
        {"name": "Presupuesto de comida (julio)", "goal_type": "expense_limit", "target_amount": 5000,
         "start_date": iso_dt(date(2026, 7, 1)), "end_date": iso_dt(date(2026, 7, 31)),
         "category_id": cats["Comida"]},
        {"name": "Fondo de ahorro anual", "goal_type": "savings", "target_amount": 20000,
         "start_date": iso_dt(date(2026, 1, 1)), "end_date": iso_dt(date(2026, 12, 31)),
         "wallet_id": wallets["Ahorros"]},
        {"name": "Límite de entretenimiento", "goal_type": "expense_limit", "target_amount": 2500,
         "start_date": iso_dt(date(2026, 7, 1)), "end_date": iso_dt(date(2026, 7, 31)),
         "category_id": cats["Entretenimiento"]},
    ]
    for g in goals:
        created = post("/goals/", token, g)
        # Cancelamos una meta para ejercitar el estado 'cancelled'
        if g["name"] == "Límite de entretenimiento":
            post(f"/goals/{created['id']}/cancel", token)
    print(f"  metas: {len(goals)} (1 cancelada)")

    # ---- Recurrentes (variando frequency, type, auto_execute) ----
    # NOTA: description es OBLIGATORIA a nivel de columna en `transactions`
    # (nullable=False). Al ejecutar una recurrente se copia su description a la
    # Transaction real, así que TODA recurrente debe traer description no-nula.
    recurring = [
        {"name": "Renta", "description": "Renta mensual del depto", "amount": 6500, "type": "expense",
         "frequency": "Monthly", "start_date": "2026-06-01", "auto_execute": True, "category_id": cats["Hogar"]},
        {"name": "Netflix", "description": "Suscripción Netflix", "amount": 299, "type": "expense",
         "frequency": "Monthly", "start_date": "2026-07-05", "auto_execute": True, "category_id": cats["Entretenimiento"]},
        {"name": "Salario quincenal", "description": "Nómina quincenal", "amount": 12000, "type": "income",
         "frequency": "Biweekly", "start_date": "2026-07-01", "auto_execute": False, "category_id": cats["Salario"]},
        {"name": "Gimnasio", "description": "Mensualidad del gym", "amount": 250, "type": "expense",
         "frequency": "Weekly", "start_date": "2026-07-06", "auto_execute": True, "category_id": cats["Servicios"]},
        {"name": "Seguro de auto (anual)", "description": "Póliza anual del auto", "amount": 8500, "type": "expense",
         "frequency": "Yearly", "start_date": "2026-03-01", "auto_execute": True, "category_id": cats["Servicios"]},
        {"name": "Café diario", "description": "Café de la mañana", "amount": 55, "type": "expense",
         "frequency": "Daily", "start_date": "2026-07-15", "auto_execute": True, "category_id": cats["Comida"]},
    ]
    rec_ids = []
    for rc in recurring:
        created = post("/recurring-transactions/", token, rc)
        rec_ids.append((rc["name"], created["id"]))
    # Pausamos una para ejercitar el estado 'paused'
    paused_name, paused_id = rec_ids[3]
    post(f"/recurring-transactions/{paused_id}/pause", token)
    print(f"  recurrentes: {len(recurring)} (1 pausada: '{paused_name}', 1 pendiente de confirmación)")

    # ---- Ejecuta pendientes (igual que hace el frontend en el login) ----
    res = post("/recurring-transactions/execute-pending", token)
    print(f"  execute-pending: {res.get('message')}")

    return mail


def main():
    profiles = [
        {"name": "Ana García", "mail": "ana.demo@finanzas.test", "password": "Demo1234!"},
        {"name": "Bruno López", "mail": "bruno.demo@finanzas.test", "password": "Demo1234!"},
    ]
    for p in profiles:
        seed_user(p)
    print("\n✅ Listo. Credenciales de demo (contraseña: Demo1234!):")
    for p in profiles:
        print(f"   - {p['mail']}")


if __name__ == "__main__":
    main()
