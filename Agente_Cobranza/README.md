# Agente_Cobranza

El Agente Virtual de Cobranza Inteligente es un sistema diseñado para optimizar la gestión de cobranza en entidades financieras, operando de manera autónoma y personalizada en múltiples canales (WhatsApp, app, web e IVR).

## Equipo #5 

* David Emmanuel Villanueva Martinez - A01638389
* Christian Aranda Hernández - A01530913
* Juan Felipe Toro Salgado - A01794274
* David Alejandro Gutiérrez Valencia - A01027771 

## Cómo ejecutar (Dev)

Backend (Flask + SQLite)
- Requisitos: Python 3.10+
- Instalar dependencias: `pip install flask`
- Ejecutar: `python app.py` (crea `agente_cobranza.db` y expone `http://localhost:6012`)

Frontend (React + Vite)
- Requisitos: Node 18+
- Ir a `frontend/`
- Instalar: `npm install`
- Ejecutar: `npm run dev` (abre `http://localhost:5173`)

Autenticación
- La API requiere header `Authorization: Bearer <token>`.
- Para pruebas, usa cualquier string (validación básica). En el frontend hay un botón “Usar demo”.

## Endpoints clave implementados

- `GET/POST/PUT/DELETE /customers` CRUD de clientes
- `GET/POST/PUT/DELETE /payment_methods` CRUD de métodos
- `POST /strategy/payment_route` Estrategia de enrutamiento de pago (card, wallet, pse, corresponsal)
- `POST /strategy/negotiation_offer` Estrategia de negociación (discount, installments, hybrid)

## Flujo sugerido de uso

1) Alta de cliente
- Crea un cliente (nombre, email, teléfono opcional).
- Verifica su creación en el listado.

2) Alta de método de pago
- Selecciona un cliente y registra un método tokenizado (tipo, provider, token, etc.).
- Se puede marcar como default.

3) Simulación de enrutamiento de pago
- Elige método (card/wallet/pse/corresponsal), define monto y proveedor.
- Observa los pasos/route devueltos por la estrategia.

4) Propuesta de negociación
- Define el segmento, monto adeudado, DPD y propensión.
- Revisa la propuesta (descuento, meses sin intereses, condiciones, etc.).

## Casos de uso demostrables

- Caso 1: Recuperación asistida
  - El agente registra un cliente moroso y simula una oferta de negociación basada en DPD y propensión.
  - Se genera una propuesta “discount” o “hybrid”, mostrando condiciones y beneficios.

- Caso 2: Cobro omnicanal
  - Para un cliente con método tokenizado, se calcula la ruta óptima de pago según el canal/proveedor.
  - La UI muestra los pasos (token-verify, 3ds, capture; o bank-redirect) y la referencia en corresponsal.

## Referencia de casos de uso y UI

- La pestaña nueva “Casos de Uso” documenta cada flujo (clientes, métodos de pago, ruta, negociación y agente inteligente), muestra el endpoint que toca, ejemplos de payload y permite saltar directamente a la pestaña correspondiente del panel.
- También se mantiene `USE_CASES.md` en el raíz con la misma descripción para consultarla fuera del navegador.
- Frontend actualizado: pestañas “Casos de Uso”, “Clientes”, “Métodos de Pago”, “Ruta de Pago”, “Negociación” y “Agente”, con estilos renovados y tarjetas explicativas en la nueva vista.
- Para validar localmente usa `npm run build` en `frontend/` (además del flujo dev ya descrito).
