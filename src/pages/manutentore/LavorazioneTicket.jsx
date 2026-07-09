import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  TIPI_INTERVENTO, PRIORITA_LABEL, STATI_LABEL,
  PRIORITA_COLORS, STATO_COLORS, CATEGORIE, PROVINCE,
  MAX_FOTO, MAX_FOTO_MB, FORMATI_ACCETTATI
} from '../../lib/costanti'

function Badge({ testo, colori }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colori}`}>
      {testo}
    </span>
  )
}

export default function LavorazioneTicket() {
  const { id } = useParams()
  const { profilo } = useAuth()
  const navigate = useNavigate()

  const [ticket, setTicket]     = useState(null)
  const [allegati, setAllegati] = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [errore, setErrore]     = useState('')
  const [successo, setSuccesso] = useState('')

  // Nuovi allegati da caricare
  const [nuoviAllegati, setNuoviAllegati]   = useState([])
  const [previewNuovi, setPreviewNuovi]     = useState([])

  const [form, setForm] = useState({
    codice_cliente:       '',
    nome_cliente:         '',
    telefono:             '',
    provincia:            '',
    matricola_serbatoio:  '',
    note_intervento:      '',
    materiale_utilizzato: '',
  })

  useEffect(() => { caricaDati() }, [id])

  useEffect(() => {
    return () => { allegati.forEach(a => a.url && URL.revokeObjectURL(a.url)) }
  }, [allegati])

  async function caricaDati() {
    setLoading(true)
    const { data: t, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .eq('manutentore_id', profilo.id)
      .single()

    if (error || !t) {
      setErrore('Ticket non trovato o non autorizzato.')
      setLoading(false)
      return
    }

    setTicket(t)
    setForm({
      codice_cliente:       t.codice_cliente || '',
      nome_cliente:         t.nome_cliente || '',
      telefono:             t.telefono || '',
      provincia:            t.provincia || '',
      matricola_serbatoio:  t.matricola_serbatoio || '',
      note_intervento:      t.note_intervento || '',
      materiale_utilizzato: t.materiale_utilizzato || '',
    })

    // Carica allegati esistenti
    const { data: f } = await supabase
      .from('ticket_foto')
      .select('*')
      .eq('ticket_id', id)
      .order('ordine')

    if (f && f.length > 0) {
      const allegatiConUrl = await Promise.all(f.map(async all => {
        const isPdf = all.storage_path.toLowerCase().endsWith('.pdf')
        const { data: blob } = await supabase.storage
          .from('ticket-foto')
          .download(all.storage_path)
        return { ...all, url: blob ? URL.createObjectURL(blob) : null, isPdf }
      }))
      setAllegati(allegatiConUrl)
    }

    setLoading(false)
  }

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleNuoviAllegati(e) {
    const files = Array.from(e.target.files)
    const totale = allegati.length + nuoviAllegati.length + files.length

    if (totale > MAX_FOTO) {
      setErrore(`Puoi caricare massimo ${MAX_FOTO} allegati in totale.`)
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
    setNuoviAllegati(prev => [...prev, ...files])
    setPreviewNuovi(prev => [
      ...prev,
      ...files.map(f => ({
        url:  f.type === 'application/pdf' ? null : URL.createObjectURL(f),
        nome: f.name,
        tipo: f.type,
      }))
    ])
  }

  function rimuoviNuovoAllegato(index) {
    setNuoviAllegati(prev => prev.filter((_, i) => i !== index))
    setPreviewNuovi(prev => prev.filter((_, i) => i !== index))
  }

  const codiceModificabile    = !ticket?.codice_cliente
  const nomeModificabile      = !ticket?.nome_cliente
  const telefonoModificabile  = !ticket?.telefono
  const provinciaModificabile = !ticket?.provincia
  const matricolaModificabile = !ticket?.matricola_serbatoio

  async function salvaEAggiorna(nuovoStato) {
    setSaving(true); setErrore(''); setSuccesso('')

    const aggiornamenti = {
      note_intervento:      form.note_intervento || null,
      materiale_utilizzato: form.materiale_utilizzato || null,
    }

    if (codiceModificabile)    aggiornamenti.codice_cliente      = form.codice_cliente || null
    if (nomeModificabile)      aggiornamenti.nome_cliente        = form.nome_cliente || null
    if (telefonoModificabile)  aggiornamenti.telefono            = form.telefono || null
    if (provinciaModificabile) aggiornamenti.provincia           = form.provincia || null
    if (matricolaModificabile) aggiornamenti.matricola_serbatoio = form.matricola_serbatoio || null

    if (nuovoStato === 'risolto') {
      aggiornamenti.stato           = 'risolto'
      aggiornamenti.data_intervento = new Date().toISOString().split('T')[0]
    } else if (nuovoStato === 'in_lavorazione') {
      aggiornamenti.stato = 'in_lavorazione'
    }

    const { error } = await supabase
      .from('tickets')
      .update(aggiornamenti)
      .eq('id', id)
      .eq('manutentore_id', profilo.id)

    if (error) {
      setErrore('Errore nel salvataggio.')
      setSaving(false)
      return
    }

    // Carica nuovi allegati
    if (nuoviAllegati.length > 0) {
      const ordineBase = allegati.length + 1
      for (let i = 0; i < nuoviAllegati.length; i++) {
        const file = nuoviAllegati[i]
        const ext  = file.name.split('.').pop()
        const path = `${id}/${ordineBase + i}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('ticket-foto')
          .upload(path, file)

        if (!uploadError) {
          await supabase.from('ticket_foto').insert({
            ticket_id:    id,
            storage_path: path,
            ordine:       ordineBase + i,
          })
        }
      }
    }

    if (nuovoStato === 'risolto') {
      setSuccesso('Intervento chiuso. Ticket impostato come Risolto.')
      setTimeout(() => navigate('/manutentore'), 1500)
    } else {
      setSuccesso('Intervento parziale salvato.')
      setNuoviAllegati([])
      setPreviewNuovi([])
      caricaDati()
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )

  if (!ticket) return (
    <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
      {errore || 'Ticket non trovato'}
    </div>
  )

  const chiuso = ticket.stato === 'chiuso' || ticket.stato === 'risolto'
  const allegatiRimasti = MAX_FOTO - allegati.length - nuoviAllegati.length

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => navigate('/manutentore')} className="text-gray-400 hover:text-gray-600 transition">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-800">{ticket.nome_cliente}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge testo={STATI_LABEL[ticket.stato]} colori={STATO_COLORS[ticket.stato]} />
            <Badge testo={PRIORITA_LABEL[ticket.priorita]} colori={PRIORITA_COLORS[ticket.priorita]} />
          </div>
        </div>
      </div>

      {errore   && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{errore}</p>}
      {successo && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-4">{successo}</p>}

      <div className="space-y-4">

        {/* Dati cliente */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Dati Cliente</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Codice Cliente</label>
              <input type="text" name="codice_cliente" value={form.codice_cliente} onChange={handleChange}
                disabled={!codiceModificabile || chiuso}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Nome Cliente</label>
              <input type="text" name="nome_cliente" value={form.nome_cliente} onChange={handleChange}
                disabled={!nomeModificabile || chiuso}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Telefono</label>
              <input type="tel" name="telefono" value={form.telefono} onChange={handleChange}
                disabled={!telefonoModificabile || chiuso}
                placeholder="—"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Provincia</label>
              {provinciaModificabile && !chiuso ? (
                <select name="provincia" value={form.provincia} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                  <option value="">Seleziona...</option>
                  {Object.entries(PROVINCE).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              ) : (
                <input type="text" value={form.provincia || '—'} disabled
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Matricola Serbatoio</label>
              <input type="text" name="matricola_serbatoio" value={form.matricola_serbatoio} onChange={handleChange}
                disabled={!matricolaModificabile || chiuso}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
          </div>
        </div>

        {/* Info problema - sola lettura */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Tipologia di Intervento</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Categoria</p>
              <p className="text-gray-800">{CATEGORIE[ticket.categoria] || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Tipologia</p>
              <p className="text-gray-800">{TIPI_INTERVENTO[ticket.tipo_problema] || ticket.tipo_problema}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Priorità</p>
              <Badge testo={PRIORITA_LABEL[ticket.priorita]} colori={PRIORITA_COLORS[ticket.priorita]} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Intervento Richiesto</p>
              <p className="text-gray-800">{ticket.data_intervento_richiesta || '—'}</p>
            </div>
            {ticket.note_apertura && (
              <div className="col-span-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Note Apertura</p>
                <p className="text-gray-800 bg-gray-50 rounded-lg p-3">{ticket.note_apertura}</p>
              </div>
            )}
          </div>
        </div>

        {/* Allegati esistenti */}
        {allegati.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Allegati</h2>
            <div className="flex gap-3 flex-wrap">
              {allegati.map((a, i) => (
                a.isPdf ? (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
                    className="w-24 h-24 bg-red-50 border border-red-200 rounded-lg flex flex-col items-center justify-center gap-1 hover:opacity-80 transition">
                    <svg width="24" height="24" fill="none" stroke="#C8181E" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs text-red-600">PDF</span>
                  </a>
                ) : (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                    <img src={a.url} alt={`Allegato ${i + 1}`}
                      className="w-24 h-24 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition" />
                  </a>
                )
              ))}
            </div>
          </div>
        )}

        {/* Lavorazione */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Lavorazione</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Note Intervento</label>
              <textarea name="note_intervento" value={form.note_intervento} onChange={handleChange}
                disabled={chiuso} rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="Descrivi l'intervento effettuato..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Materiale Utilizzato</label>
              <textarea name="materiale_utilizzato" value={form.materiale_utilizzato} onChange={handleChange}
                disabled={chiuso} rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="Elenca i materiali utilizzati..." />
            </div>

            {/* Carica nuovi allegati */}
            {!chiuso && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Aggiungi Allegati
                </label>

                {previewNuovi.length > 0 && (
                  <div className="flex gap-3 mb-3 flex-wrap">
                    {previewNuovi.map((p, i) => (
                      <div key={i} className="relative">
                        {p.tipo === 'application/pdf' ? (
                          <div className="w-24 h-24 bg-red-50 border border-red-200 rounded-lg flex flex-col items-center justify-center gap-1">
                            <svg width="24" height="24" fill="none" stroke="#C8181E" strokeWidth={1.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-xs text-red-600">PDF</span>
                          </div>
                        ) : (
                          <img src={p.url} alt={`Nuovo ${i + 1}`}
                            className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                        )}
                        <button type="button" onClick={() => rimuoviNuovoAllegato(i)}
                          className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {allegatiRimasti > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 hover:border-red-400 transition w-fit">
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-sm text-gray-600">
                      Aggiungi allegato ({allegatiRimasti} rimasti)
                    </span>
                    <input type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                      multiple onChange={handleNuoviAllegati} className="hidden" />
                  </label>
                )}
                <p className="text-xs text-gray-400 mt-1">Formati: JPG, PNG, WEBP, PDF — Max {MAX_FOTO_MB}MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Pulsanti */}
        {!chiuso && (
          <div className="flex gap-3">
            <button onClick={() => salvaEAggiorna('in_lavorazione')} disabled={saving}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
              {saving ? 'Salvataggio...' : 'Intervento Parziale'}
            </button>
            <button onClick={() => salvaEAggiorna('risolto')} disabled={saving}
              style={{ backgroundColor: '#C8181E' }}
              className="flex-1 text-white py-3 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50">
              {saving ? 'Salvataggio...' : 'Intervento Chiuso'}
            </button>
          </div>
        )}

        {chiuso && (
          <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-500">
            Questo ticket è stato {STATI_LABEL[ticket.stato]?.toLowerCase()} e non può essere modificato.
          </div>
        )}
      </div>
    </div>
  )
}