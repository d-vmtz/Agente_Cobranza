import React, { useState } from 'react'
import { StrategyAPI } from '../api'

export default function Negotiation() {
  const [payload, setPayload] = useState({ segmento: 'consumo', amount_due: 12000, dpd: 45, propension_pago: 0.62 })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault(); setError(''); setResult(null)
    const p = { ...payload, amount_due: Number(payload.amount_due), dpd: Number(payload.dpd), propension_pago: Number(payload.propension_pago) }
    if (!p.segmento || isNaN(p.amount_due) || isNaN(p.dpd) || isNaN(p.propension_pago)) {
      setError('segmento, amount_due, dpd y propension_pago son obligatorios')
      return
    }
    try {
      const res = await StrategyAPI.negotiation(p)
      setResult(res)
    } catch (e) { setError(e.message) }
  }

  return (
    <div>
      <h3>Negociación</h3>
      <form onSubmit={onSubmit} className="row" style={{gap: 12}}>
        <label>
          Segmento
          <select value={payload.segmento} onChange={e => setPayload(p => ({...p, segmento: e.target.value}))}>
            <option value="consumo">consumo</option>
            <option value="pyme">pyme</option>
            <option value="vip">vip</option>
            <option value="consumo_alto">consumo_alto</option>
          </select>
        </label>
        <label>
          Monto Adeudado
          <input value={payload.amount_due} onChange={e => setPayload(p => ({...p, amount_due: e.target.value}))} />
        </label>
        <label>
          DPD
          <input value={payload.dpd} onChange={e => setPayload(p => ({...p, dpd: e.target.value}))} />
        </label>
        <label>
          Propensión
          <input value={payload.propension_pago} onChange={e => setPayload(p => ({...p, propension_pago: e.target.value}))} />
        </label>
        <button className="primary" type="submit">Proponer</button>
      </form>
      {error && <div className="error">{error}</div>}
      {result && (
        <div className="card" style={{marginTop: 12}}>
          <div><b>status:</b> {result.status}</div>
          <div className="small">tactic: {result.proposal?.tactic}</div>
          {'discount_pct' in (result.proposal||{}) && <div className="small">discount: {result.proposal.discount_pct}</div>}
          {'installments' in (result.proposal||{}) && <div className="small">installments: {result.proposal.installments}</div>}
          <div className="small">conditions: {(result.proposal?.conditions||[]).join(', ')}</div>
        </div>
      )}
    </div>
  )
}

