import React, { useState } from 'react'
import { StrategyAPI } from '../api'

export default function PaymentRoute() {
  const [payload, setPayload] = useState({ payment_method: 'card', amount: 1000, currency: 'MXN', provider: 'stripe' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault(); setError(''); setResult(null)
    if (!payload.payment_method || !payload.amount) {
      setError('payment_method y amount son obligatorios')
      return
    }
    try {
      const res = await StrategyAPI.paymentRoute({ ...payload, amount: Number(payload.amount) })
      setResult(res)
    } catch (e) { setError(e.message) }
  }

  return (
    <div>
      <h3>Ruta de Pago</h3>
      <form onSubmit={onSubmit} className="row" style={{gap: 12}}>
        <label>
          Método
          <select value={payload.payment_method} onChange={e => setPayload(p => ({...p, payment_method: e.target.value}))}>
            <option value="card">card</option>
            <option value="wallet">wallet</option>
            <option value="pse">pse</option>
            <option value="corresponsal">corresponsal</option>
          </select>
        </label>
        <label>
          Monto
          <input value={payload.amount} onChange={e => setPayload(p => ({...p, amount: e.target.value}))} />
        </label>
        <label>
          Moneda
          <input value={payload.currency} onChange={e => setPayload(p => ({...p, currency: e.target.value}))} />
        </label>
        <label>
          Proveedor
          <input value={payload.provider||''} onChange={e => setPayload(p => ({...p, provider: e.target.value}))} />
        </label>
        <button className="primary" type="submit">Calcular</button>
      </form>
      {error && <div className="error">{error}</div>}
      {result && (
        <div className="card" style={{marginTop: 12}}>
          <div><b>status:</b> {result.status}</div>
          <div className="small">method: {result.route?.method}</div>
          <div className="small">routed_to: {result.route?.routed_to}</div>
          <div className="small">amount: {result.route?.amount} {result.route?.currency}</div>
          {!!(result.route?.steps?.length) && (
            <div className="small">steps: {result.route.steps.join(' → ')}</div>
          )}
        </div>
      )}
    </div>
  )
}

