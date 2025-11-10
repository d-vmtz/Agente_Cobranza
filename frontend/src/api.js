const BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:6012'

// Token helpers
export function setToken(token) {
  localStorage.setItem('token', token || '')
}

export function getToken() {
  return localStorage.getItem('token') || ''
}

// Core fetch wrapper
async function apiFetch(path, options = {}) {
  const token = getToken()

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 204) return null

  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { error: text }
  }

  if (!res.ok) {
    const message = data?.mensaje || data?.error || `Error ${res.status}`
    throw new Error(message)
  }

  return data
}

// Customers API
export const CustomersAPI = {
  list: () => apiFetch('/customers'),
  create: (payload) => apiFetch('/customers', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) => apiFetch(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id) => apiFetch(`/customers/${id}`, { method: 'DELETE' }),
}

// Payment Methods API
export const PaymentMethodsAPI = {
  list: () => apiFetch('/payment_methods'),
  create: (payload) => apiFetch('/payment_methods', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) => apiFetch(`/payment_methods/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (id) => apiFetch(`/payment_methods/${id}`, { method: 'DELETE' }),
}

// Strategy API
export const StrategyAPI = {
  paymentRoute: (payload) => apiFetch('/strategy/payment_route', { method: 'POST', body: JSON.stringify(payload) }),
  negotiation: (payload) => apiFetch('/strategy/negotiation_offer', { method: 'POST', body: JSON.stringify(payload) }),
}
