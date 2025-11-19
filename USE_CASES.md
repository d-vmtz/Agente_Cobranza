# Casos de uso del Agente de Cobranza

Este documento describe la interacción que tiene el frontend con los endpoints definidos en `Agente_Cobranza/app.py` para cada flujo principal.

> **Token:** todas las peticiones usan el header `Authorization: Bearer <token>`. El campo se captura en la cabecera superior del UI (`frontend/src/App.jsx`).

## 1. Gestión de clientes

- **Endpoints involucrados:**  
  `GET /customers`, `POST /customers`, `PUT /customers/:id`, `DELETE /customers/:id`
- **Componente:** `frontend/src/components/Customers.jsx`
- **Interacción:**
  1. Al entrar a la pestaña se hace una llamada `CustomersAPI.list()` que envía un `GET` para poblar la lista de tarjetas.
  2. Los formularios validan que `name` y `email` estén presentes antes de llamar a `CustomersAPI.create()` (`POST`).
  3. Cada tarjeta expone botones “Editar” y “Eliminar”: el primero despliega el modal que actualiza la fila usando `CustomersAPI.update()` (`PUT`), el segundo borra con `CustomersAPI.remove()` (`DELETE`).
  4. Tras cada acción se recarga la lista para mantener consistencia en las otras vistas.

## 2. Gestión de métodos de pago

- **Endpoints:** `GET /payment_methods`, `POST /payment_methods`, `PUT /payment_methods/:id`, `DELETE /payment_methods/:id`
- **Componente:** `frontend/src/components/PaymentMethods.jsx`
- **Interacción:**
  1. Se consultan clientes y métodos actuales (`CustomersAPI.list()` + `PaymentMethodsAPI.list()`).
  2. El formulario requiere `customer_id`, `type` y `token`; opcionalmente se llenan `provider`, `last4`, caducidad e indicador `is_default`.
  3. Crear método dispara `PaymentMethodsAPI.create()` (POST). El backend almacena la relación en SQLite y mantiene integridad referencial con `customers`.
  4. Cada tarjeta tiene un botón “Eliminar” para invocar `PaymentMethodsAPI.remove()` (DELETE). El listado se refresca con cada cambio.

## 3. Selección de ruta de pago

- **Endpoint:** `POST /strategy/payment_route`
- **Componente:** `frontend/src/components/PaymentRoute.jsx`
- **Interacción:**
  1. Se elige el tipo de método (`card`, `wallet`, `pse`, `corresponsal`), monto y moneda, y se indica el proveedor (ej: `stripe`, `oxxo_pay`).
  2. `StrategyAPI.paymentRoute()` envía el payload y el backend selecciona la estrategia correspondiente (ej: `CardStrategy`), que devuelve pasos (`token-verify`, `auth`, etc.).
  3. La vista muestra el estado (`status`), el `method`, `routed_to`, el monto y los pasos como ayuda visual para el agente.

## 4. Propuesta de negociación

- **Endpoint:** `POST /strategy/negotiation_offer`
- **Componente:** `frontend/src/components/Negotiation.jsx`
- **Interacción:**
  1. Se captura el contexto: `segmento`, `amount_due`, `dpd`, `propension_pago`.
  2. `StrategyAPI.negotiation()` llama al backend, que usa la lógica de `DiscountStrategy`, `InstallmentsStrategy` o `HybridStrategy`.
  3. El resultado (`proposal`) se muestra con la táctica seleccionada y las condiciones (descuento, mensualidades sin intereses, etc.).
  4. Este resultado se puede reutilizar en el flujo del agente principal para construir el `speech`.

## 5. Decisión integral del agente

- **Endpoint principal:** `POST /agent/decision`
- **Componente:** `frontend/src/components/Agent.jsx`
- **Interacción:**
  1. La vista simula un asistente conversacional. Se selecciona un cliente y se captura contexto (segmento, monto, DPD, propensión, moneda, canal).
  2. Después de confirmar los datos, `AgentAPI.decision()` compone un payload y lo envía al backend.
  3. El backend realiza: (a) búsqueda del mejor método guardado o genera un respaldo, (b) selecciona estrategia de negociación y de pago, (c) construye el `speech` que reporta la decisión.
  4. La respuesta muestra `best_payment_method`, `payment_route`, `negotiation_proposal` y `speech`. El botón “Proceder con ruta de pago” reusa `StrategyAPI.paymentRoute()` para reafirmar la ruta técnica antes de cobrar.

## 6. Referencia rápida en UI

El nuevo tab “Casos de Uso” (`frontend/src/components/UseCases.jsx`) resume estos flujos, expone qué componente los activa y permite saltar a la pestaña correspondiente para probarlos.
