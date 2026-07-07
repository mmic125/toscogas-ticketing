import { createContext, useContext, useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]                     = useState(null)
  const [profilo, setProfilo]               = useState(null)
  const [loading, setLoading]               = useState(true)
  const [profiloLoading, setProfiloLoading] = useState(false)

  async function caricaProfilo() {
    setProfiloLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      if (!token) { setProfilo(null); return }
      const r = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!r.ok) throw new Error('Errore caricamento profilo')
      const data = await r.json()
      setProfilo(data)
    } catch (e) {
      console.error('Errore caricamento profilo:', e)
      setProfilo(null)
    } finally {
      setProfiloLoading(false)
    }
  }

  async function initAuth() {
    const token = localStorage.getItem('access_token')
    if (!token) { setLoading(false); return }
    try {
      const r = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (r.ok) {
        const data = await r.json()
        setUser({ id: data.id, email: data.email })
        setProfilo(data)
      } else {
        // Prova refresh
        const refreshed = await tryRefresh()
        if (!refreshed) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        }
      }
    } catch (e) {
      console.error('initAuth error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function tryRefresh() {
    const refresh_token = localStorage.getItem('refresh_token')
    if (!refresh_token) return false
    try {
      const r = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token }),
      })
      if (!r.ok) return false
      const { access_token, refresh_token: new_refresh } = await r.json()
      localStorage.setItem('access_token', access_token)
      if (new_refresh) localStorage.setItem('refresh_token', new_refresh)
      await caricaProfilo()
      return true
    } catch { return false }
  }

  useEffect(() => { initAuth() }, [])

  async function login(email, password) {
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Login fallito')
    localStorage.setItem('access_token', data.access_token)
    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
    setUser({ id: data.user.id, email: data.user.email })
    setProfilo(data.user)
    return data
  }

  async function logout() {
    const token = localStorage.getItem('access_token')
    const refresh_token = localStorage.getItem('refresh_token')
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ refresh_token }),
    }).catch(() => {})
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
    setProfilo(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      profilo,
      ruolo: profilo?.ruolo ?? null,
      loading,
      profiloLoading,
      login,
      logout,
      caricaProfilo,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider')
  return ctx
}
