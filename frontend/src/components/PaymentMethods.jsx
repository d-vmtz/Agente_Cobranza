import React, { useEffect, useState } from 'react'
import { CustomersAPI, PaymentMethodsAPI } from '../api'

export default function PaymentMethods() {
  const [list, setList] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    customer_id: '',
    type: 'card',
    provider: 'stripe',
    token: '',
    last4: '',
    expiry_month: '',
    expiry_year: '',
    is_default: false
  })

  async function load() {
    setLoading(true); setError('')
    try {
      const [pm, cs] = await Promise.all([
        PaymentMethodsAPI.list(),
        CustomersAPI.list()
      ])
      setList(pm); setCustomers(cs)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function onCreate(e) {
    e.preventDefault(); setError(''); setSuccess('')
    if (!form.customer_id || !form.type || !form.token) {
      setError('customer_id, type y token son obligatorios')
      return
    }
    try {
      const payload = {
        customer_id: form.customer_id,
        type: form.type,
        provider: form.provider || undefined,
        token: form.token,
        last4: form.last4 || undefined,
        expiry_month: form.expiry_month ? Number(form.expiry_month) : undefined,
        expiry_year: form.expiry_year ? Number(form.expiry_year) : undefined,
        is_default: !!form.is_default,
      }
      await PaymentMethodsAPI.create(payload)
      setSuccess('Método creado'); setForm(f => ({...f, token:'', last4:''}))
      load()
    } catch (e) { setError(e.message) }
  }

  async function onDelete(id) {
    if (!confirm('¿Eliminar método?')) return
    setError(''); setSuccess('')
    try { await PaymentMethodsAPI.remove(id); setSuccess('Método eliminado'); load() } catch (e) { setError(e.message) }
  }

  return (
    <div>
      <h3>Métodos de Pago</h3>
      <form onSubmit={onCreate} className="row" style={{gap: 12}}>
        <label>
          Cliente
          <select value={form.customer_id} onChange={e => setForm(f => ({...f, customer_id: e.target.value}))}>
            <option value="">Seleccione...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          Tipo
          <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
            <option value="card">card</option>
            <option value="wallet">wallet</option>
            <option value="pse">pse</option>
            <option value="corresponsal">corresponsal</option>
          </select>
        </label>
        <label>
          Provider
          <input value={form.provider} onChange={e => setForm(f => ({...f, provider: e.target.value}))} />
        </label>
        <label>
          Token
          <input value={form.token} onChange={e => setForm(f => ({...f, token: e.target.value}))} placeholder="tok_xxx" />
        </label>
        <label>
          Last4
          <input value={form.last4} onChange={e => setForm(f => ({...f, last4: e.target.value}))} placeholder="4242" />
        </label>
        <label>
          Exp MM
          <input value={form.expiry_month} onChange={e => setForm(f => ({...f, expiry_month: e.target.value}))} placeholder="12" />
        </label>
        <label>
          Exp YYYY
          <input value={form.expiry_year} onChange={e => setForm(f => ({...f, expiry_year: e.target.value}))} placeholder="2027" />
        </label>
        <label>
          Default
          <select value={form.is_default ? '1':'0'} onChange={e => setForm(f => ({...f, is_default: e.target.value==='1'}))}>
            <option value="0">No</option>
            <option value="1">Sí</option>
          </select>
        </label>
        <button className="primary" type="submit">Crear</button>
      </form>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
      <div className="spacer" />
      <div className="small">{loading ? 'Cargando...' : `${list.length} métodos`}</div>
      <div className="list">
        {list.map(pm => (
          <div key={pm.id} className="card">
            <div><b>{pm.type}</b> <span className="small">({pm.provider||'n/a'})</span></div>
            <div className="small">Cliente: {pm.customer_id}</div>
            {pm.last4 && <div className="small">•••• {pm.last4}</div>}
            <div className="small">ID: {pm.id}</div>
            <div className="spacer" />
            <button className="danger" onClick={() => onDelete(pm.id)}>Eliminar</button>
          </div>
        ))}
      </div>
    </div>
  )
}

