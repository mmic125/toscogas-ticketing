import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  STATI_LABEL, PRIORITA_LABEL, TIPI_INTERVENTO,
  STATO_COLORS, PRIORITA_COLORS, CATEGORIE
} from '../../lib/costanti'

function Badge({ testo, colori }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colori}`}>
      {testo}
    </span>
  )
}

function Campo({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  )
}

export default function DettaglioTicket() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [ticket, setTicket]           = useState(null)
  const [assegnatari, setAssegnatari] = useState([])
  const [allegati, setAllegati]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [errore, setErrore]           = useState('')
  const [successo, setSuccesso]       = useState('')

  const [form, setForm] = useState({
    codice_cliente:            '',
    nome_cliente:              '',
    matricola_serbatoio:       '',
    tipo_problema:             '',
    priorita:                  '',
    categoria:                 '',
    provincia:                 '',
    telefono:                  '',
    note_apertura:             '',
    note_intervento:           '',
    materiale_utilizzato:      '',
    manutentore_id:            '',
    data_intervento_richiesta: '',
    stato:                     '',
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

    if (error) { setErrore('Ticket non trovato.'); setLoading(false); return }

    setTicket(t)
    setForm({
      codice_cliente:            t.codice_cliente || '',
      nome_cliente:              t.nome_cliente || '',
      matricola_serbatoio:       t.matricola_serbatoio || '',
      tipo_problema:             t.tipo_problema || '',
      priorita:                  t.priorita || '',
      categoria:                 t.categoria || '',
      provincia:                 t.provincia || '',
      telefono:                  t.telefono || '',
      note_apertura:             t.note_apertura || '',
      note_intervento:           t.note_intervento || '',
      materiale_utilizzato:      t.materiale_utilizzato || '',
      manutentore_id:            t.manutentore_id || '',
      data_intervento_richiesta: t.data_intervento_richiesta || '',
      stato:                     t.stato || '',
    })

    const { data: m } = await supabase
      .from('profiles')
      .select('id, nome, cognome')
      .in('ruolo', ['manutentore', 'segnalatore_manutentore'])
      .eq('attivo', true)
    setAssegnatari(m || [])

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
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function salva() {
    setSaving(true); setErrore(''); setSuccesso('')
    const { error } = await supabase
      .from('tickets')
      .update({
        codice_cliente:            form.codice_cliente || null,
        nome_cliente:              form.nome_cliente,
        matricola_serbatoio:       form.matricola_serbatoio || null,
        tipo_problema:             form.tipo_problema,
        priorita:                  form.priorita,
        categoria:                 form.categoria || null,
        provincia:                 form.provincia || null,
        telefono:                  form.telefono || null,
        note_apertura:             form.note_apertura || null,
        note_intervento:           form.note_intervento || null,
        materiale_utilizzato:      form.materiale_utilizzato || null,
        manutentore_id:            form.manutentore_id || null,
        data_intervento_richiesta: form.data_intervento_richiesta || null,
      })
      .eq('id', id)

    if (error) { setErrore('Errore nel salvataggio.') }
    else { setSuccesso('Modifiche salvate.'); caricaDati() }
    setSaving(false)
  }

  async function assegna() {
    if (!form.manutentore_id) { setErrore('Seleziona un assegnatario prima di assegnare.'); return }
    setSaving(true); setErrore('')

    let noteIntervento = form.note_intervento
    if (ticket.stato === 'in_lavorazione') {
      const oggi = new Date().toLocaleDateString('it-IT')
      const nota = `[${oggi}] Ticket riassegnato`
      noteIntervento = noteIntervento ? `${noteIntervento}\n${nota}` : nota
    }

    const { error } = await supabase
      .from('tickets')
      .update({
        manutentore_id:            form.manutentore_id,
        data_intervento_richiesta: form.data_intervento_richiesta || null,
        note_intervento:           noteIntervento || null,
        stato:                     'assegnato',
      })
      .eq('id', id)

    if (error) { setErrore('Errore nell\'assegnazione.') }
    else { setSuccesso('Ticket assegnato con successo.'); caricaDati() }
    setSaving(false)
  }

  async function chiudi() {
    if (!window.confirm('Sei sicuro di voler chiudere questo ticket? L\'operazione è irreversibile.')) return
    setSaving(true); setErrore('')
    const { error } = await supabase
      .from('tickets')
      .update({ stato: 'chiuso' })
      .eq('id', id)

    if (error) { setErrore('Errore nella chiusura del ticket.') }
    else { setSuccesso('Ticket chiuso.'); caricaDati() }
    setSaving(false)
  }

  const chiuso = ticket?.stato === 'chiuso'
  const oggi   = new Date().toISOString().split('T')[0]

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )

  if (!ticket) return (
    <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">Ticket non trovato</div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      {/* Intestazione */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => navigate('/coordinatore')} className="text-gray-400 hover:text-gray-600 transition">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-800">{ticket.nome_cliente}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge testo={STATI_LABEL[ticket.stato]} colori={STATO_COLORS[ticket.stato]} />
            <Badge testo={PRIORITA_LABEL[ticket.priorita]} colori={PRIORITA_COLORS[ticket.priorita]} />
            {ticket.categoria && (
              <Badge testo={CATEGORIE[ticket.categoria] || ticket.categoria} colori="bg-blue-100 text-blue-800" />
            )}
          </div>
        </div>
        {!chiuso && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={salva} disabled={saving}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
              {saving ? 'Salvataggio...' : 'Salva modifiche'}
            </button>
            <button onClick={assegna} disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              Assegna Ticket
            </button>
            <button onClick={chiudi} disabled={saving}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              Chiudi Ticket
            </button>
          </div>
        )}
      </div>

      {errore   && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{errore}</p>}
      {successo && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-4">{successo}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">

          {/* Dati cliente */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Dati Cliente</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Codice Cliente</label>
                <input type="text" name="codice_cliente" value={form.codice_cliente} onChange={handleChange} disabled={chiuso}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Nome Cliente *</label>
                <input type="text" name="nome_cliente" value={form.nome_cliente} onChange={handleChange} disabled={chiuso}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Telefono</label>
                <input type="tel" name="telefono" value={form.telefono} onChange={handleChange} disabled={chiuso}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Provincia</label>
                <input type="text" name="provincia" value={form.provincia} onChange={handleChange} disabled={chiuso}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Matricola Serbatoio</label>
                <input type="text" name="matricola_serbatoio" value={form.matricola_serbatoio} onChange={handleChange} disabled={chiuso}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
            </div>
          </div>

          {/* Intervento */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Tipologia di Intervento</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Categoria</label>
                <select name="categoria" value={form.categoria} onChange={handleChange} disabled={chiuso}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white disabled:bg-gray-50 disabled:text-gray-400">
                  <option value="">Seleziona...</option>
                  {Object.entries(CATEGORIE).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Tipologia</label>
                <select name="tipo_problema" value={form.tipo_problema} onChange={handleChange} disabled={chiuso}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white disabled:bg-gray-50 disabled:text-gray-400">
                  {Object.entries(TIPI_INTERVENTO).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Priorità</label>
                <select name="priorita" value={form.priorita} onChange={handleChange} disabled={chiuso}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white disabled:bg-gray-50 disabled:text-gray-400">
                  {Object.entries(PRIORITA_LABEL).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Note Apertura</label>
                <textarea name="note_apertura" value={form.note_apertura} onChange={handleChange} disabled={chiuso} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
            </div>
          </div>

          {/* Lavorazione */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Lavorazione</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Note Intervento</label>
                <textarea name="note_intervento" value={form.note_intervento} onChange={handleChange} disabled={chiuso} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Materiale Utilizzato</label>
                <textarea name="materiale_utilizzato" value={form.materiale_utilizzato} onChange={handleChange} disabled={chiuso} rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
            </div>
          </div>

          {/* Allegati */}
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
        </div>

        {/* Colonna destra */}
        <div className="space-y-4">

          {/* Assegnazione */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Assegnazione</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Assegnatario Intervento
                </label>
                <select name="manutentore_id" value={form.manutentore_id} onChange={handleChange} disabled={chiuso}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white disabled:bg-gray-50 disabled:text-gray-400">
                  <option value="">Nessun assegnatario</option>
                  {assegnatari.map(m => (
                    <option key={m.id} value={m.id}>{m.nome} {m.cognome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Data Intervento Richiesta
                </label>
                <input type="date" name="data_intervento_richiesta" value={form.data_intervento_richiesta}
                  onChange={handleChange} min={oggi} disabled={chiuso}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-400" />
              </div>
            </div>
          </div>

          {/* Info ticket */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Info Ticket</h2>
            <Campo label="Segnalatore">
              {ticket.segnalatore ? `${ticket.segnalatore.nome} ${ticket.segnalatore.cognome}` : '—'}
            </Campo>
            <Campo label="Data Apertura">{ticket.data_apertura}</Campo>
            <Campo label="Data Intervento">{ticket.data_intervento || '—'}</Campo>
            <Campo label="Stato">
              <Badge testo={STATI_LABEL[ticket.stato]} colori={STATO_COLORS[ticket.stato]} />
            </Campo>
          </div>
        </div>
      </div>
    </div>
  )
}