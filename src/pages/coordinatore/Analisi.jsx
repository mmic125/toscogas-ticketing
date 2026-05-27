import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  STATI_LABEL, PRIORITA_LABEL, TIPI_INTERVENTO,
  CATEGORIE
} from '../../lib/costanti'

function KpiCard({ titolo, valore, sottotitolo, colore }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{titolo}</p>
      <p className={`text-3xl font-bold ${colore || 'text-gray-800'}`}>{valore}</p>
      {sottotitolo && <p className="text-xs text-gray-400 mt-1">{sottotitolo}</p>}
    </div>
  )
}

function BarChart({ dati, labelKey, valueKey, colore }) {
  const max = Math.max(...dati.map(d => d[valueKey]), 1)
  return (
    <div className="space-y-2">
      {dati.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-36 text-xs text-gray-600 truncate text-right">{d[labelKey]}</div>
          <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
            <div
              className="h-full rounded-full flex items-center px-2 transition-all duration-500"
              style={{
                width: `${(d[valueKey] / max) * 100}%`,
                backgroundColor: colore || '#C8181E',
                minWidth: d[valueKey] > 0 ? '2rem' : '0'
              }}
            >
              <span className="text-white text-xs font-medium">{d[valueKey]}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MultiSelect({ label, opzioni, valori, onChange }) {
  const [aperto, setAperto] = useState(false)

  function toggleValore(val) {
    if (valori.includes(val)) {
      onChange(valori.filter(v => v !== val))
    } else {
      onChange([...valori, val])
    }
  }

  const labelSelezionati = valori.length === 0
    ? 'Tutti'
    : valori.map(v => opzioni[v]).join(', ')

  return (
    <div className="relative">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <button
        type="button"
        onClick={() => setAperto(!aperto)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        <span className={`truncate ${valori.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
          {labelSelezionati}
        </span>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          className={`flex-shrink-0 ml-2 transition-transform ${aperto ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {aperto && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {Object.entries(opzioni).map(([val, lbl]) => (
            <label
              key={val}
              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={valori.includes(val)}
                onChange={() => toggleValore(val)}
                className="accent-red-600"
              />
              <span className="text-sm text-gray-700">{lbl}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Analisi() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [utenti, setUtenti]   = useState([])

  const [filtri, setFiltri] = useState({
    segnalatori:     [],
    manutentori:     [],
    tipi_intervento: [],
    stati:           [],
    categorie:       [],
    data_da:         '',
    data_a:          '',
  })

  useEffect(() => {
    caricaUtenti()
    caricaTickets()
  }, [])

  useEffect(() => { caricaTickets() }, [filtri])

  async function caricaUtenti() {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, cognome, ruolo')
      .eq('attivo', true)
    setUtenti(data || [])
  }

  async function caricaTickets() {
    setLoading(true)
    let query = supabase
      .from('tickets')
      .select(`
        *,
        segnalatore:profiles!tickets_segnalatore_id_fkey(id, nome, cognome),
        manutentore:profiles!tickets_manutentore_id_fkey(id, nome, cognome)
      `)

    if (filtri.data_da)                    query = query.gte('data_apertura', filtri.data_da)
    if (filtri.data_a)                     query = query.lte('data_apertura', filtri.data_a)
    if (filtri.tipi_intervento.length > 0) query = query.in('tipo_problema', filtri.tipi_intervento)
    if (filtri.stati.length > 0)           query = query.in('stato', filtri.stati)
    if (filtri.categorie.length > 0)       query = query.in('categoria', filtri.categorie)
    if (filtri.segnalatori.length > 0)     query = query.in('segnalatore_id', filtri.segnalatori)
    if (filtri.manutentori.length > 0)     query = query.in('manutentore_id', filtri.manutentori)

    const { data } = await query
    setTickets(data || [])
    setLoading(false)
  }

  function resetFiltri() {
    setFiltri({
      segnalatori: [], manutentori: [], tipi_intervento: [],
      stati: [], categorie: [], data_da: '', data_a: '',
    })
  }

  const haFiltri = filtri.segnalatori.length > 0 || filtri.manutentori.length > 0 ||
    filtri.tipi_intervento.length > 0 || filtri.stati.length > 0 ||
    filtri.categorie.length > 0 || filtri.data_da || filtri.data_a

  // KPI
  const totale  = tickets.length
  const risolti = tickets.filter(t => ['risolto','chiuso'].includes(t.stato)).length
  const inCorso = tickets.filter(t => ['assegnato','in_lavorazione'].includes(t.stato)).length
  const urgenti = tickets.filter(t => t.priorita === 'urgente').length

  const tempiRisoluzione = tickets
    .filter(t => t.data_apertura && t.data_intervento)
    .map(t => Math.round(
      (new Date(t.data_intervento) - new Date(t.data_apertura)) / (1000 * 60 * 60 * 24)
    ))
  const tempoMedio = tempiRisoluzione.length > 0
    ? Math.round(tempiRisoluzione.reduce((a, b) => a + b, 0) / tempiRisoluzione.length)
    : null

  // Dati grafici
  const perStato = Object.entries(STATI_LABEL).map(([val, label]) => ({
    label, valore: tickets.filter(t => t.stato === val).length
  }))

  const perTipo = Object.entries(TIPI_INTERVENTO).map(([val, label]) => ({
    label, valore: tickets.filter(t => t.tipo_problema === val).length
  })).filter(d => d.valore > 0)

  const perCategoria = Object.entries(CATEGORIE).map(([val, label]) => ({
    label, valore: tickets.filter(t => t.categoria === val).length
  })).filter(d => d.valore > 0)

  const segnalatori = utenti.filter(u => ['segnalatore','segnalatore_manutentore'].includes(u.ruolo))
  const manutentori = utenti.filter(u => ['manutentore','segnalatore_manutentore'].includes(u.ruolo))

  const perManutentore = manutentori.map(u => ({
    label: `${u.nome} ${u.cognome}`,
    valore: tickets.filter(t => t.manutentore_id === u.id).length
  })).filter(d => d.valore > 0)

  const perSegnalatore = segnalatori.map(u => ({
    label: `${u.nome} ${u.cognome}`,
    valore: tickets.filter(t => t.segnalatore_id === u.id).length
  })).filter(d => d.valore > 0)

  const opzioniSegnalatori = Object.fromEntries(
    segnalatori.map(u => [u.id, `${u.nome} ${u.cognome}`])
  )
  const opzioniManutentori = Object.fromEntries(
    manutentori.map(u => [u.id, `${u.nome} ${u.cognome}`])
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Analisi</h1>
        <p className="text-sm text-gray-500 mt-1">Statistiche sui ticket</p>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Filtri</h2>

        {/* Date DA - A */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Data apertura DA</p>
            <input
              type="date"
              value={filtri.data_da}
              onChange={e => setFiltri(f => ({ ...f, data_da: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Data apertura A</p>
            <input
              type="date"
              value={filtri.data_a}
              min={filtri.data_da || undefined}
              onChange={e => setFiltri(f => ({ ...f, data_a: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Filtri multipli a tendina */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MultiSelect
            label="Stato"
            opzioni={STATI_LABEL}
            valori={filtri.stati}
            onChange={v => setFiltri(f => ({ ...f, stati: v }))}
          />
          <MultiSelect
            label="Categoria"
            opzioni={CATEGORIE}
            valori={filtri.categorie}
            onChange={v => setFiltri(f => ({ ...f, categorie: v }))}
          />
          <MultiSelect
            label="Tipologia di Intervento"
            opzioni={TIPI_INTERVENTO}
            valori={filtri.tipi_intervento}
            onChange={v => setFiltri(f => ({ ...f, tipi_intervento: v }))}
          />
          {segnalatori.length > 0 && (
            <MultiSelect
              label="Segnalatore"
              opzioni={opzioniSegnalatori}
              valori={filtri.segnalatori}
              onChange={v => setFiltri(f => ({ ...f, segnalatori: v }))}
            />
          )}
          {manutentori.length > 0 && (
            <MultiSelect
              label="Assegnatario Intervento"
              opzioni={opzioniManutentori}
              valori={filtri.manutentori}
              onChange={v => setFiltri(f => ({ ...f, manutentori: v }))}
            />
          )}
        </div>

        {haFiltri && (
          <button onClick={resetFiltri} className="mt-3 text-sm text-red-600 hover:underline">
            Reset tutti i filtri
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-400 text-sm">Caricamento...</p>
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <KpiCard titolo="Totale Ticket"    valore={totale}  />
            <KpiCard titolo="Risolti / Chiusi" valore={risolti} colore="text-green-600" />
            <KpiCard titolo="In Corso"         valore={inCorso} colore="text-yellow-600" />
            <KpiCard titolo="Urgenti"          valore={urgenti} colore="text-red-600" />
            <KpiCard
              titolo="Tempo Medio Risoluzione"
              valore={tempoMedio !== null ? `${tempoMedio}gg` : '—'}
              sottotitolo="dall'apertura all'intervento"
              colore="text-blue-600"
            />
          </div>

          {/* Grafici */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Ticket per Stato</h2>
              <BarChart dati={perStato} labelKey="label" valueKey="valore" colore="#C8181E" />
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Tipologia di Intervento</h2>
              {perTipo.length > 0
                ? <BarChart dati={perTipo} labelKey="label" valueKey="valore" colore="#1D4ED8" />
                : <p className="text-sm text-gray-400">Nessun dato</p>}
            </div>

            {perCategoria.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Ticket per Categoria</h2>
                <BarChart dati={perCategoria} labelKey="label" valueKey="valore" colore="#7C3AED" />
              </div>
            )}

            {perManutentore.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Ticket per Assegnatario</h2>
                <BarChart dati={perManutentore} labelKey="label" valueKey="valore" colore="#059669" />
              </div>
            )}

            {perSegnalatore.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Ticket per Segnalatore</h2>
                <BarChart dati={perSegnalatore} labelKey="label" valueKey="valore" colore="#D97706" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}