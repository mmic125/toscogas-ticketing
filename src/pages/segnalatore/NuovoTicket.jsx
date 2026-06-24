import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  TIPI_INTERVENTO_COMMERCIALE,
  TIPI_INTERVENTO_TECNICO,
  PRIORITA_LABEL,
  CATEGORIE,
  PROVINCE,
  MAX_FOTO,
  MAX_FOTO_MB,
  FORMATI_ACCETTATI,
} from '../../lib/costanti'

export default function NuovoTicket() {
  const { profilo } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    codice_cliente:      '',
    nome_cliente:        '',
    matricola_serbatoio: '',
    tipo_problema:       '',
    note_apertura:       '',
    priorita:            '',
    categoria:           '',
    provincia:           '',
    telefono:            '',
  })
  const [allegati, setAllegati] = useState([])
  const [preview, setPreview]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [errore, setErrore]     = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleAllegati(e) {
    const files = Array.from(e.target.files)
    const totale = allegati.length + files.length

    if (totale > MAX_FOTO) {
      setErrore(`Puoi caricare massimo ${MAX_FOTO} allegati.`)
      return
    }

    const nonValidi = files.filter(
      f => !FORMATI_ACCETTATI.includes(f.type) || f.size > MAX_FOTO_MB * 1024 * 1024
    )
    if (nonValidi.length > 0) {
      setErrore(`File non validi. Formati accettati: JPG, PNG, WEBP, PDF. Max ${MAX_FOTO_MB}MB.`)
      return
    }

    setErrore('')
    setAllegati(prev => [...prev, ...files])
    setPreview(prev => [
      ...prev,
      ...files.map(f => ({
        url:  f.type === 'application/pdf' ? null : URL.createObjectURL(f),
        nome: f.name,
        tipo: f.type,
      }))
    ])
  }

  function rimuoviAllegato(index) {
    setAllegati(prev => prev.filter((_, i) => i !== index))
    setPreview(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrore('')

    if (!form.codice_cliente.trim()) { setErrore('Il codice cliente è obbligatorio.'); return }
    if (!form.nome_cliente.trim())   { setErrore('Il nome cliente è obbligatorio.'); return }
    if (!form.categoria)             { setErrore('Seleziona una categoria.'); return }
    if (!form.tipo_problema)         { setErrore('Seleziona una tipologia di intervento.'); return }
    if (!form.priorita)              { setErrore('Seleziona una priorità.'); return }

    setLoading(true)
    try {
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          codice_cliente:      form.codice_cliente.trim(),
          nome_cliente:        form.nome_cliente.trim(),
          matricola_serbatoio: form.matricola_serbatoio || null,
          tipo_problema:       form.tipo_problema,
          note_apertura:       form.note_apertura || null,
          priorita:            form.priorita,
          categoria:           form.categoria || null,
          provincia:           form.provincia || null,
          telefono:            form.telefono || null,
          segnalatore_id:      profilo.id,
        })
        .select()
        .single()

      if (ticketError) throw ticketError

      for (let i = 0; i < allegati.length; i++) {
        const file = allegati[i]
        const ext  = file.name.split('.').pop()
        const path = `${ticket.id}/${i + 1}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('ticket-foto')
          .upload(path, file)

        if (uploadError) throw uploadError

        await supabase.from('ticket_foto').insert({
          ticket_id:    ticket.id,
          storage_path: path,
          ordine:       i + 1,
        })
      }

      navigate(-1)
    } catch (err) {
      console.error(err)
      setErrore('Errore durante la creazione del ticket. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Nuovo Ticket</h1>
        <p className="text-sm text-gray-500 mt-1">Compila i campi per aprire un nuovo ticket</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">

        {/* Codice e Nome cliente */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Codice Cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="codice_cliente"
              value={form.codice_cliente}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Es. CLI001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome Cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nome_cliente"
              value={form.nome_cliente}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Nome e cognome"
            />
          </div>
        </div>

        {/* Telefono e Provincia */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Numero di Telefono</label>
            <input
              type="tel"
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Es. 0583 287230"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
            <select
              name="provincia"
              value={form.provincia}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
            >
              <option value="">Seleziona...</option>
              {Object.entries(PROVINCE).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Matricola serbatoio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Matricola Serbatoio</label>
          <input
            type="text"
            name="matricola_serbatoio"
            value={form.matricola_serbatoio}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="Es. SER-2024-001"
          />
        </div>

        {/* Categoria */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categoria <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            {Object.entries(CATEGORIE).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setForm(f => ({ ...f, categoria: val, tipo_problema: '' }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                  form.categoria === val
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tipologia intervento */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipologia di Intervento <span className="text-red-500">*</span>
          </label>
          <select
            name="tipo_problema"
            value={form.tipo_problema}
            onChange={handleChange}
            required
            disabled={!form.categoria}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">
              {form.categoria ? 'Seleziona...' : 'Seleziona prima una categoria'}
            </option>
            {Object.entries(
              form.categoria === 'commerciale'
                ? TIPI_INTERVENTO_COMMERCIALE
                : form.categoria === 'tecnico'
                ? TIPI_INTERVENTO_TECNICO
                : {}
            ).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Priorità */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priorità <span className="text-red-500">*</span>
          </label>

          {/* Legenda priorità */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3 text-xs text-gray-600 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 flex-shrink-0"></span>
              <span><strong>Urgente</strong> — da gestire entro 48h</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0"></span>
              <span><strong>Alta</strong> — da gestire entro 72h</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0"></span>
              <span><strong>Media</strong> — da gestire entro 1 settimana</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
              <span><strong>Bassa</strong> — da gestire entro 1 mese</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {Object.entries(PRIORITA_LABEL).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setForm(f => ({ ...f, priorita: val }))}
                className={`py-2 rounded-lg text-sm font-medium border transition ${
                  form.priorita === val
                    ? val === 'urgente' ? 'bg-red-600 text-white border-red-600'
                    : val === 'alta'    ? 'bg-orange-500 text-white border-orange-500'
                    : val === 'media'   ? 'bg-yellow-400 text-white border-yellow-400'
                    :                    'bg-green-500 text-white border-green-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Note apertura */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note Apertura</label>
          <textarea
            name="note_apertura"
            value={form.note_apertura}
            onChange={handleChange}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            placeholder="Descrivi il problema..."
          />
        </div>

        {/* Allegati */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Allegati — Foto e PDF (max {MAX_FOTO})
          </label>

          {preview.length > 0 && (
            <div className="flex gap-3 mb-3 flex-wrap">
              {preview.map((p, i) => (
                <div key={i} className="relative">
                  {p.tipo === 'application/pdf' ? (
                    <div className="w-24 h-24 bg-red-50 border border-red-200 rounded-lg flex flex-col items-center justify-center gap-1">
                      <svg width="24" height="24" fill="none" stroke="#C8181E" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-xs text-red-600">PDF</span>
                    </div>
                  ) : (
                    <img src={p.url} alt={`Allegato ${i + 1}`}
                      className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                  )}
                  <button type="button" onClick={() => rimuoviAllegato(i)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {allegati.length < MAX_FOTO && (
            <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 hover:border-red-400 transition w-fit">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-sm text-gray-600">Aggiungi allegato ({allegati.length}/{MAX_FOTO})</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                multiple onChange={handleAllegati} className="hidden" />
            </label>
          )}
          <p className="text-xs text-gray-400 mt-1">Formati accettati: JPG, PNG, WEBP, PDF — Max {MAX_FOTO_MB}MB per file</p>
        </div>

        {errore && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errore}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            Annulla
          </button>
          <button type="submit" disabled={loading}
            style={{ backgroundColor: loading ? '#e57373' : '#C8181E' }}
            className="flex-1 text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
            {loading ? 'Salvataggio...' : 'Apri Ticket'}
          </button>
        </div>
      </form>
    </div>
  )
}