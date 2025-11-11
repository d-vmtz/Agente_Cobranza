from flask import Flask, request, jsonify, abort
import sqlite3
from uuid import uuid4
from datetime import datetime
import json
from abc import ABC, abstractmethod


# ---------------------------------------------------------------------
# CONFIGURACIÓN DE FLASK Y BASE DE DATOS
# ---------------------------------------------------------------------
app = Flask(__name__)
@app.before_request
def before_request_func():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        headers = response.headers

        headers["Access-Control-Allow-Origin"] = request.headers.get("Origin", "*")
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
        headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"

        return response


# Configuración de la conexión a SQLite
DB_PATH = "agente_cobranza.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = None  # usamos cursor.description para mapear
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

# ---------------------------------------------------------------------
# UTILIDADES
# ---------------------------------------------------------------------
def dict_from_row(row, cursor):
    """Convierte una fila SQL en un diccionario con los nombres de columna."""
    if not row:
        return None
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))

def generate_error_response(code, message):
    return jsonify({
        "codigo": f"ERROR_{code}",
        "mensaje": message
    })

def require_auth():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        # 401: UnauthorizedError
        abort(401, description="Acceso no autorizado. Falta el token de autenticación o es inválido.")
    # Nota: En producción, validar el token JWT aquí

# ---------------------------------------------------------------------
# CORS y Manejo de errores JSON
# ---------------------------------------------------------------------
@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin", "*")
    # Permitir desde localhost por defecto
    response.headers["Access-Control-Allow-Origin"] = origin if origin else "*"
    response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    return response

@app.errorhandler(400)
def handle_400(e):
    return jsonify({"codigo": "ERROR_400", "mensaje": str(e)}), 400

@app.errorhandler(401)
def handle_401(e):
    return jsonify({"codigo": "ERROR_401", "mensaje": str(e)}), 401

@app.errorhandler(404)
def handle_404(e):
    return jsonify({"codigo": "ERROR_404", "mensaje": str(e)}), 404

@app.errorhandler(500)
def handle_500(e):
    return jsonify({"codigo": "ERROR_500", "mensaje": "Error interno del servidor"}), 500

# ---------------------------------------------------------------------
# Inicialización de esquema (SQLite)
# ---------------------------------------------------------------------
def init_db():
    schema = """
    CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        type TEXT NOT NULL,
        provider TEXT,
        token TEXT NOT NULL,
        last4 TEXT,
        expiry_month INTEGER,
        expiry_year INTEGER,
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        metadata TEXT,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    """
    conn = get_connection()
    try:
        conn.executescript(schema)
        conn.commit()
    finally:
        conn.close()
# ---------- Payment Strategy ----------
class PaymentStrategy(ABC):
    @abstractmethod
    def execute(self, payload: dict) -> dict:
        """Ejecuta la ruta de pago para el método concreto."""
        raise NotImplementedError

class CardStrategy(PaymentStrategy):
    def execute(self, payload: dict) -> dict:
        # Ejemplo: tokenización, 3DS, antifraude, captura diferida…
        return {
            "method": "card",
            "routed_to": payload.get("provider", "stripe"),
            "steps": ["token-verify", "3ds-check", "auth", "capture"],
            "amount": payload.get("amount"),
            "currency": payload.get("currency", "MXN"),
            "metadata": payload.get("metadata", {})
        }

class PSEStrategy(PaymentStrategy):
    def execute(self, payload: dict) -> dict:
        return {
            "method": "pse",
            "routed_to": payload.get("provider", "pse_gateway"),
            "steps": ["bank-redirect", "notify-webhook"],
            "amount": payload.get("amount"),
            "currency": payload.get("currency", "COP"),
            "metadata": payload.get("metadata", {})
        }

class WalletStrategy(PaymentStrategy):
    def execute(self, payload: dict) -> dict:
        return {
            "method": "wallet",
            "routed_to": payload.get("provider", "mercado_pago"),
            "steps": ["wallet-charge"],
            "amount": payload.get("amount"),
            "currency": payload.get("currency", "MXN"),
            "metadata": payload.get("metadata", {})
        }

