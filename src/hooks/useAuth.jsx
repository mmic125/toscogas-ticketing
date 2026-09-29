import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || ''
const AuthContext = createContext(null)

const IDLE_TIMEOUT_MS   = 15 * 60 * 1000  // 15 min di inattività
const SESSION_MAX_MS    = 8 * 60 * 60 * 1000  // 8 ore dal login
const REFRESH_INTERVAL_MS = 10 * 60 * 1000  // rinnova il token prima che scada (15 min)
const ATTIVITA_EVENTI   = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser]                     = useState(null)
  const [profilo, setProfilo]               = useState(null)
  const [loading, setLoading]               = useState(true)
  const [profiloLoading, setProfiloLoading] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

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
        const refreshed = await tryRefresh()
        if (!refreshed) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('login_at')
          setSessionExpired(true)
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
    setSessionExpired(false)
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Login fallito')

    // Se richiede TOTP, non salvare nulla — il Login gestirà lo step 2
    if (data.totp_required) return data

    localStorage.setItem('access_token', data.access_token)
    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
    localStorage.setItem('login_at', String(Date.now()))
    setUser({ id: data.user.id, email: data.user.email })
    setProfilo(data.user)
    return data
  }

  async function completaLoginTotp(temp_token, code) {
    setSessionExpired(false)
    const r = await fetch(`${API_BASE}/auth/totp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temp_token, code }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Codice non valido')

    localStorage.setItem('access_token', data.access_token)
    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
    localStorage.setItem('login_at', String(Date.now()))
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
    localStorage.removeItem('login_at')
    setUser(null)
    setProfilo(null)
  }

  // Logout automatico per inattività (15 min) o durata massima sessione (8h)
  async function forceLogout() {
    setSessionExpired(true)
    await logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    if (!user) return

    let idleTimer
    function resetIdleTimer() {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(forceLogout, IDLE_TIMEOUT_MS)
    }

    resetIdleTimer()
    ATTIVITA_EVENTI.forEach(ev => window.addEventListener(ev, resetIdleTimer))

    const sessionInterval = setInterval(() => {
      const loginAt = Number(localStorage.getItem('login_at') || 0)
      if (loginAt && Date.now() - loginAt > SESSION_MAX_MS) forceLogout()
    }, 60 * 1000)

    // Rinnova silenziosamente il token prima che scada (15 min), altrimenti
    // durante un uso continuo senza ricaricare la pagina le richieste
    // finirebbero per fallire non appena l'access token naturale scade.
    const refreshInterval = setInterval(() => {
      tryRefresh()
    }, REFRESH_INTERVAL_MS)

    return () => {
      clearTimeout(idleTimer)
      clearInterval(sessionInterval)
      clearInterval(refreshInterval)
      ATTIVITA_EVENTI.forEach(ev => window.removeEventListener(ev, resetIdleTimer))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return (
    <AuthContext.Provider value={{
      user,
      profilo,
      ruolo: profilo?.ruolo ?? null,
      loading,
      profiloLoading,
      sessionExpired,
      login,
      completaLoginTotp,
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
