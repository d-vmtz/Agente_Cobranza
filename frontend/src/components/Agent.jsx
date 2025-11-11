// src/components/Agent.jsx
import React, { useEffect, useState } from 'react'
import { CustomersAPI, AgentAPI, StrategyAPI, PaymentMethodsAPI } from '../api'

/**
 * Agente Inteligente (CRUD de Clientes + Cobranza)
 * - Acciones: Crear, Editar, Eliminar, Listar, Decidir Cobranza
 * - Entradas: name, email, phone (E1: edición full obligatoria)
 * - Flujo de cobranza: selecciona cliente → captura contexto → confirma → /agent/decision → mostrar y proceder /strategy/payment_route
 */

export default function Agent() {
  // Chat messages
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hola, soy tu Agente de Cobranza. ¿Qué quieres hacer?' }
  ])

  // Modo / etapa del wizard
  const [mode, setMode] = useState('idle') // idle | create_* | edit_* | delete_* | list_done | decision_*
  // Datos temporales para create/edit
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  // Clientes y selección
  const [customers, setCustomers] = useState([])
  const [selected, setSelected] = useState(null)

  // Flujo de cobranza (decision)
  const [decision, setDecision] = useState({
    customer_id: '',
    segmento: '',
    amount_due: '',
    dpd: '',
    propension_pago: '',
    currency: 'MXN',
    channel: ''
  })
  const [decisionResult, setDecisionResult] = useState(null) // respuesta /agent/decision

  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('') // input para pasos de texto

  // Helpers de chat
  function say(text) {
    setMessages(m => [...m, { role: 'assistant', text }])
  }
  function userSay(text) {
    setMessages(m => [...m, { role: 'user', text }])
  }

  // Acciones de alto nivel (botones rápidos)
  function showMainActions() {
    setMode('idle')
    say('Acciones disponibles:')
  }

  // Cargar clientes cuando se necesiten
  async function loadCustomers() {
    setLoading(true)
    try {
      const data = await CustomersAPI.list()
      setCustomers(data)
      return data
    } catch (e) {
      say(`⚠️ Error al cargar clientes: ${e.message}`)
      return []
    } finally {
      setLoading(false)
    }
  }

  // === Flujos: CREAR ===
  function startCreate() {
    setForm({ name: '', email: '', phone: '' })
    say('Vamos a crear un cliente. ¿Cuál es el nombre?')
    setMode('create_name')
  }

  async function handleCreateInput(text) {
    if (mode === 'create_name') {
      if (!text.trim()) return say('El nombre es obligatorio. Ingresa un nombre.')
      setForm(f => ({ ...f, name: text.trim() }))
      say('Gracias. Ahora, correo electrónico:')
      setMode('create_email')
      return
    }
    if (mode === 'create_email') {
      if (!text.trim() || !text.includes('@')) return say('Email inválido. Ingresa un correo válido.')
      setForm(f => ({ ...f, email: text.trim() }))
      say('Perfecto. Teléfono (puede ser con +57, +52, etc.):')
      setMode('create_phone')
      return
    }
    if (mode === 'create_phone') {
      if (!text.trim()) return say('El teléfono es obligatorio en este flujo. Ingresa un teléfono.')
      setForm(f => ({ ...f, phone: text.trim() }))
      say(`Confirma creación:\n- Nombre: ${form.name}\n- Email: ${form.email}\n- Teléfono: ${text.trim()}\n¿Confirmar creación?`)
      setMode('create_confirm')
      return
    }
  }

  async function confirmCreate(ok) {
    if (!ok) {
      say('Creación cancelada. ¿Qué más quieres hacer?')
      return showMainActions()
    }
    setLoading(true)
    try {
      await CustomersAPI.create({ ...form })
      say('✅ Cliente creado correctamente.')
    } catch (e) {
      say(`⚠️ Error al crear: ${e.message}`)
    } finally {
      setLoading(false)
      showMainActions()
    }
  }

  // === Flujos: EDITAR ===
  async function startEdit() {
    const data = await loadCustomers()
    if (!data.length) {
      say('No hay clientes para editar.')
      return showMainActions()
    }
    say('Selecciona el cliente a editar:')
    setMode('edit_select')
  }

  function selectCustomerForEdit(c) {
    setSelected(c)
    setForm({ name: c.name || '', email: c.email || '', phone: c.phone || '' })
    say(`Editar a: ${c.name}\nIngresa el NUEVO nombre (actual: ${c.name || '—'})`)
    setMode('edit_name')
  }

  async function handleEditInput(text) {
    if (mode === 'edit_name') {
      if (!text.trim()) return say('El nombre es obligatorio. Ingresa un nombre.')
      setForm(f => ({ ...f, name: text.trim() }))
      say(`Ahora el NUEVO email (actual: ${selected?.email || '—'})`)
      setMode('edit_email')
      return
    }
    if (mode === 'edit_email') {
      if (!text.trim() || !text.includes('@')) return say('Email inválido. Ingresa un correo válido.')
      setForm(f => ({ ...f, email: text.trim() }))
      say(`Finalmente el NUEVO teléfono (actual: ${selected?.phone || '—'})`)
      setMode('edit_phone')
      return
    }
    if (mode === 'edit_phone') {
      if (!text.trim()) return say('El teléfono es obligatorio en edición E1. Ingresa un teléfono.')
      setForm(f => ({ ...f, phone: text.trim() }))
      say(`Confirma edición para ${selected?.name}:\n- Nombre: ${form.name}\n- Email: ${form.email}\n- Teléfono: ${text.trim()}\n¿Guardar cambios?`)
      setMode('edit_confirm')
      return
    }
  }

  async function confirmEdit(ok) {
    if (!ok) {
      say('Edición cancelada. ¿Qué más quieres hacer?')
      return showMainActions()
    }
    setLoading(true)
    try {
      await CustomersAPI.update(selected.id, { ...form })
      say('✅ Cliente actualizado correctamente.')
    } catch (e) {
      say(`⚠️ Error al actualizar: ${e.message}`)
    } finally {
      setLoading(false)
      setSelected(null)
      showMainActions()
    }
  }

  // === Flujos: ELIMINAR ===
  async function startDelete() {
    const data = await loadCustomers()
    if (!data.length) {
      say('No hay clientes para eliminar.')
      return showMainActions()
    }
    say('Selecciona el cliente a eliminar:')
    setMode('delete_select')
  }

  function selectCustomerForDelete(c) {
    setSelected(c)
    say(`Vas a eliminar a: ${c.name} (${c.email}). ¿Confirmas?`)
    setMode('delete_confirm')
  }

  async function confirmDelete(ok) {
    if (!ok) {
      say('Eliminación cancelada. ¿Qué más quieres hacer?')
      setSelected(null)
      return showMainActions()
    }
    setLoading(true)
    try {
      await CustomersAPI.remove(selected.id)
      say('🗑️ Cliente eliminado.')
    } catch (e) {
      say(`⚠️ Error al eliminar: ${e.message}`)
    } finally {
      setLoading(false)
      setSelected(null)
      showMainActions()
    }
  }

  // === Flujos: LISTAR ===
  async function startList() {
    const data = await loadCustomers()
    if (!data.length) {
      say('No hay clientes registrados.')
      return showMainActions()
    }
    const lines = data.slice(0, 10).map(c => `• ${c.name} – ${c.email}${c.phone ? ` – ${c.phone}`:''}`)
    say(`Hay ${data.length} clientes.\n${lines.join('\n')}${data.length>10?'\n…':''}`)
    setMode('list_done')
  }

  // === Flujo: DECIDIR COBRANZA ===
  async function startDecision() {
    const data = await loadCustomers()
    if (!data.length) {
      say('No hay clientes para cobrar.')
      return showMainActions()
    }
    setDecision({
      customer_id: '',
      segmento: '',
      amount_due: '',
      dpd: '',
      propension_pago: '',
      currency: 'MXN',
      channel: ''
    })
    setDecisionResult(null)
    say('Selecciona el cliente para iniciar la decisión de cobranza:')
    setMode('decision_select')
  }

  function selectCustomerForDecision(c) {
    setSelected(c)
    setDecision(d => ({ ...d, customer_id: c.id }))
    say(`Cliente: ${c.name}\nIngresa el segmento (ej: VIP, consumo, pyme):`)
    setMode('decision_segmento')
  }

  function isFloat(n) { return !isNaN(n) && n !== '' }

  async function handleDecisionInput(text) {
    // 1) segmento
    if (mode === 'decision_segmento') {
      if (!text.trim()) return say('El segmento es obligatorio. Ejemplos: VIP, consumo, pyme.')
      setDecision(d => ({ ...d, segmento: text.trim() }))
      say('Monto adeudado (amount_due) en número, ej: 1500:')
      setMode('decision_amount')
      return
    }
    // 2) amount_due
    if (mode === 'decision_amount') {
      if (!isFloat(text)) return say('Monto inválido. Escribe un número (ej: 1500).')
      setDecision(d => ({ ...d, amount_due: text.trim() }))
      say('Días de atraso (dpd), ej: 45:')
      setMode('decision_dpd')
      return
    }
    // 3) dpd
    if (mode === 'decision_dpd') {
      const n = parseInt(text, 10)
      if (isNaN(n)) return say('DPD inválido. Debe ser número entero (ej: 45).')
      setDecision(d => ({ ...d, dpd: String(n) }))
      say('Propensión de pago (0.0 a 1.0), ej: 0.65:')
      setMode('decision_prop')
      return
    }
    // 4) propensión
    if (mode === 'decision_prop') {
      const f = parseFloat(text)
      if (isNaN(f) || f < 0 || f > 1) return say('Propensión inválida. Debe ser número entre 0 y 1.')
      setDecision(d => ({ ...d, propension_pago: String(f) }))
      say('Moneda (currency). Enter para dejar MXN o escribe COP/USD/etc.:')
      setMode('decision_currency')
      return
    }
    // 5) currency
    if (mode === 'decision_currency') {
      const cur = (text || 'MXN').trim().toUpperCase()
      setDecision(d => ({ ...d, currency: cur || 'MXN' }))
      say('Canal (channel) — opcional (ej: whatsapp, web, ivr). Enter para omitir:')
      setMode('decision_channel')
      return
    }
    // 6) channel
    if (mode === 'decision_channel') {
      setDecision(d => ({ ...d, channel: text.trim() }))
      const preview = d => (
        `Confirma la decisión de cobranza:\n` +
        `- Cliente: ${selected?.name}\n` +
        `- Segmento: ${d.segmento}\n` +
        `- Monto: ${d.amount_due} ${d.currency}\n` +
        `- DPD: ${d.dpd}\n` +
        `- Propensión: ${d.propension_pago}\n` +
        `- Canal: ${d.channel || '—'}\n¿Continuar?`
      )
      setTimeout(() => {
        setMode('decision_confirm')
        say(preview({
          ...decision,
          channel: text.trim()
        }))
      }, 0)
      return
    }
  }

  async function confirmDecision(ok) {
    if (!ok) {
      say('Decisión cancelada. ¿Qué más quieres hacer?')
      setSelected(null)
      setDecisionResult(null)
      return showMainActions()
    }
    setLoading(true)
    try {
      const payload = {
        customer_id: decision.customer_id,
        segmento: decision.segmento,
        amount_due: parseFloat(decision.amount_due),
        dpd: parseInt(decision.dpd, 10),
        propension_pago: parseFloat(decision.propension_pago),
        currency: decision.currency,
        channel: decision.channel || undefined
      }
      const data = await AgentAPI.decision(payload)
      setDecisionResult(data?.decision || null)

      const speech = data?.decision?.speech || 'Propuesta generada.'
      say(`🧠 ${speech}`)
      setMode('decision_result')
    } catch (e) {
      say(`⚠️ Error al decidir: ${e.message}`)
      setMode('list_done')
    } finally {
      setLoading(false)
    }
  }

  async function proceedPaymentRoute() {
    if (!decisionResult) return
    setLoading(true)
    try {
      const best = decisionResult.best_payment_method || {}
      const route = await StrategyAPI.paymentRoute({
        payment_method: best.type || decisionResult.payment_route?.method || 'card',
        amount: decisionResult.payment_route?.amount || parseFloat(decision.amount_due),
        currency: decision.currency || decisionResult.payment_route?.currency,
        provider: best.provider,
        metadata: { customer_id: decision.customer_id, channel: decision.channel || undefined }
      })
      say(`✅ Ruta de pago creada/confirmada: método ${route?.route?.method} vía ${route?.route?.routed_to}. Pasos: ${(route?.route?.steps || []).join(' → ')}.`)
    } catch (e) {
      say(`⚠️ Error al preparar la ruta de pago: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Manejar submit del input libre (create/edit/decision steps)
  async function onSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text }])

    if (mode.startsWith('create_')) return handleCreateInput(text)
    if (mode.startsWith('edit_'))   return handleEditInput(text)
    if (mode.startsWith('decision_')) return handleDecisionInput(text)

    say('Estoy esperando que selecciones una opción de las disponibles aquí abajo.')
  }

  // Render de quick actions (botones)
  function ActionsBar() {
    if (['idle', 'list_done'].includes(mode)) {
      return (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button className="primary" onClick={startCreate}>➕ Crear</button>
          <button onClick={startEdit}>✏️ Editar</button>
          <button className="danger" onClick={startDelete}>🗑️ Eliminar</button>
          <button onClick={startList}>📋 Listar</button>
          <button onClick={startDecision}>🤖 Decidir Cobranza</button>
        </div>
      )
    }

    // Confirmaciones CRUD
    if (mode === 'create_confirm') {
      return (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="primary" onClick={() => confirmCreate(true)}>✅ Confirmar</button>
          <button onClick={() => confirmCreate(false)}>Cancelar</button>
        </div>
      )
    }
    if (mode === 'edit_confirm') {
      return (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="primary" onClick={() => confirmEdit(true)}>💾 Guardar</button>
          <button onClick={() => confirmEdit(false)}>Cancelar</button>
        </div>
      )
    }
    if (mode === 'delete_confirm') {
      return (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="danger" onClick={() => confirmDelete(true)}>Eliminar</button>
          <button onClick={() => confirmDelete(false)}>Cancelar</button>
        </div>
      )
    }

    // Selecciones (editar / eliminar / decision): lista de clientes como botones
    if (mode === 'edit_select' || mode === 'delete_select' || mode === 'decision_select') {
      return (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {loading && <div className="small">Cargando clientes…</div>}
          {!loading && customers.map(c => (
            <button
              key={c.id}
              onClick={() => (
                mode === 'edit_select' ? selectCustomerForEdit(c) :
                mode === 'delete_select' ? selectCustomerForDelete(c) :
                selectCustomerForDecision(c)
              )}
              style={{
                textAlign: 'left',
                background: '#141414',
                border: '1px solid #222',
                padding: '10px 12px',
                borderRadius: 10
              }}
            >
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div className="small">{c.email}{c.phone ? ` · ${c.phone}` : ''}</div>
            </button>
          ))}
          <div className="row" style={{ gap: 8 }}>
            <button onClick={showMainActions}>⬅️ Volver</button>
          </div>
        </div>
      )
    }

    // Confirmación de decisión
    if (mode === 'decision_confirm') {
      return (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="primary" onClick={() => confirmDecision(true)}>🧠 Continuar</button>
          <button onClick={() => confirmDecision(false)}>Cancelar</button>
        </div>
      )
    }

    // Resultado de decisión: permitir proceder con la ruta de pago
    if (mode === 'decision_result') {
      return (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="primary" onClick={proceedPaymentRoute} disabled={loading}>
            {loading ? 'procesando…' : '⚡ Proceder con ruta de pago'}
          </button>
          <button onClick={showMainActions}>Finalizar</button>
        </div>
      )
    }

    // Mientras se piden campos (create/edit/decision)
    if (mode.startsWith('create_') || mode.startsWith('edit_') || (mode.startsWith('decision_') && mode !== 'decision_confirm')) {
      return (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <span className="small" style={{ opacity: .7 }}>Escribe tu respuesta en el campo de abajo</span>
          <button onClick={showMainActions}>Cancelar</button>
        </div>
      )
    }

    return null
  }

  // Mostrar un “resumen” visual del estado actual
  function StatusBar() {
    if (mode.startsWith('create_')) {
      return (
        <div className="small" style={{ opacity: .8, marginTop: 6 }}>
          Creando cliente… {form.name && `Nombre: ${form.name} · `}{form.email && `Email: ${form.email} · `}{form.phone && `Tel: ${form.phone}`}
        </div>
      )
    }
    if (mode.startsWith('edit_')) {
      return (
        <div className="small" style={{ opacity: .8, marginTop: 6 }}>
          Editando: {selected?.name || '—'} {form.name && `→ nombre: ${form.name}`} {form.email && `· email: ${form.email}`} {form.phone && `· tel: ${form.phone}`}
        </div>
      )
    }
    if (mode.startsWith('decision_')) {
      return (
        <div className="small" style={{ opacity: .8, marginTop: 6 }}>
          Decisión de cobranza… {selected?.name ? `Cliente: ${selected.name} · ` : '' }
          {decision.segmento && `Seg: ${decision.segmento} · `}
          {decision.amount_due && `Monto: ${decision.amount_due} ${decision.currency} · `}
          {decision.dpd && `DPD: ${decision.dpd} · `}
          {decision.propension_pago && `Prop: ${decision.propension_pago}`}
        </div>
      )
    }
    return null
  }

  // Primera vez: mostrar acciones
  useEffect(() => {
    setMode('idle')
  }, [])

  return (
    <div>
      <h3>Agente Inteligente</h3>

      <div style={{
        background:'#111',
        padding:18,
        borderRadius:12,
        height:360,
        overflowY:'auto',
        border:'1px solid #222'
      }}>
        {messages.map((m,i)=>(
          <div key={i} style={{marginBottom:14}}>
            <div style={{fontSize:12, opacity:.55, marginBottom:4}}>{m.role}</div>
            <div>{m.text.split('\n').map((line,idx)=><div key={idx}>{line}</div>)}</div>
          </div>
        ))}

        {/* Si hay resultado de decisión, renderiza un resumen estructurado */}
        {decisionResult && (
          <div style={{marginTop:10, padding:10, border:'1px solid #222', borderRadius:10, background:'#141414'}}>
            <div style={{fontWeight:700, marginBottom:6}}>Resumen de Decisión</div>
            <div className="small">Mejor método de pago: {decisionResult?.best_payment_method?.type || '—'} ({decisionResult?.best_payment_method?.provider || '—'})</div>
            <div className="small">Ruta: {decisionResult?.payment_route?.method || '—'} → {decisionResult?.payment_route?.routed_to || '—'}</div>
            <div className="small">Pasos: {(decisionResult?.payment_route?.steps || []).join(' → ') || '—'}</div>
            <div className="small">Propuesta: {(() => {
              const p = decisionResult?.negotiation_proposal || {};
              if (!p?.tactic) return '—';
              if (p.tactic === 'discount') return `Descuento ${Math.round((p.discount_pct||0)*100)}%`;
              if (p.tactic === 'installments') return `${p.installments} mensualidades sin interés`;
              if (p.tactic === 'hybrid') return `Híbrida: ${Math.round((p.discount_pct||0)*100)}% + ${p.installments} MSI`;
              return p.tactic;
            })()}</div>
          </div>
        )}
      </div>

      <StatusBar />
      <ActionsBar />

      {/* Campo de entrada cuando se esperan datos */}
      {(mode.startsWith('create_') || mode.startsWith('edit_') || (
        mode.startsWith('decision_') && !['decision_select','decision_confirm','decision_result'].includes(mode)
      )) && (
        <form onSubmit={onSend} style={{display:'flex', gap:10, marginTop:12}}>
          <input
            value={input}
            onChange={e=>setInput(e.target.value)}
            placeholder="Escribe aquí…"
            style={{flex:1}}
          />
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'procesando…' : 'Enviar'}
          </button>
        </form>
      )}

      {/* Cuando estamos en modos de selección/confirmación/resultado, ocultamos el input libre */}
      {(!mode.startsWith('create_') && !mode.startsWith('edit_') && !(
        mode.startsWith('decision_') && !['decision_select','decision_confirm','decision_result'].includes(mode)
      )) && (
        <div className="small" style={{ marginTop: 8, opacity: .6 }}>
          Usa los botones para continuar.
        </div>
      )}
    </div>
  )
}
