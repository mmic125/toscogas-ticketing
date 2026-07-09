import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function Login() {
  const { login, completaLoginTotp } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [errore, setErrore]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [modalReset, setModalReset] = useState(false)

  // Stato MFA
  const [totpRequired, setTotpRequired] = useState(false)
  const [tempToken, setTempToken]       = useState('')
  const [totpCode, setTotpCode]         = useState('')

  function naviga(profilo) {
    if (profilo.must_change_pwd) {
      navigate('/change-password', { replace: true })
      return
    }
    switch (profilo.ruolo) {
      case 'coordinatore':            navigate('/coordinatore', { replace: true }); break
      case 'segnalatore':             navigate('/segnalatore',  { replace: true }); break
      case 'manutentore':             navigate('/manutentore',  { replace: true }); break
      case 'segnalatore_manutentore': navigate('/segnalatore',  { replace: true }); break
      default: navigate('/', { replace: true })
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setErrore('')
    setLoading(true)
    try {
      const data = await login(email, password)

      // Se il backend richiede il codice TOTP
      if (data.totp_required) {
        setTempToken(data.temp_token)
        setTotpRequired(true)
        setLoading(false)
        return
      }

      naviga(data.user)
    } catch (err) {
      setErrore(err.message || 'Email o password non validi.')
      setLoading(false)
    }
  }

  async function handleTotpVerify(e) {
    e.preventDefault()
    setErrore('')
    setLoading(true)
    try {
      const data = await completaLoginTotp(tempToken, totpCode)
      naviga(data.user)
    } catch (err) {
      setErrore(err.message || 'Codice non valido.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8">

        {/* Intestazione */}
        <div className="text-center mb-8">
          <div
            className="inline-block w-12 h-12 rounded-full mb-3"
            style={{ backgroundColor: '#C8181E' }}
          />
          <h1 className="text-2xl font-semibold text-gray-900">Toscogas</h1>
          <p className="text-sm text-gray-500 mt-1">Sistema Ticketing</p>
        </div>

        {totpRequired ? (
          /* ─── Step 2: codice TOTP ─── */
          <form onSubmit={handleTotpVerify} className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Inserisci il codice a 6 cifre da <strong>Google Authenticator</strong>
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="000000"
            />
            {errore && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errore}</p>
            )}
            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              style={{ backgroundColor: loading ? '#e57373' : '#C8181E' }}
              className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
            >
              {loading ? 'Verifica...' : 'Verifica codice'}
            </button>
            <button
              type="button"
              onClick={() => { setTotpRequired(false); setTotpCode(''); setErrore('') }}
              className="w-full text-center text-sm text-gray-500 hover:underline"
            >
              ← Torna al login
            </button>
          </form>

        ) : !modalReset ? (
          /* ─── Step 1: email + password ─── */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="nome@toscogas.it"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="••••••••"
              />
            </div>

            {errore && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {errore}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: loading ? '#e57373' : '#C8181E' }}
              className="w-full text-white font-medium py-2 rounded-lg text-sm transition"
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>

            <button
              type="button"
              onClick={() => { setModalReset(true); setErrore('') }}
              className="w-full text-center text-sm text-red-600 hover:underline mt-2"
            >
              Password dimenticata?
            </button>
          </form>

        ) : (
          /* ─── Reset password info ─── */
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-800">Password dimenticata?</h2>
            <p className="text-sm text-gray-500">
              Contatta il coordinatore per richiedere il reset della password.
            </p>
            <button
              type="button"
              onClick={() => { setModalReset(false); setErrore('') }}
              className="text-sm text-gray-500 hover:underline"
            >
              ← Torna al login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
