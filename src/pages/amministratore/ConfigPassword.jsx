import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

const DEFAULT_FORM = {
  min_length: 12,
  require_uppercase: true,
  min_uppercase: 1,
  require_special: false,
  min_special: 1,
  require_digit: true,
  min_digit: 1,
  avoid_ambiguous_common: true,
  validity_days: '',
}

export default function ConfigPassword() {
  const [form, setForm]       = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [errore, setErrore]   = useState('')
  const [successo, setSuccesso] = useState('')

  useEffect(() => { caricaPolicy() }, [])

  async function caricaPolicy() {
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const r = await fetch(`${API_BASE}/api/password-policy`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      if (r.ok) {
        setForm({ ...DEFAULT_FORM, ...data, validity_days: data.validity_days ?? '' })
      } else {
        setErrore(data.error || 'Errore nel caricamento della policy.')
      }
    } catch (err) {
      setErrore(`Errore di rete: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleCheck(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.checked }))
  }
  function handleNumber(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value === '' ? '' : parseInt(value, 10) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrore(''); setSuccesso(''); setSaving(true)
    try {
      const token = localStorage.getItem('access_token')
      const r = await fetch(`${API_BASE}/api/password-policy`, {
        method: 'PUT',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          validity_days: form.validity_days === '' ? null : form.validity_days,
        }),
      })
      const data = await r.json()
      if (!r.ok) {
        setErrore(data.error || 'Errore nel salvataggio.')
        return
      }
      setSuccesso('Policy password aggiornata.')
    } catch (err) {
      setErrore(`Errore di rete: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Gestione Password</h1>
        <p className="text-sm text-gray-500 mt-1">Criteri richiesti per le password degli utenti</p>
      </div>

      {errore   && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{errore}</p>}
      {successo && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-4">{successo}</p>}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Numero minimo di caratteri</label>
          <input type="number" name="min_length" min={6} max={64} value={form.min_length} onChange={handleNumber}
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="require_uppercase" checked={form.require_uppercase} onChange={handleCheck} className="accent-red-600 w-4 h-4" />
            Includi maiuscole
          </label>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Numero minimo</label>
            <input type="number" name="min_uppercase" min={1} max={10} value={form.min_uppercase} onChange={handleNumber}
              disabled={!form.require_uppercase}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="require_digit" checked={form.require_digit} onChange={handleCheck} className="accent-red-600 w-4 h-4" />
            Includi numeri
          </label>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Numero minimo</label>
            <input type="number" name="min_digit" min={1} max={10} value={form.min_digit} onChange={handleNumber}
              disabled={!form.require_digit}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="require_special" checked={form.require_special} onChange={handleCheck} className="accent-red-600 w-4 h-4" />
            Includi caratteri speciali
          </label>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Numero minimo</label>
            <input type="number" name="min_special" min={1} max={10} value={form.min_special} onChange={handleNumber}
              disabled={!form.require_special}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="avoid_ambiguous_common" checked={form.avoid_ambiguous_common} onChange={handleCheck} className="accent-red-600 w-4 h-4" />
          Evita caratteri ambigui (l, I, 1, O, 0) e password comuni
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Periodo di validità (giorni)</label>
          <input type="number" name="validity_days" min={1} value={form.validity_days} onChange={handleNumber}
            placeholder="Vuoto = nessuna scadenza"
            className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          <p className="text-xs text-gray-400 mt-1">
            Alla scadenza, all'accesso successivo verrà richiesto il cambio password.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{ backgroundColor: '#C8181E' }}
          className="text-white px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? 'Salvataggio...' : 'Salva Policy'}
        </button>
      </form>
    </div>
  )
}