class CorresponsalStrategy(PaymentStrategy):
    def execute(self, payload: dict) -> dict:
        return {
            "method": "corresponsal",
            "routed_to": payload.get("provider", "oxxo_pay"),
            "steps": ["generate-reference", "await-cash-payment", "reconcile"],
            "amount": payload.get("amount"),
            "currency": payload.get("currency", "MXN"),
            "reference_expires_in_hours": 48,
            "metadata": payload.get("metadata", {})
        }

PAYMENT_STRATEGIES = {
    "card": CardStrategy(),
    "pse": PSEStrategy(),
    "wallet": WalletStrategy(),
    "corresponsal": CorresponsalStrategy(),
}

def select_payment_strategy(method: str) -> PaymentStrategy:
    strategy = PAYMENT_STRATEGIES.get(method.lower())
    if not strategy:
        raise ValueError(f"Método de pago no soportado: {method}")
    return strategy


# ---------- Negotiation Strategy ----------
class NegotiationStrategy(ABC):
    @abstractmethod
    def propose(self, context: dict) -> dict:
        """Devuelve una propuesta de negociación según el contexto."""
        raise NotImplementedError

class DiscountStrategy(NegotiationStrategy):
    def propose(self, context: dict) -> dict:
        # Descuento según DPD (días de atraso) y score de propensión
        dpd = int(context.get("dpd", 0))
        score = float(context.get("propension_pago", 0.5))
        base = 0.10  # 10%
        # Más atraso, mayor incentivo; mayor propensión, menor descuento requerido
        extra = min(0.20, (dpd // 30) * 0.05)
        adjust = -0.05 if score > 0.7 else (0.0 if score >= 0.4 else +0.05)
        pct = max(0.05, min(0.30, base + extra + adjust))
        return {
            "tactic": "discount",
            "discount_pct": round(pct, 3),
            "conditions": ["pago_total", "liquidación_en_10_días"]
        }

class InstallmentsStrategy(NegotiationStrategy):
    def propose(self, context: dict) -> dict:
        amount = float(context.get("amount_due", 0))
        dpd = int(context.get("dpd", 0))
        # Más atraso → más plazos (pero cap), cuotas mínimas ≈ 300 MXN
        if amount <= 0:
            n = 1
        else:
            n = min(12, max(3, (dpd // 30) + 3))
        min_installment = 300
        while n > 1 and amount / n < min_installment:
            n -= 1
        return {
            "tactic": "installments",
            "installments": n,
            "interest_rate_monthly": 0.0,  # meses sin intereses
            "conditions": ["domiciliar_pago", "primer_pago_inmediato"]
        }

class HybridStrategy(NegotiationStrategy):
    def propose(self, context: dict) -> dict:
        # Combina descuento + MSI
        discount = DiscountStrategy().propose(context)["discount_pct"]
        inst = InstallmentsStrategy().propose(context)["installments"]
        return {
            "tactic": "hybrid",
            "discount_pct": discount,
            "installments": inst,
            "interest_rate_monthly": 0.0,
            "conditions": ["firma_convenio_digital", "domiciliar_pago"]
        }

NEGOTIATION_STRATEGIES = {
    "discount": DiscountStrategy(),
    "installments": InstallmentsStrategy(),
    "hybrid": HybridStrategy(),
}

def select_negotiation_strategy(segmento: str, contexto: dict) -> NegotiationStrategy:
    """
    Selector simple por segmento/campaña.
    Puedes sofisticarlo con reglas, AB testing o tabla de configuración.
    """
    seg = (segmento or "").lower()
    dpd = int(contexto.get("dpd", 0))
    score = float(contexto.get("propension_pago", 0.5))

    if seg in {"vip", "consumo_alto"}:
        # VIP: preferible MSI sin intereses
        return NEGOTIATION_STRATEGIES["installments"]
    if dpd >= 60 and score < 0.5:
        # Alto atraso + baja propensión: oferta agresiva híbrida
        return NEGOTIATION_STRATEGIES["hybrid"]
    if seg in {"pyme", "consumo"} and dpd < 60:
        # Segmentos masivos con atraso moderado: descuento puro
        return NEGOTIATION_STRATEGIES["discount"]
    # Default
    return NEGOTIATION_STRATEGIES["discount"]
#######################################################################
# DEFINICION DE ENDPOINTS 
#######################################################################

# ---------------------------------------------------------------------
# CRUD: Métodos de Pago
# ---------------------------------------------------------------------

# ✅ GET -> Retribuir todos los metodos de pago existentes 
@app.route("/payment_methods", methods=["GET"])
def get_payment_methods():
    require_auth()
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM payment_methods;")
        rows = cursor.fetchall()
        data = [dict_from_row(r, cursor) for r in rows]
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            cursor.close()
        finally:
            conn.close()

# ✅ GET -> Retribuir un metodo de pago en especifico 
@app.route("/payment_methods/<string:method_id>", methods=["GET"])
def get_payment_method(method_id):
    require_auth()
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM payment_methods WHERE id = ?;", (method_id,))
        row = cursor.fetchone()
        if not row:
            return generate_error_response(404, f"No se encontro el registro {method_id}")
        return jsonify(dict_from_row(row, cursor)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            cursor.close()
        finally:
            conn.close()

# ✅ POST -> Crear un nuevo metodo de pago
@app.route("/payment_methods", methods=["POST"])
def create_payment_method():
    require_auth()
    data = request.get_json()

    required_fields = ["customer_id", "type", "token"]
    if not all(field in data for field in required_fields):
        return generate_error_response(400, f"Campos requeridos faltantes")

    try:
        conn = get_connection()
        cursor = conn.cursor()

        new_id = str(uuid4())
        query = """
            INSERT INTO payment_methods
            (id, customer_id, type, provider, token, last4, expiry_month, expiry_year, is_default, created_at, metadata)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """
        metadata = json.dumps(data.get("metadata", {}))
        cursor.execute(query, (
            new_id,
            data["customer_id"],
            data["type"],
            data.get("provider"),
            data["token"],
            data.get("last4"),
            data.get("expiry_month"),
            data.get("expiry_year"),
            1 if data.get("is_default", False) else 0,
            datetime.utcnow().isoformat(),
            metadata
        ))
        conn.commit()

        cursor.execute("SELECT * FROM payment_methods WHERE id = ?;", (new_id,))
        row = cursor.fetchone()
        return jsonify(dict_from_row(row, cursor)), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            cursor.close()
        finally:
            conn.close()

# ✅ PUT -> Actualizar un metodo de pago
@app.route("/payment_methods/<string:method_id>", methods=["PUT"])
def update_payment_method(method_id):
    require_auth()
    data = request.get_json()

    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Comprobar si existe
        cursor.execute("SELECT id FROM payment_methods WHERE id = ?;", (method_id,))
        if not cursor.fetchone():
            return generate_error_response(404, f"No se encontro el método de pago con ID {method_id}")

        fields = []
        values = []

        # Construcción dinámica del UPDATE
        for key in [
            "customer_id", "type", "provider", "token", "last4",
            "expiry_month", "expiry_year", "is_default", "metadata"
        ]:
            if key in data:
                fields.append(f"{key} = ?")
                if key == "metadata":
                    values.append(json.dumps(data[key]))
                else:
                    values.append(data[key])

        if not fields:
            return generate_error_response(400, f"No hay campos por modificar en {method_id}")

        query = f"UPDATE payment_methods SET {', '.join(fields)} WHERE id = ?"
        values.append(method_id)
        cursor.execute(query, tuple(values))
        conn.commit()

        cursor.execute("SELECT * FROM payment_methods WHERE id = ?;", (method_id,))
        row = cursor.fetchone()
        return jsonify(dict_from_row(row, cursor)), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            cursor.close()
        finally:
            conn.close()

# ✅ DELETE -> Eliminar un metodo de pago 
@app.route("/payment_methods/<string:method_id>", methods=["DELETE"])
def delete_payment_method(method_id):
    require_auth()
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM payment_methods WHERE id = ?;", (method_id,))
        if not cursor.fetchone():
            return generate_error_response(404, f"No se encontro el método de pago con ID {method_id}")

        cursor.execute("DELETE FROM payment_methods WHERE id = ?;", (method_id,))
        conn.commit()
        return jsonify({"message": "Metodo de pago eliminado"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            cursor.close()
        finally:
            conn.close()


# ---------------------------------------------------------------------
# CRUD: Clientes
# ---------------------------------------------------------------------

# ✅ GET -> Obtener todos los clientes
@app.route("/customers", methods=["GET"])
def get_customers():
    require_auth()
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM customers;")
        rows = cursor.fetchall()
        data = [dict_from_row(r, cursor) for r in rows]
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            if cursor: cursor.close()
        finally:
            if conn:
                conn.close()

# ✅ GET -> Obtener un cliente específico
@app.route("/customers/<string:customer_id>", methods=["GET"])
def get_customer(customer_id):
    require_auth()
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM customers WHERE id = ?;", (customer_id,))
        row = cursor.fetchone()
        if not row:
            return generate_error_response(404, f"No se encontró el cliente {customer_id}")
        return jsonify(dict_from_row(row, cursor)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            cursor.close()
        finally:
            conn.close()


# ✅ POST -> Crear un cliente
@app.route("/customers", methods=["POST"])
def create_customer():
    require_auth()
    data = request.get_json()
    required_fields = ["name", "email"]
    if not all(field in data for field in required_fields):
        return generate_error_response(400, "Faltan campos obligatorios: name, email")

    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        new_id = str(uuid4())
        query = """
            INSERT INTO customers (id, name, email, phone, created_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        """
        metadata = json.dumps(data.get("metadata", {}))
        cursor.execute(query, (
            new_id, data["name"], data["email"], data.get("phone"),
            datetime.utcnow().isoformat(), metadata
        ))
        conn.commit()

        cursor.execute("SELECT * FROM customers WHERE id = ?;", (new_id,))
        row = cursor.fetchone()
        return jsonify(dict_from_row(row, cursor)), 201
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            if cursor: cursor.close()
        finally:
            if conn:
                conn.close()

# ✅ PUT -> Actualizar un cliente
@app.route("/customers/<string:customer_id>", methods=["PUT"])
def update_customer(customer_id):
    require_auth()
    data = request.get_json()

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM customers WHERE id = ?;", (customer_id,))
        if not cursor.fetchone():
            return generate_error_response(404, f"No existe cliente {customer_id}")

        fields, values = [], []
        for key in ["name", "email", "phone", "metadata"]:
            if key in data:
                fields.append(f"{key} = ?")
                if key == "metadata":
                    values.append(json.dumps(data[key]))
                else:
                    values.append(data[key])

        if not fields:
            return generate_error_response(400, "No hay campos para actualizar")

        query = f"UPDATE customers SET {', '.join(fields)} WHERE id = ?"
        values.append(customer_id)
        cursor.execute(query, tuple(values))
        conn.commit()

        cursor.execute("SELECT * FROM customers WHERE id = ?;", (customer_id,))
        row = cursor.fetchone()
        return jsonify(dict_from_row(row, cursor)), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            cursor.close()
        finally:
            conn.close()


# ✅ DELETE -> Eliminar un cliente
@app.route("/customers/<string:customer_id>", methods=["DELETE"])
def delete_customer(customer_id):
    require_auth()
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM customers WHERE id = ?;", (customer_id,))
        if not cursor.fetchone():
            return generate_error_response(404, f"No se encontró el cliente {customer_id}")

        cursor.execute("DELETE FROM customers WHERE id = ?;", (customer_id,))
        conn.commit()
        return jsonify({"message": "Cliente eliminado correctamente"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            cursor.close()
        finally:
            conn.close()
# POST /strategy/payment_route  -> Selecciona y ejecuta estrategia de pago
@app.route("/strategy/payment_route", methods=["POST"])
def strategy_payment_route():
    require_auth()
    data = request.get_json() or {}
    required = ["payment_method", "amount"]
    if not all(k in data for k in required):
        return generate_error_response(400, "Faltan campos: payment_method, amount")

    try:
        strategy = select_payment_strategy(data["payment_method"])
        result = strategy.execute(data)
        return jsonify({
            "status": "ok",
            "route": result
        }), 200
    except ValueError as ve:
        return generate_error_response(400, str(ve))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# POST /strategy/negotiation_offer -> Elige táctica de negociación y propone oferta
@app.route("/strategy/negotiation_offer", methods=["POST"])
def strategy_negotiation_offer():
    require_auth()
    data = request.get_json() or {}
    # Campos de contexto (puedes ampliarlos sin romper compat.)
    required = ["segmento", "amount_due", "dpd", "propension_pago"]
    if not all(k in data for k in required):
        return generate_error_response(400, "Faltan campos: segmento, amount_due, dpd, propension_pago")

    try:
        strategy = select_negotiation_strategy(data.get("segmento"), data)
        proposal = strategy.propose(data)
        return jsonify({
            "status": "ok",
            "proposal": proposal
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
# =========================
# Helpers Agente
# =========================
def get_payment_methods_for_customer(customer_id: str):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, customer_id, type, provider, last4, expiry_month, expiry_year, is_default, created_at, metadata
            FROM payment_methods
            WHERE customer_id = ?
            ORDER BY is_default DESC, created_at ASC
        """, (customer_id,))
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        return [dict(zip(cols, r)) for r in rows]
    finally:
        conn.close()

def choose_best_method(methods: list[dict]) -> dict | None:
    if not methods:
        return None
    return methods[0]

def infer_fallback_method(channel: str | None, currency: str | None) -> dict:
    ch = (channel or "").lower()
    cur = (currency or "").upper()

    if cur == "COP":
        return {"type": "pse", "provider": "pse_gateway"}
    if "ivr" in ch or "tienda" in ch or "presencial" in ch:
        return {"type": "corresponsal", "provider": "oxxo_pay"}
    return {"type": "card", "provider": "stripe"}

def build_speech(route: dict, proposal: dict, currency: str | None):
    cur = (currency or route.get("currency") or "MXN").upper()
    method = route.get("method")
    routed = route.get("routed_to")
    steps = " → ".join(route.get("steps", []))

    parts = []
    if proposal:
        t = proposal.get("tactic")
        if t == "discount":
            parts.append(f"Puedo ofrecerte un descuento de {int(round(proposal.get('discount_pct',0)*100))}% si liquidamos en 10 días.")
        elif t == "installments":
            parts.append(f"Puedo ofrecerte {proposal.get('installments',3)} mensualidades sin intereses.")
        elif t == "hybrid":
            parts.append(f"Puedo ofrecerte un descuento de {int(round(proposal.get('discount_pct',0)*100))}% y pagar en {proposal.get('installments',3)} mensualidades sin intereses.")
    parts.append(f"Para cobrar {route.get('amount')} {cur}, la mejor ruta es {method} vía {routed} ({steps}).")
    parts.append("¿Deseas proceder?")
    return " ".join(parts)

# =========================
# Endpoint principal del Agente
# =========================
@app.route("/agent/decision", methods=["POST"])
def agent_decision():
    require_auth()
    data = request.get_json() or {}

    required = ["customer_id", "segmento", "amount_due", "dpd", "propension_pago"]
    missing = [k for k in required if k not in data]
    if missing:
        return generate_error_response(400, f"Faltan campos: {', '.join(missing)}")

    customer_id = data["customer_id"]
    amount_due = float(data["amount_due"])
    dpd = int(data["dpd"])
    prop = float(data["propension_pago"])
    segmento = data["segmento"]
    currency = (data.get("currency") or "MXN").upper()
    channel = data.get("channel")

    methods = get_payment_methods_for_customer(customer_id)
    best = choose_best_method(methods)
    if not best:
        best = infer_fallback_method(channel, currency)

    neg_ctx = {
        "segmento": segmento,
        "amount_due": amount_due,
        "dpd": dpd,
        "propension_pago": prop
    }
    neg_strategy = select_negotiation_strategy(segmento, neg_ctx)
    proposal = neg_strategy.propose(neg_ctx)

    pay_payload = {
        "amount": amount_due,
        "currency": currency,
        "provider": best.get("provider"),
        "metadata": {"customer_id": customer_id, "channel": channel}
    }
    pay_strategy = select_payment_strategy(best["type"])
    route = pay_strategy.execute(pay_payload)

    speech = build_speech(route, proposal, currency)

    return jsonify({
        "status": "ok",
        "decision": {
            "customer_id": customer_id,
            "best_payment_method": best,
            "payment_route": route,
            "negotiation_proposal": proposal,
            "speech": speech
        }
    }), 200

# ---------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------
if __name__ == "__main__":
    # Inicializa las tablas si no existen (SQLite)
    init_db()
    app.run(host="0.0.0.0", port=6012, debug=True)
