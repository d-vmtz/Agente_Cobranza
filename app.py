from flask import Flask, request, jsonify, abort
import mysql.connector
from mysql.connector import Error
from uuid import uuid4
from datetime import datetime
import json

# ---------------------------------------------------------------------
# CONFIGURACIÓN DE FLASK Y BASE DE DATOS
# ---------------------------------------------------------------------
app = Flask(__name__)

# Configuración de la conexión a MySQL
DB_CONFIG = {
    "host": "127.0.0.1",
    "user": "root",
    "password": "agente",
    "database": "agente_cobranza"
}

# Función auxiliar para obtener conexión
def get_connection():
    return mysql.connector.connect(**DB_CONFIG)

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
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

# ✅ GET -> Retribuir un metodo de pago en especifico 
@app.route("/payment_methods/<string:method_id>", methods=["GET"])
def get_payment_method(method_id):
    require_auth()
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM payment_methods WHERE id = %s;", (method_id,))
        row = cursor.fetchone()
        if not row:
            generate_error_response(404, f"No se encontro el registro {method_id}")
        return jsonify(dict_from_row(row, cursor)), 200
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

# ✅ POST -> Crear un nuevo metodo de pago
@app.route("/payment_methods", methods=["POST"])
def create_payment_method():
    require_auth()
    data = request.get_json()

    required_fields = ["customer_id", "type", "token"]
    if not all(field in data for field in required_fields):
        generate_error_response(400, f"Campos requeridos faltantes")

    try:
        conn = get_connection()
        cursor = conn.cursor()

        new_id = str(uuid4())
        query = """
            INSERT INTO payment_methods
            (id, customer_id, type, provider, token, last4, expiry_month, expiry_year, is_default, created_at, metadata)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
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
            data.get("is_default", False),
            datetime.utcnow(),
            metadata
        ))
        conn.commit()

        cursor.execute("SELECT * FROM payment_methods WHERE id = %s;", (new_id,))
        row = cursor.fetchone()
        return jsonify(dict_from_row(row, cursor)), 201
    except Error as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
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
        cursor.execute("SELECT id FROM payment_methods WHERE id = %s;", (method_id,))
        if not cursor.fetchone():
            generate_error_response(404, f"No se encontro el método de pago con ID {method_id}")

        fields = []
        values = []

        # Construcción dinámica del UPDATE
        for key in [
            "customer_id", "type", "provider", "token", "last4",
            "expiry_month", "expiry_year", "is_default", "metadata"
        ]:
            if key in data:
                fields.append(f"{key} = %s")
                if key == "metadata":
                    values.append(json.dumps(data[key]))
                else:
                    values.append(data[key])

        if not fields:
            generate_error_response(400, f"No hay campos por modificar en {method_id}")

        query = f"UPDATE payment_methods SET {', '.join(fields)} WHERE id = %s"
        values.append(method_id)
        cursor.execute(query, tuple(values))
        conn.commit()

        cursor.execute("SELECT * FROM payment_methods WHERE id = %s;", (method_id,))
        row = cursor.fetchone()
        return jsonify(dict_from_row(row, cursor)), 200
    except Error as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

# ✅ DELETE -> Eliminar un metodo de pago 
@app.route("/payment_methods/<string:method_id>", methods=["DELETE"])
def delete_payment_method(method_id):
    require_auth()
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM payment_methods WHERE id = %s;", (method_id,))
        if not cursor.fetchone():
            generate_error_response(404, f"No se encontro el método de pago con ID {method_id}")

        cursor.execute("DELETE FROM payment_methods WHERE id = %s;", (method_id,))
        conn.commit()
        return jsonify({"message": "Metodo de pago eliminado"}), 200
    except Error as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()


# ---------------------------------------------------------------------
# CRUD: Clientes
# ---------------------------------------------------------------------

# ✅ GET -> Obtener todos los clientes
@app.route("/customers", methods=["GET"])
def get_customers():
    require_auth()
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM customers;")
        rows = cursor.fetchall()
        data = [dict_from_row(r, cursor) for r in rows]
        return jsonify(data), 200
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()


# ✅ GET -> Obtener un cliente específico
@app.route("/customers/<string:customer_id>", methods=["GET"])
def get_customer(customer_id):
    require_auth()
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM customers WHERE id = %s;", (customer_id,))
        row = cursor.fetchone()
        if not row:
            return generate_error_response(404, f"No se encontró el cliente {customer_id}")
        return jsonify(dict_from_row(row, cursor)), 200
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()


# ✅ POST -> Crear un cliente
@app.route("/customers", methods=["POST"])
def create_customer():
    require_auth()
    data = request.get_json()
    required_fields = ["name", "email"]
    if not all(field in data for field in required_fields):
        return generate_error_response(400, "Faltan campos obligatorios: name, email")

    try:
        conn = get_connection()
        cursor = conn.cursor()

        new_id = str(uuid4())
        query = """
            INSERT INTO customers (id, name, email, phone, created_at, metadata)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        metadata = json.dumps(data.get("metadata", {}))
        cursor.execute(query, (
            new_id,
            data["name"],
            data["email"],
            data.get("phone"),
            datetime.utcnow(),
            metadata
        ))
        conn.commit()

        cursor.execute("SELECT * FROM customers WHERE id = %s;", (new_id,))
        row = cursor.fetchone()
        return jsonify(dict_from_row(row, cursor)), 201
    except Error as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()


# ✅ PUT -> Actualizar un cliente
@app.route("/customers/<string:customer_id>", methods=["PUT"])
def update_customer(customer_id):
    require_auth()
    data = request.get_json()

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM customers WHERE id = %s;", (customer_id,))
        if not cursor.fetchone():
            return generate_error_response(404, f"No existe cliente {customer_id}")

        fields, values = [], []
        for key in ["name", "email", "phone", "metadata"]:
            if key in data:
                fields.append(f"{key} = %s")
                if key == "metadata":
                    values.append(json.dumps(data[key]))
                else:
                    values.append(data[key])

        if not fields:
            return generate_error_response(400, "No hay campos para actualizar")

        query = f"UPDATE customers SET {', '.join(fields)} WHERE id = %s"
        values.append(customer_id)
        cursor.execute(query, tuple(values))
        conn.commit()

        cursor.execute("SELECT * FROM customers WHERE id = %s;", (customer_id,))
        row = cursor.fetchone()
        return jsonify(dict_from_row(row, cursor)), 200
    except Error as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()


# ✅ DELETE -> Eliminar un cliente
@app.route("/customers/<string:customer_id>", methods=["DELETE"])
def delete_customer(customer_id):
    require_auth()
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM customers WHERE id = %s;", (customer_id,))
        if not cursor.fetchone():
            return generate_error_response(404, f"No se encontró el cliente {customer_id}")

        cursor.execute("DELETE FROM customers WHERE id = %s;", (customer_id,))
        conn.commit()
        return jsonify({"message": "Cliente eliminado correctamente"}), 200
    except Error as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

# ---------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)