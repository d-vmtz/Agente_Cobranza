import React from 'react'

const useCases = [
  {
    id: 'customers',
    title: 'Gestión de clientes',
    description:
      'Consulta, crea, actualiza y elimina clientes directamente desde el panel. Todos los cambios se reflejan en la tabla SQLite y en los demás flujos del agente.',
    endpoint: 'GET/POST/PUT/DELETE /customers',
    component: 'Customers',
    sample: `POST /customers { "name": "Ana Ruiz", "email": "ana@ej.com", "phone": "+52 55 1234" }`,
    steps: [
      'Configura el token Bearer arriba para autorizar cada petición.',
      'La vista lista todos los clientes usando `CustomersAPI.list()` (GET).',
      'Usa el formulario para insertar (POST) y los botones sobre cada tarjeta para editar (PUT) o eliminar (DELETE).',
      'Los cambios disponibles alimentan otras vistas (métodos, agente, etc.).',
    ],
    tab: 'customers',
  },
  {
    id: 'payment_methods',
    title: 'Gestión de métodos de pago',
    description:
      'Relaciona tarjetas, monederos, corresponsales o PSE con un cliente para luego ofrecer rutas de cobro.',
    endpoint: 'GET/POST/PUT/DELETE /payment_methods',
    component: 'PaymentMethods',
    sample: `POST /payment_methods { "customer_id": "...", "type": "card", "token": "tok_123" }`,
    steps: [
      'Carga clientes y métodos actuales vía `CustomersAPI.list()` y `PaymentMethodsAPI.list()`.',
      'Completa tipo, token y proveedor, vincúlalo a un cliente y crea el registro con POST.',
      'Elimina o actualiza métodos existentes si necesitas alterar la ruta.',
    ],
    tab: 'methods',
  },
  {
    id: 'payment_route',
    title: 'Selección de ruta de pago',
    description:
      'Elige automáticamente el flujo de autorización/captura según el método de pago (tarjeta, wallet, PSE o corresponsal).',
    endpoint: 'POST /strategy/payment_route',
    component: 'PaymentRoute',
    sample: `POST /strategy/payment_route { "payment_method": "card", "amount": 950, "currency": "MXN", "provider": "stripe" }`,
    steps: [
      'Introduce el método, monto, moneda y proveedor.',
      'El componente usa la estrategia correspondiente (`CardStrategy`, `PSEStrategy`, etc.) para devolver pasos como `token-verify` o `bank-redirect`.',
      'Utiliza esa ruta para construir el speech o para alimentar el flujo del agente.',
    ],
    tab: 'route',
  },
  {
    id: 'negotiation',
    title: 'Propuesta de negociación',
    description:
      'Genera concesiones automáticas (descuento, parcialidades o híbrido) según segmento, monto vencido, DPD y propensión de pago.',
    endpoint: 'POST /strategy/negotiation_offer',
    component: 'Negotiation',
    sample: `POST /strategy/negotiation_offer { "segmento": "pyme", "amount_due": 13400, "dpd": 45, "propension_pago": 0.68 }`,
    steps: [
      'Selecciona el segmento y envía el contexto a `StrategyAPI.negotiation`.',
      'El backend responde con la táctica y condiciones recomendadas.',
      'El speech del agente o la UI de conciliación lee esta propuesta antes de avanzar con el pago.',
    ],
    tab: 'negotiation',
  },
  {
    id: 'agent',
    title: 'Decisión integral del agente',
    description:
      'Ejecución orquestada: selecciona cliente, arma contexto, selecciona estrategia de negociación y determina la mejor ruta de pago mientras genera un speech.',
    endpoint: 'POST /agent/decision',
    component: 'Agent',
    sample: `POST /agent/decision { "customer_id": "...", "segmento": "vip", "amount_due": 4200, "dpd": 75, "propension_pago": 0.33, "currency": "MXN" }`,
    steps: [
      'Elige un cliente y completa segmento, monto, DPD, propensión, moneda y canal.',
      'El backend busca el mejor método (o infiere uno de respaldo), selecciona estrategia de negociación y de ruta de pago.',
      'Devuelve `decision` con `payment_route`, `negotiation_proposal` y un `speech` listo para el agente humano.',
      'El botón “Proceder con ruta de pago” vuelve a llamar a `/strategy/payment_route` para confirmar los pasos técnicos.',
    ],
    tab: 'agent',
  },
]

export default function UseCases({ onGoToTab }) {
  return (
    <div className="use-cases">
      <h3>Casos de uso</h3>
      <p className="small">
        Alineado con el backend de `Agente_Cobranza/app.py`. Cada carta resume qué endpoints toca el front y qué pasos
        siguen las vistas antes de actuar.
      </p>
      <div className="use-case-grid">
        {useCases.map(useCase => (
          <article key={useCase.id} className="use-case-card">
            <div className="use-case-header">
              <div>
                <div className="tag">{useCase.component}</div>
                <h4>{useCase.title}</h4>
              </div>
              <span className="endpoint">{useCase.endpoint}</span>
            </div>

            <p className="description">{useCase.description}</p>
            <div className="use-case-sample">
              <strong>Muestra:</strong> <code>{useCase.sample}</code>
            </div>
            <ul className="use-case-steps">
              {useCase.steps.map(step => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            <button className="primary" type="button" onClick={() => onGoToTab?.(useCase.tab)}>
              Ir al módulo
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
