import React, { useEffect, useMemo, useState } from 'react'
import { setToken, getToken } from './api'
import Customers from './components/Customers'
import PaymentMethods from './components/PaymentMethods'
import PaymentRoute from './components/PaymentRoute'
import Negotiation from './components/Negotiation'
import Agent from './components/Agent'
import UseCases from './components/UseCases'


const tabs = [
  { id: 'usecases', label: 'Casos de Uso' },
  { id: 'customers', label: 'Clientes' },
  { id: 'methods', label: 'Métodos de Pago' },
  { id: 'route', label: 'Ruta de Pago' },
  { id: 'negotiation', label: 'Negociación' },
  { id: 'agent', label: 'Agente' },        // <-- NUEVO
]


export default function App() {
  const [active, setActive] = useState('usecases')
  const [token, setTokenState] = useState(getToken())

  useEffect(() => { setToken(token) }, [token])

  const Content = useMemo(() => {
    switch (active) {
      case 'usecases': return <UseCases onGoToTab={setActive} />
      case 'customers': return <Customers />
      case 'methods': return <PaymentMethods />
      case 'route': return <PaymentRoute />
      case 'negotiation': return <Negotiation />
      case 'agent': return <Agent />             // <-- NUEVO
      default: return null
    }
  }, [active])
  

  return (
    <div className="container">
      <div className="header">
        <div className="brand">Agente de Cobranza</div>
        <div className="token">
          <label>
            Token Bearer
            <input
              placeholder="pega tu token aquí"
              value={token}
              onChange={e => setTokenState(e.target.value)}
            />
          </label>
          <button onClick={() => setTokenState('demo-token')}>Usar demo</button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab ${active === t.id ? 'active' : ''}`} onClick={() => setActive(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel">
        {Content}
      </div>
    </div>
  )
}
