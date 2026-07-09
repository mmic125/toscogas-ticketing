import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function AttivaMFA() {
  const navigate = useNavigate()

  const [step, setStep]       = useState('intro')  // intro | qr | done
  const [qr, setQr]           = useState('')
  const [secret, setSecret]   = useState('')
  const [code, setCode]       = useState('')
  const [errore, setErrore]   = useState('')
  const [loading, setLoading] = useState(false)

  async function avviaSetup() {
    setErrore('')
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const r = await fetch(`${API_BASE}/auth/totp/setup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      if (!r.ok) { setErrore(data.error || 'Errore'); return }
      setQr(data.qr)
      setSecret(data.secret)
      setStep('qr')
    } catch (e) {
      setErrore(`Errore di rete: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function verificaCodice(e) {
    e.preventDefault()
    setErrore('')
    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const r = await fetch(`${API_BASE}/auth/totp/verify-setup`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      })
      const data = await r.json()
      if (!r.ok) { setErrore(data.error || 'Codice non valido'); return }
      setStep('done')
    } catch (e) {
      setErrore(`Errore di rete: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">
        Autenticazione a due fattori (MFA)
      </h1>

      {errore && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{errore}</p>
      )}

      {step === 'intro' && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <p className="text-sm text-gray-600">
            L'autenticazione a due fattori aggiunge un livello di sicurezza al tuo account.
            Oltre alla password, ti verrà chiesto un codice a 6 cifre generato dal tuo telefono.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-2">
            <p className="font-medium text-gray-700">Prima di iniziare:</p>
            <p>1. Installa <strong>Google Authenticator</strong> sul tuo telefono (disponibile su App Store e Google Play)</p>
            <p>2. Tieni il telefono a portata di mano</p>
          </div>
          <button
            onClick={avviaSetup}
            disabled={loading}
            style={{ backgroundColor: '#C8181E' }}
            className="w-full text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Preparazione...' : 'Inizia attivazione'}
          </button>
        </div>
      )}

      {step === 'qr' && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <p className="text-sm text-gray-600">
            <strong>1.</strong> Apri Google Authenticator e tocca <strong>+</strong> → <strong>Scansiona codice QR</strong>
          </p>
          <div className="flex justify-center">
            <img src={qr} alt="QR Code MFA" className="w-48 h-48" />
          </div>
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer">Non riesci a scansionare? Inserisci il codice manualmente</summary>
            <p className="mt-2 font-mono bg-gray-50 p-2 rounded break-all">{secret}</p>
          </details>
          <p className="text-sm text-gray-600">
            <strong>2.</strong> Inserisci il codice a 6 cifre mostrato dall'app:
          </p>
          <form onSubmit={verificaCodice} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="000000"
            />
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              style={{ backgroundColor: '#C8181E' }}
              className="w-full text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? 'Verifica...' : 'Verifica e attiva'}
            </button>
          </form>
        </div>
      )}

      {step === 'done' && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="text-lg font-medium text-gray-800">MFA attivata!</h2>
          <p className="text-sm text-gray-600">
            Dal prossimo accesso ti verrà chiesto il codice a 6 cifre dall'app Google Authenticator.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{ backgroundColor: '#C8181E' }}
            className="w-full text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            Torna alla home
          </button>
        </div>
      )}
    </div>
  )
}
