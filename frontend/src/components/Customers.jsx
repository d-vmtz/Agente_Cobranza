import React, { useEffect, useState } from 'react'
import { CustomersAPI } from '../api'

export default function Customers() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({ name: '', email: '', phone: '' })

  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState({ id:'', name:'', email:'', phone:'' })

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await CustomersAPI.list()
      setList(data)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function onCreate(e) {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!form.name || !form.email) return setError('Nombre y Email son obligatorios')
    try {
      await CustomersAPI.create({ ...form })
      setForm({ name:'', email:'', phone:'' })
      setSuccess('Cliente creado')
      load()
    } catch (e) { setError(e.message) }
  }

  async function onDelete(id) {
    if (!confirm('¿Eliminar cliente?')) return
    setError(''); setSuccess('')
    try { await CustomersAPI.remove(id); setSuccess('Cliente eliminado'); load() } catch (e) { setError(e.message) }
  }

  function openEditModal(c) {
    setEditData({ id:c.id, name:c.name, email:c.email, phone:c.phone || '' })
    setShowModal(true)
  }

  async function saveEdit(e) {
    e.preventDefault(); setError(''); setSuccess('')
    try {
      await CustomersAPI.update(editData.id, {
        name: editData.name, email: editData.email, phone: editData.phone || undefined
      })
      setShowModal(false)
      setSuccess('Cliente actualizado')
      load()
    } catch (e) { setError(e.message) }
  }

  return (
    <div>
      <h3>Clientes</h3>

      <form onSubmit={onCreate} className="row" style={{gap:12}}>
        <label>Nombre
          <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Juan Pérez" />
        </label>
        <label>Email
          <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="juan@example.com" />
        </label>
        <label>Teléfono
          <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+52 55..." />
        </label>
        <button className="primary" type="submit">Crear</button>
      </form>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
      <div className="spacer" />

      <div className="small">{loading ? 'Cargando...' : `${list.length} clientes`}</div>

      <div className="list">
        {list.map(c => (
          <div key={c.id} className="card">
            <div><b>{c.name}</b></div>
            <div className="small">{c.email}</div>
            {c.phone && <div className="small">{c.phone}</div>}
            <div className="small">ID: {c.id}</div>

            <div style={{display:'flex', gap:8, marginTop:12}}>
              <button className="primary" onClick={() => openEditModal(c)}>Editar</button>
              <button className="danger" onClick={() => onDelete(c.id)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div
          onClick={(e)=> e.target===e.currentTarget && setShowModal(false)}
          style={{
            position:'fixed', inset:0,
            background:'rgba(0,0,0,0.60)',
            display:'flex', alignItems:'center', justifyContent:'center',
            zIndex:999
          }}
        >
          <div style={{
            background:'#121621',
            padding:24,
            width:400,
            borderRadius:14,
            border:'1px solid rgba(255,255,255,0.08)',
            boxShadow:'0 0 35px rgba(0,0,0,0.4)'
          }}>
            <h4 style={{color:'#fff'}}>Editar Cliente</h4>

            <form onSubmit={saveEdit} className="row" style={{gap:12}}>
              <label style={{color:'#9FA3B4'}}>Nombre
                <input style={{background:'#0D1117',color:'#fff'}} value={editData.name} onChange={e=>setEditData(d=>({...d,name:e.target.value}))}/>
              </label>
              <label style={{color:'#9FA3B4'}}>Email
                <input style={{background:'#0D1117',color:'#fff'}} value={editData.email} onChange={e=>setEditData(d=>({...d,email:e.target.value}))}/>
              </label>
              <label style={{color:'#9FA3B4'}}>Teléfono
                <input style={{background:'#0D1117',color:'#fff'}} value={editData.phone} onChange={e=>setEditData(d=>({...d,phone:e.target.value}))}/>
              </label>

              <div style={{display:'flex', gap:10, marginTop:10}}>
                <button className="primary" type="submit" style={{padding:'10px 16px'}}>Guardar</button>
                <button className="danger" type="button" style={{padding:'10px 16px'}} onClick={()=>setShowModal(false)}>Cerrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
