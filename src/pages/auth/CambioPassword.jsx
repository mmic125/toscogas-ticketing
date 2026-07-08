import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const COMMON_PASSWORDS = [
  'Password1!', 'Password1', 'Password123', 'Qwerty123!', 'Admin1234!',
  'Benvenuto1!', 'Toscogas1!', 'Toscogas12', 'Temporanea1!', 'Abc12345!',
  'Passw0rd!', 'Welcome1!', 'Letmein1!', 'Changeme1!', 'Summer2026!',
]

function validaPassword(pwd) {
  const errori = []
  if (pwd.length < 12)                  errori.push('Almeno 12 caratteri')
  if (!/[A-Z]/.test(pwd))               errori.push('Almeno una lettera maiuscola')
  if (!/[0-9]/.test(pwd))               errori.push('Almeno un numero')
  if (COMMON_PASSWORDS.includes(pwd))   errori.push('Password troppo comune, scegline una diversa')
  return errori
}

function ToggleMostraPassword({ mostra, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
      aria-label={mostra ? 'Nascondi password' : 'Mostra password'}
    >
      {mostra ? (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      ) : (
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )}
    </button>
  )
}

function RequisitiPassword({ password }) {
  const requisiti = [
    { label: 'Almeno 12 caratteri',         ok: password.length >= 12 },
    { label: 'Almeno una lettera maiuscola', ok: /[A-Z]/.test(password) },
    { label: 'Almeno un numero',             ok: /[0-9]/.test(password) },
  ]

  if (!password) return null

  return (
    <ul className="mt-2 space-y-1">
      {requisiti.map(r => (
        <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? 'text-green-600' : 'text-gray-400'}`}>
          <span>{r.ok ? '✓' : '○'}</span>
          {r.label}
        </li>
      ))}
    </ul>
  )
}

export default function CambioPassword() {
  const { caricaProfilo } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ nuova: '', conferma: '' })
  const [errore,  setErrore]  = useState('')
  const [loading, setLoading] = useState(false)
  const [mostraNuova,   setMostraNuova]   = useState(false)
  const [mostraConferma, setMostraConferma] = useState(false)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrore('')

    const erroriValidazione = validaPassword(form.nuova)
    if (erroriValidazione.length > 0) {
      setErrore(erroriValidazione[0])
      return
    }
    if (form.nuova !== form.conferma) {
      setErrore('Le password non coincidono.')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/auth/change-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ new_password: form.nuova }),
        }
      )
      const result = await response.json()
      if (!response.ok) {
        setErrore(result.error || 'Errore durante il cambio password.')
        return
      }

      await caricaProfilo()
      navigate('/', { replace: true })

    } catch (err) {
      setErrore(`Errore di rete: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#C8181E' }}>
            <svg width="24" height="24" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-gray-800 text-center mb-1">
          Cambio password obbligatorio
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Devi impostare una nuova password prima di continuare.
        </p>

        {errore && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{errore}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Nuova password
            </label>
            <div className="relative">
              <input
                type={mostraNuova ? 'text' : 'password'}
                name="nuova"
                value={form.nuova}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Minimo 12 caratteri"
              />
              <ToggleMostraPassword mostra={mostraNuova} onToggle={() => setMostraNuova(v => !v)} />
            </div>
            <RequisitiPassword password={form.nuova} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Conferma password
            </label>
            <div className="relative">
              <input
                type={mostraConferma ? 'text' : 'password'}
                name="conferma"
                value={form.conferma}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Ripeti la nuova password"
              />
              <ToggleMostraPassword mostra={mostraConferma} onToggle={() => setMostraConferma(v => !v)} />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: '#C8181E' }}
            className="w-full text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Salvataggio...' : 'Imposta nuova password'}
          </button>
        </form>
      </div>
    </div>
  )
}
