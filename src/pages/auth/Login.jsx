import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const { login, resetPassword } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [errore, setErrore]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [modalReset, setModalReset] = useState(false)
  const [emailReset, setEmailReset] = useState('')
  const [resetOk, setResetOk]       = useState(false)

async function handleLogin(e) {
  e.preventDefault()
  setErrore('')
  setLoading(true)
  try {
    console.log('1. Inizio login...')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    console.log('2. Risposta Supabase:', data, error)

    if (error) throw error

    const { data: p, error: errProfilo } = await supabase
      .from('profiles')
      .select('ruolo')
      .eq('id', data.user.id)
      .single()

    console.log('3. Profilo:', p, errProfilo)

    if (errProfilo || !p) throw new Error('Profilo non trovato')

    switch (p.ruolo) {
      case 'coordinatore':            navigate('/coordinatore'); break
      case 'segnalatore':             navigate('/segnalatore'); break
      case 'manutentore':             navigate('/manutentore'); break
      case 'segnalatore_manutentore': navigate('/segnalatore'); break
      default: navigate('/')
    }
  } catch (err) {
    console.log('ERRORE:', err.message)
    setErrore('Email o password non validi.')
    setLoading(false)
  }
}

  async function handleReset(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await resetPassword(emailReset)
      setResetOk(true)
    } catch {
      setErrore('Errore nell\'invio della mail di reset.')
    } finally {
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

        {!modalReset ? (
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
          <form onSubmit={handleReset} className="space-y-4">
            <h2 className="text-lg font-medium text-gray-800">Reset password</h2>

            {!resetOk ? (
              <>
                <p className="text-sm text-gray-500">
                  Inserisci la tua email: ti invieremo un link per reimpostare la password.
                </p>
                <input
                  type="email"
                  required
                  value={emailReset}
                  onChange={e => setEmailReset(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="nome@toscogas.it"
                />
                {errore && (
                  <p className="text-sm text-red-600">{errore}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: loading ? '#e57373' : '#C8181E' }}
                  className="w-full text-white font-medium py-2 rounded-lg text-sm transition"
                >
                  {loading ? 'Invio...' : 'Invia link reset'}
                </button>
              </>
            ) : (
              <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                Email inviata! Controlla la tua casella di posta.
              </p>
            )}

            <button
              type="button"
              onClick={() => { setModalReset(false); setResetOk(false); setErrore('') }}
              className="text-sm text-gray-500 hover:underline"
            >
              ← Torna al login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}