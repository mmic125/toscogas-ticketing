import { useState, useEffect } from 'react'
import { supabase } from '../../lib/api'

const RUOLI_LABEL = {
  coordinatore:            'Coordinatore',
  segnalatore:             'Segnalatore',
  manutentore:             'Manutentore',
  segnalatore_manutentore: 'Segnalatore / Manutentore',
}

const RUOLI_COLORS = {
  coordinatore:            'bg-purple-100 text-purple-800',
  segnalatore:             'bg-blue-100 text-blue-800',
  manutentore:             'bg-green-100 text-green-800',
  segnalatore_manutentore: 'bg-orange-100 text-orange-800',
}

function Badge({ ruolo }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${RUOLI_COLORS[ruolo] || 'bg-gray-100 text-gray-600'}`}>
      {RUOLI_LABEL[ruolo] || ruolo}
    </span>
  )
}

export default function ConfigUtenti() {
  const [utenti, setUtenti]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [errore, setErrore]           = useState('')
  const [successo, setSuccesso]       = useState('')
  const [mostraForm, setMostraForm]   = useState(false)
  const [modificando, setModificando] = useState(null)

  const [form, setForm] = useState({
    email:   '',
    nome:    '',
    cognome: '',
    ruolo:   'segnalatore',
  })

  useEffect(() => { caricaUtenti() }, [])

  async function caricaUtenti() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('cognome')
    if (error) {
      setErrore('Errore nel caricamento utenti.')
    } else {
      setUtenti(data)
    }
    setLoading(false)
  }

  function apriFormNuovo() {
    setModificando(null)
    setForm({ email: '', nome: '', cognome: '', ruolo: 'segnalatore' })
    setMostraForm(true)
    setErrore('')
    setSuccesso('')
  }

  function apriFormModifica(utente) {
    setModificando(utente)
    setForm({
      email:   utente.email || '',
      nome:    utente.nome,
      cognome: utente.cognome,
      ruolo:   utente.ruolo,
    })
    setMostraForm(true)
    setErrore('')
    setSuccesso('')
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrore('')
    setSuccesso('')

    if (modificando) {
      try {
        const token = localStorage.getItem('access_token')
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || ''}/api/profiles/${modificando.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              nome:    form.nome.trim(),
              cognome: form.cognome.trim(),
              ruolo:   form.ruolo,
            }),
          }
        )
        const result = await response.json()
        if (!response.ok) {
          setErrore(`Errore: ${result.error}`)
          return
        }
        setSuccesso(`Utente ${form.nome} ${form.cognome} aggiornato.`)
        setMostraForm(false)
        caricaUtenti()
      } catch (err) {
        setErrore(`Errore di rete: ${err.message}`)
      }
    } else {
      try {
        const token = localStorage.getItem('access_token')
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || ''}/api/profiles/admin/create`,
          {
            method: 'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              email:   form.email.trim(),
              nome:    form.nome.trim(),
              cognome: form.cognome.trim(),
              ruolo:   form.ruolo,
            }),
          }
        )
        const result = await response.json()
        if (!response.ok) {
          setErrore(`Errore: ${result.error}`)
          return
        }
        setSuccesso(`Utente ${form.nome} ${form.cognome} creato. Password temporanea: Temporanea1!`)
        setMostraForm(false)
        caricaUtenti()
      } catch (err) {
        setErrore(`Errore di rete: ${err.message}`)
      }
    }
  }

  async function toggleAttivo(utente) {
    const token = localStorage.getItem('access_token')
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || ''}/api/profiles/${utente.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ attivo: !utente.attivo }),
      }
    )
    if (!response.ok) {
      setErrore('Errore nell\'aggiornamento utente.')
    } else {
      caricaUtenti()
    }
  }

  async function disattivaMfa(utente) {
    if (!window.confirm(`Disattivare la MFA di ${utente.nome} ${utente.cognome}? Al prossimo accesso dovrà riattivarla.`)) return

    setErrore('')
    setSuccesso('')

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/auth/totp/disable`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: utente.id }),
        }
      )
      const result = await response.json()
      if (!response.ok) {
        setErrore(`Errore: ${result.error}`)
        return
      }
      setSuccesso(`MFA di ${utente.nome} ${utente.cognome} disattivata.`)
      caricaUtenti()
    } catch (err) {
      setErrore(`Errore di rete: ${err.message}`)
    }
  }

  async function resetPassword(utente) {
    if (!window.confirm(`Resettare la password di ${utente.nome} ${utente.cognome}? Verrà reimpostata a "Temporanea1!" e l'utente dovrà cambiarla al prossimo accesso.`)) return

    setErrore('')
    setSuccesso('')

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/profiles/admin/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: utente.id }),
        }
      )
      const result = await response.json()
      if (!response.ok) {
        setErrore(`Errore: ${result.error}`)
        return
      }
      setSuccesso(`Password di ${utente.nome} ${utente.cognome} reimpostata a "Temporanea1!".`)
    } catch (err) {
      setErrore(`Errore di rete: ${err.message}`)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-gray-400 text-sm">Caricamento utenti...</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Gestione Utenti</h1>
          <p className="text-sm text-gray-500 mt-1">{utenti.length} utenti registrati</p>
        </div>
        <button
          onClick={apriFormNuovo}
          style={{ backgroundColor: '#C8181E' }}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuovo Utente
        </button>
      </div>

      {errore && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{errore}</p>
      )}
      {successo && (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-4">{successo}</p>
      )}

      {mostraForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-4 border-l-4 border-red-500">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
            {modificando ? 'Modifica Utente' : 'Nuovo Utente'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!modificando && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="nome@toscogas.it"
                />
                <p className="text-xs text-gray-400 mt-1">
                  La password temporanea sarà: <strong>Temporanea1!</strong>
                </p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="nome"
                value={form.nome}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Cognome <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="cognome"
                value={form.cognome}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Ruolo <span className="text-red-500">*</span>
              </label>
              <select
                name="ruolo"
                value={form.ruolo}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              >
                {Object.entries(RUOLI_LABEL).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMostraForm(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Annulla
              </button>
              <button
                type="submit"
                style={{ backgroundColor: '#C8181E' }}
                className="flex-1 text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                {modificando ? 'Salva Modifiche' : 'Crea Utente'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Utente</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Ruolo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Stato</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">MFA</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {utenti.map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{u.nome} {u.cognome}</div>
                  <div className="text-xs text-gray-400">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge ruolo={u.ruolo} />
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.attivo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {u.attivo ? 'Attivo' : 'Disattivato'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.totp_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {u.totp_enabled ? 'Attiva' : 'Non attiva'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => apriFormModifica(u)}
                      className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-50 transition"
                    >
                      Modifica
                    </button>
                    <button
                      onClick={() => resetPassword(u)}
                      className="text-xs border border-yellow-300 text-yellow-700 px-3 py-1 rounded-lg hover:bg-yellow-50 transition"
                    >
                      Reset password
                    </button>
                    {u.totp_enabled && (
                      <button
                        onClick={() => disattivaMfa(u)}
                        className="text-xs border border-orange-300 text-orange-700 px-3 py-1 rounded-lg hover:bg-orange-50 transition"
                      >
                        Disattiva MFA
                      </button>
                    )}
                    <button
                      onClick={() => toggleAttivo(u)}
                      className={`text-xs border px-3 py-1 rounded-lg transition ${
                        u.attivo
                          ? 'border-red-300 text-red-600 hover:bg-red-50'
                          : 'border-green-300 text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {u.attivo ? 'Disattiva' : 'Riattiva'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
