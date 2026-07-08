import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  TIPI_INTERVENTO, PRIORITA_LABEL, STATI_LABEL,
  PRIORITA_COLORS, STATO_COLORS, CATEGORIE,
  MAX_FOTO, MAX_FOTO_MB, FORMATI_ACCETTATI
} from '../../lib/costanti'

function Badge({ testo, colori }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colori}`}>
      {testo}
    </span>
  )
}

export default function RisoluzioneTicket() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [ticket, setTicket]     = useState(null)
  const [allegati, setAllegati] = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [errore, setErrore]     = useState('')
  const [successo, setSuccesso] = useState('')

  const [nuoviAllegati, setNuoviAllegati] = useState([])
  const [previewNuovi, setPreviewNuovi]   = useState([])

  const [form, setForm] = useState({
    note_intervento:      '',
    materiale_utilizzato: '',
  })

  useEffect(() => { caricaDati() }, [id])

  async function caricaDati() {
    setLoading(true)
    const { data: t, error } = await supabase
      .from('tickets')
      .select(`
        *,
        segnalatore:profiles!tickets_segnalatore_id_fkey(nome, cognome),
        manutentore:profiles!tickets_manutentore_id_fkey(nome, cognome)
      `)
      .eq('id', id)
      .single()

    if (error || !t) {
      setErrore('Ticket non trovato.')
      setLoading(false)
      return
    }

    setTicket(t)
    setForm({
      note_intervento:      t.note_intervento || '',
      materiale_utilizzato: t.materiale_utilizzato || '',
    })

    const { data: f } = await supabase
      .from('ticket_foto')
      .select('*')
      .eq('ticket_id', id)
      .order('ordine')

    if (f && f.length > 0) {
      const allegatiConUrl = f.map(all => {
        const { data } = supabase.storage
          .from('ticket-foto')
          .getPublicUrl(all.storage_path)
        const isPdf = all.storage_path.toLowerCase().endsWith('.pdf')
        return { ...all, url: data.publicUrl, isPdf }
      })
      setAllegati(allegatiConUrl)
    }

    setLoading(false)
  }

  function handleChange(e) {
    const { name, type, checked, value } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
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

  const materialeSenzaFlag = !!form.materiale_utilizzato.trim() && !ticket?.materiale_scaricato

  async function caricaNuoviAllegati() {
    if (nuoviAllegati.length === 0) return
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

  async function chiusuraParziale() {
    setSaving(true); setErrore(''); setSuccesso('')

    const { error } = await supabase
      .from('tickets')
      .update({
        note_intervento:      form.note_intervento || null,
        materiale_utilizzato: form.materiale_utilizzato || null,
      })
      .eq('id', id)

    if (error) {
      setErrore(error.message || 'Errore nel salvataggio.')
      setSaving(false)
      return
    }

    await caricaNuoviAllegati()
    setSuccesso('Chiusura parziale salvata.')
    setNuoviAllegati([])
    setPreviewNuovi([])
    caricaDati()
    setSaving(false)
  }

  async function chiusuraTotale() {
    if (materialeSenzaFlag) {
      setErrore('È stato indicato del materiale utilizzato: conferma il flag "Materiale scaricato dal magazzino" nel Dettaglio Ticket prima di chiudere definitivamente.')
      return
    }
    if (!window.confirm('Sei sicuro di voler chiudere definitivamente questo ticket? L\'operazione è irreversibile.')) return

    setSaving(true); setErrore(''); setSuccesso('')

    const { error } = await supabase
      .from('tickets')
      .update({
        note_intervento:      form.note_intervento || null,
        materiale_utilizzato: form.materiale_utilizzato || null,
        stato:                'chiuso',
      })
      .eq('id', id)

    if (error) {
      setErrore(error.message || 'Errore nella chiusura del ticket.')
      setSaving(false)
      return
    }

    await caricaNuoviAllegati()
    setSuccesso('Chiusura totale completata.')
    setTimeout(() => navigate(`/coordinatore/ticket/${id}`), 1200)
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

  const chiuso = ticket.stato === 'chiuso'
  const allegatiRimasti = MAX_FOTO - allegati.length - nuoviAllegati.length

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => navigate(`/coordinatore/ticket/${id}`)} className="text-gray-400 hover:text-gray-600 transition">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-800">Risoluzione — {ticket.nome_cliente}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge testo={STATI_LABEL[ticket.stato]} colori={STATO_COLORS[ticket.stato]} />
            <Badge testo={PRIORITA_LABEL[ticket.priorita]} colori={PRIORITA_COLORS[ticket.priorita]} />
            {ticket.categoria && (
              <Badge testo={CATEGORIE[ticket.categoria] || ticket.categoria} colori="bg-blue-100 text-blue-800" />
            )}
          </div>
        </div>
      </div>

      {errore   && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{errore}</p>}
      {successo && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-4">{successo}</p>}

      <div className="space-y-4">

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
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Assegnatario</p>
              <p className="text-gray-800">
                {ticket.manutentore ? `${ticket.manutentore.nome} ${ticket.manutentore.cognome}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Data Intervento</p>
              <p className="text-gray-800">{ticket.data_intervento || '—'}</p>
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

            <p className="text-xs text-gray-500">
              Materiale scaricato dal magazzino:{' '}
              <span className={ticket.materiale_scaricato ? 'text-green-700 font-medium' : 'text-gray-400'}>
                {ticket.materiale_scaricato ? 'Sì' : 'No'}
              </span>
              {' '}— il flag si imposta nella pagina Dettaglio Ticket.
            </p>
            {materialeSenzaFlag && !chiuso && (
              <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2">
                È stato indicato del materiale utilizzato: per la chiusura totale conferma prima il flag "Materiale scaricato dal magazzino" nel Dettaglio Ticket.
              </p>
            )}

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
            <button onClick={chiusuraParziale} disabled={saving}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
              {saving ? 'Salvataggio...' : 'Chiusura Parziale'}
            </button>
            <button onClick={chiusuraTotale} disabled={saving || materialeSenzaFlag}
              style={{ backgroundColor: '#C8181E' }}
              title={materialeSenzaFlag ? 'Conferma il flag "Materiale scaricato dal magazzino" nel Dettaglio Ticket prima di chiudere' : undefined}
              className="flex-1 text-white py-3 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50">
              {saving ? 'Salvataggio...' : 'Chiusura Totale'}
            </button>
          </div>
        )}

        {chiuso && (
          <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-500">
            Questo ticket è stato chiuso e non può essere modificato.
          </div>
        )}
      </div>
    </div>
  )
}
