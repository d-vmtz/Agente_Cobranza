// src/components/Agent.jsx
import React, { useEffect, useState } from 'react'
import { CustomersAPI } from '../api'

/**
 * Agente Inteligente (CRUD de Clientes)
 * - Acciones pre-hechas (botones): Crear, Editar, Eliminar, Listar, Cancelar
 * - Entradas: name, email, phone (E1: edición full obligatoria)
 * - Usa CustomersAPI para llamar a /customers
 */

export default function Agent() {
  // Chat messages
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hola, soy tu Agente de Cobranza. ¿Qué quieres hacer con clientes?' }
  ])

  // Modo / etapa del wizard
  const [mode, setMode] = useState('idle') // idle | create_name | create_email | create_phone | create_confirm
                                           // edit_select | edit_name | edit_email | edit_phone | edit_confirm
                                           // delete_select | delete_confirm
                                           // list_done
  // Datos temporales para create/edit
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  // Para edición/eliminación: lista y seleccionado
  const [customers, setCustomers] = useState([])
  const [selected, setSelected] = useState(null)

  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('') // input libre cuando se piden campos

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
    // Prefill (E1 requiere volver a pedir, pero mostramos valores actuales)
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

  // Manejar submit del input (cuando se esperan campos)
  async function onSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    // Mostrar lo que escribió el usuario
    setMessages(m => [...m, { role: 'user', text }])

    // Enrutar según modo
    if (mode.startsWith('create_')) {
      return handleCreateInput(text)
    }
    if (mode.startsWith('edit_')) {
      return handleEditInput(text)
    }
    // En modos select/confirm no se usa input libre (se usan botones)
    say('Estoy esperando que selecciones una opción de las disponibles aquí abajo.')
  }

  // Render de quick actions (botones)
  function ActionsBar() {
    // Botones principales cuando esté en idle o luego de terminar algo
    if (['idle', 'list_done'].includes(mode)) {
      return (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button className="primary" onClick={startCreate}>➕ Crear</button>
          <button onClick={startEdit}>✏️ Editar</button>
          <button className="danger" onClick={startDelete}>🗑️ Eliminar</button>
          <button onClick={startList}>📋 Listar</button>
        </div>
      )
    }

    // Confirmaciones
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

    // Selecciones (editar / eliminar): lista de clientes como botones
    if (mode === 'edit_select' || mode === 'delete_select') {
      return (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {loading && <div className="small">Cargando clientes…</div>}
          {!loading && customers.map(c => (
            <button
              key={c.id}
              onClick={() => (mode === 'edit_select') ? selectCustomerForEdit(c) : selectCustomerForDelete(c)}
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

    // Mientras se piden campos (create/edit), mostramos un recordatorio y un botón cancelar
    if (mode.startsWith('create_') || mode.startsWith('edit_')) {
      return (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <span className="small" style={{ opacity: .7 }}>Escribe tu respuesta en el campo de abajo</span>
          <button onClick={showMainActions}>Cancelar</button>
        </div>
      )
    }

    // Fallback
    return null
  }

  // Mostrar un “resumen” visual del estado actual (opcional)
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
    return null
  }

  // Primera vez: mostrar acciones
  useEffect(() => {
    // mostrar barra principal tras cargar
    // (si el primer mensaje ya está, solo aseguramos estado)
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
      </div>

      <StatusBar />
      <ActionsBar />

      {/* Campo de entrada solo cuando se esperan datos */}
      {(mode.startsWith('create_') || mode.startsWith('edit_')) && (
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

      {/* Cuando estamos en modos de selección/confirmación, ocultamos el input libre */}
      {(!mode.startsWith('create_') && !mode.startsWith('edit_')) && (
        <div className="small" style={{ marginTop: 8, opacity: .6 }}>
          Usa los botones para continuar.
        </div>
      )}
    </div>
  )
}
