// Client API auto-hosted — interfaccia compatibile con il client Supabase
// Sostituisce @supabase/supabase-js senza modificare i componenti esistenti

const API_BASE     = import.meta.env.VITE_API_URL || ''
const STORAGE_BASE = `${API_BASE}/api/storage`

// ── Gestione token ────────────────────────────────────────────
function getToken()  { return localStorage.getItem('access_token') }
function setTokens(access, refresh) {
  localStorage.setItem('access_token', access)
  if (refresh) localStorage.setItem('refresh_token', refresh)
}
function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

function authHeaders(extra = {}) {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

// ── Stato auth globale ────────────────────────────────────────
let _listeners   = []
let _session     = undefined  // undefined = non ancora inizializzato

function notify(event, session) {
  _session = session
  _listeners.forEach(fn => fn(event, session))
}

async function tryRefresh() {
  const raw = localStorage.getItem('refresh_token')
  if (!raw) return false
  try {
    const r = await fetch(`${API_BASE}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: raw }),
    })
    if (!r.ok) return false
    const { access_token, refresh_token, user } = await r.json()
    setTokens(access_token, refresh_token)
    notify('TOKEN_REFRESHED', { user, access_token })
    return true
  } catch { return false }
}

async function initAuth() {
  const token = getToken()
  if (!token) { notify('SIGNED_OUT', null); return }

  try {
    const r = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (r.ok) {
      const user = await r.json()
      notify('SIGNED_IN', { user, access_token: token })
    } else {
      const refreshed = await tryRefresh()
      if (!refreshed) { clearTokens(); notify('SIGNED_OUT', null) }
    }
  } catch {
    clearTokens()
    notify('SIGNED_OUT', null)
  }
}

// ── Query Builder ─────────────────────────────────────────────
class QueryBuilder {
  constructor(table) {
    this._table    = table
    this._method   = 'GET'
    this._body     = null
    this._filters  = []
    this._order    = null
    this._single   = false
  }

  select()       { return this }  // accept call, ignore join syntax — backend always returns relations
  eq(f, v)       { this._filters.push(`${f}=eq.${v}`);          return this }
  neq(f, v)      { this._filters.push(`${f}=neq.${v}`);         return this }
  in(f, arr)     { this._filters.push(`${f}=in.${arr.join(',')}`); return this }
  gte(f, v)      { this._filters.push(`${f}=gte.${v}`);         return this }
  lte(f, v)      { this._filters.push(`${f}=lte.${v}`);         return this }
  order(f, opts) {
    const dir   = opts?.ascending === false ? 'desc' : 'asc'
    const nulls = opts?.nullsFirst === false ? 'nullslast' : 'nullsfirst'
    this._order = `${f}.${dir}.${nulls}`
    return this
  }
  single() { this._single = true; return this }
  insert(data)   { this._method = 'POST';  this._body = data; return this }
  update(data)   { this._method = 'PATCH'; this._body = data; return this }

  // Permette .insert().select().single()
  then(resolve, reject) { return this._run().then(resolve, reject) }
  catch(fn)             { return this._run().catch(fn) }

  async _run() {
    // Separa il filtro id (diventa path param) dagli altri
    const idFilter = this._filters.find(f => f.startsWith('id=eq.'))
    const rest     = this._filters.filter(f => !f.startsWith('id=eq.'))
    const id       = idFilter ? idFilter.split('id=eq.')[1] : null

    const tablePath = this._table.replace(/_/g, '-')
    let url = `${API_BASE}/api/${tablePath}`
    if (id && (this._method === 'GET' || this._method === 'PATCH')) url += `/${id}`

    const params = new URLSearchParams()
    rest.forEach(f => {
      const eq  = f.indexOf('=')
      const key = f.slice(0, eq)
      const val = f.slice(eq + 1)
      params.set(key, val)
    })
    if (this._order)  params.set('order', this._order)
    if (this._single) params.set('single', 'true')

    const qs = params.toString()

    try {
      const r = await fetch(`${url}${qs ? '?' + qs : ''}`, {
        method:  this._method,
        headers: this._body
          ? authHeaders()
          : { ...authHeaders(), 'Content-Type': undefined },
        ...(this._body ? { body: JSON.stringify(this._body) } : {}),
      })

      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: `HTTP ${r.status}` }))
        return { data: null, error: err }
      }

      const data = await r.json()
      if (this._single) {
        return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null }
      }
      return { data, error: null }
    } catch (e) {
      return { data: null, error: { message: e.message } }
    }
  }
}

// ── Storage ───────────────────────────────────────────────────
class StorageBucket {
  constructor(bucket) { this._bucket = bucket }

  async upload(path, file) {
    const safe = path.replace(/\.\./g, '')
    const fd   = new FormData()
    fd.append('file', file)
    fd.append('path', safe)
    fd.append('bucket', this._bucket)

    try {
      const r = await fetch(`${API_BASE}/api/storage/upload`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body:    fd,
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: 'Upload fallito' }))
        return { data: null, error: err }
      }
      return { data: await r.json(), error: null }
    } catch (e) {
      return { data: null, error: { message: e.message } }
    }
  }

  getPublicUrl(path) {
    return {
      data: { publicUrl: `${STORAGE_BASE}/${this._bucket}/${path}` }
    }
  }
}

class StorageClient {
  from(bucket) { return new StorageBucket(bucket) }
}

// ── Auth client ───────────────────────────────────────────────
class AuthClient {
  constructor() {
    // Inizializza dopo il primo tick per dare tempo ai listener di registrarsi
    setTimeout(() => initAuth(), 0)
  }

  onAuthStateChange(callback) {
    _listeners.push(callback)
    // Se già inizializzato, notifica subito
    if (_session !== undefined) {
      setTimeout(() => callback(_session ? 'SIGNED_IN' : 'SIGNED_OUT', _session), 0)
    }
    return {
      data: {
        subscription: {
          unsubscribe: () => { _listeners = _listeners.filter(l => l !== callback) }
        }
      }
    }
  }

  async signInWithPassword({ email, password }) {
    try {
      const r = await fetch(`${API_BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: 'Login fallito' }))
        return { data: null, error: { message: err.error || 'Login fallito' } }
      }
      const { access_token, refresh_token, user } = await r.json()
      setTokens(access_token, refresh_token)
      const session = { user, access_token }
      notify('SIGNED_IN', session)
      return { data: { user, session }, error: null }
    } catch (e) {
      return { data: null, error: { message: e.message } }
    }
  }

  async signOut() {
    const token = getToken()
    const raw   = localStorage.getItem('refresh_token')
    await fetch(`${API_BASE}/auth/logout`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ refresh_token: raw }),
    }).catch(() => {})
    clearTokens()
    notify('SIGNED_OUT', null)
  }

  async getSession() {
    const token = getToken()
    if (!token) return { data: { session: null }, error: null }
    return { data: { session: { access_token: token } }, error: null }
  }

  async resetPasswordForEmail(email, opts = {}) {
    try {
      const r = await fetch(`${API_BASE}/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, redirectTo: opts.redirectTo }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: 'Errore' }))
        return { error: { message: err.message } }
      }
      return { error: null }
    } catch (e) {
      return { error: { message: e.message } }
    }
  }
}

// ── Export principale ─────────────────────────────────────────
export const supabase = {
  auth:    new AuthClient(),
  storage: new StorageClient(),
  from:    (table) => new QueryBuilder(table),
}
