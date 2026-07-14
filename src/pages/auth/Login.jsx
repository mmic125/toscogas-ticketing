import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function Login() {
  const { login, completaLoginTotp } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [mostraPassword, setMostraPassword] = useState(false)
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
    if (!profilo.totp_enabled) {
      navigate('/mfa', { replace: true })
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
              <div className="relative">
                <input
                  type={mostraPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setMostraPassword(v => !v)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  aria-label={mostraPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {mostraPassword ? (
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
              </div>
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
              Contatta simone.lorenzi@toscogas.it per richiedere il reset della password.
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
