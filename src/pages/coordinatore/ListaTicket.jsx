import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  STATI_LABEL, PRIORITA_LABEL, TIPI_INTERVENTO,
  STATO_COLORS, PRIORITA_COLORS, CATEGORIE
} from '../../lib/costanti'
import * as XLSX from 'xlsx'

function Badge({ testo, colori }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colori}`}>
      {testo}
    </span>
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
      <button
        type="button"
        onClick={() => setAperto(!aperto)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        <span className={`truncate ${valori.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
          {label}: {labelSelezionati}
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

export default function ListaTicket() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [errore, setErrore]   = useState('')
  const [utenti, setUtenti]   = useState([])

  const [filtri, setFiltri] = useState({
    cerca:           '',
    stati:           [],
    priorita:        [],
    tipi_intervento: [],
    categorie:       [],
    segnalatori:     [],
    manutentori:     [],
  })

  useEffect(() => {
    caricaUtenti()
    caricaTickets()
  }, [])

  async function caricaUtenti() {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, cognome, ruolo')
      .eq('attivo', true)
    setUtenti(data || [])
  }

  async function caricaTickets() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        segnalatore:profiles!tickets_segnalatore_id_fkey(id, nome, cognome),
        manutentore:profiles!tickets_manutentore_id_fkey(id, nome, cognome)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      setErrore('Errore nel caricamento dei ticket.')
    } else {
      setTickets(data)
    }
    setLoading(false)
  }

  const ticketsFiltrati = useMemo(() => {
    return tickets.filter(t => {
      const cerca = filtri.cerca.toLowerCase()
      if (cerca && !(
        t.nome_cliente?.toLowerCase().includes(cerca) ||
        t.codice_cliente?.toLowerCase().includes(cerca) ||
        t.provincia?.toLowerCase().includes(cerca)
      )) return false
      if (filtri.stati.length > 0           && !filtri.stati.includes(t.stato))           return false
      if (filtri.priorita.length > 0        && !filtri.priorita.includes(t.priorita))     return false
      if (filtri.tipi_intervento.length > 0 && !filtri.tipi_intervento.includes(t.tipo_problema)) return false
      if (filtri.categorie.length > 0       && !filtri.categorie.includes(t.categoria))   return false
      if (filtri.segnalatori.length > 0     && !filtri.segnalatori.includes(t.segnalatore_id)) return false
      if (filtri.manutentori.length > 0     && !filtri.manutentori.includes(t.manutentore_id)) return false
      return true
    })
  }, [tickets, filtri])

  function resetFiltri() {
    setFiltri({
      cerca: '', stati: [], priorita: [], tipi_intervento: [],
      categorie: [], segnalatori: [], manutentori: [],
    })
  }

  const haFiltri = filtri.cerca || filtri.stati.length > 0 || filtri.priorita.length > 0 ||
    filtri.tipi_intervento.length > 0 || filtri.categorie.length > 0 ||
    filtri.segnalatori.length > 0 || filtri.manutentori.length > 0

  const segnalatori = utenti.filter(u => ['segnalatore','segnalatore_manutentore'].includes(u.ruolo))
  const manutentori = utenti.filter(u => ['manutentore','segnalatore_manutentore'].includes(u.ruolo))

  const opzioniSegnalatori = Object.fromEntries(
    segnalatori.map(u => [u.id, `${u.nome} ${u.cognome}`])
  )
  const opzioniManutentori = Object.fromEntries(
    manutentori.map(u => [u.id, `${u.nome} ${u.cognome}`])
  )

  function esportaExcel() {
    const righe = ticketsFiltrati.map(t => ({
      'Codice Cliente':    t.codice_cliente || '',
      'Nome Cliente':      t.nome_cliente,
      'Provincia':         t.provincia || '',
      'Categoria':         CATEGORIE[t.categoria] || '',
      'Tipologia':         TIPI_INTERVENTO[t.tipo_problema] || t.tipo_problema,
      'Priorità':          PRIORITA_LABEL[t.priorita] || t.priorita,
      'Stato':             STATI_LABEL[t.stato] || t.stato,
      'Segnalatore':       t.segnalatore ? `${t.segnalatore.nome} ${t.segnalatore.cognome}` : '',
      'Assegnatario':      t.manutentore ? `${t.manutentore.nome} ${t.manutentore.cognome}` : '',
      'Data Apertura':     t.data_apertura,
      'Data Int. Richiesta': t.data_intervento_richiesta || '',
      'Data Intervento':   t.data_intervento || '',
    }))
    const ws = XLSX.utils.json_to_sheet(righe)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ticket')
    XLSX.writeFile(wb, `ticket_toscogas_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-gray-400 text-sm">Caricamento ticket...</p>
    </div>
  )

  return (
    <div>
      {/* Intestazione */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Tutti i Ticket</h1>
          <p className="text-sm text-gray-500 mt-1">{ticketsFiltrati.length} ticket trovati</p>
        </div>
        <button
          onClick={esportaExcel}
          className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Esporta Excel
        </button>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        {/* Ricerca testo */}
        <input
          type="text"
          value={filtri.cerca}
          onChange={e => setFiltri(f => ({ ...f, cerca: e.target.value }))}
          placeholder="Cerca per cliente, codice, provincia..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-3"
        />

        {/* Filtri multipli a tendina */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MultiSelect
            label="Stato"
            opzioni={STATI_LABEL}
            valori={filtri.stati}
            onChange={v => setFiltri(f => ({ ...f, stati: v }))}
          />
          <MultiSelect
            label="Priorità"
            opzioni={PRIORITA_LABEL}
            valori={filtri.priorita}
            onChange={v => setFiltri(f => ({ ...f, priorita: v }))}
          />
          <MultiSelect
            label="Categoria"
            opzioni={CATEGORIE}
            valori={filtri.categorie}
            onChange={v => setFiltri(f => ({ ...f, categorie: v }))}
          />
          <MultiSelect
            label="Tipologia"
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
              label="Assegnatario"
              opzioni={opzioniManutentori}
              valori={filtri.manutentori}
              onChange={v => setFiltri(f => ({ ...f, manutentori: v }))}
            />
          )}
        </div>

        {haFiltri && (
          <button onClick={resetFiltri} className="mt-3 text-sm text-red-600 hover:underline">
            Reset filtri
          </button>
        )}
      </div>

      {errore && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{errore}</p>
      )}

      {/* Tabella */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Provincia</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipologia</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Priorità</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Stato</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Segnalatore</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Assegnatario</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Apertura</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Int. Richiesto</th>
              </tr>
            </thead>
            <tbody>
              {ticketsFiltrati.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-400">
                    Nessun ticket trovato
                  </td>
                </tr>
              ) : (
                ticketsFiltrati.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/coordinatore/ticket/${t.id}`)}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{t.nome_cliente}</div>
                      {t.codice_cliente && (
                        <div className="text-xs text-gray-400">{t.codice_cliente}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.provincia || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {CATEGORIE[t.categoria] || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {TIPI_INTERVENTO[t.tipo_problema] || t.tipo_problema}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        testo={PRIORITA_LABEL[t.priorita] || t.priorita}
                        colori={PRIORITA_COLORS[t.priorita] || 'bg-gray-100 text-gray-600'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        testo={STATI_LABEL[t.stato] || t.stato}
                        colori={STATO_COLORS[t.stato] || 'bg-gray-100 text-gray-600'}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {t.segnalatore
                        ? `${t.segnalatore.nome} ${t.segnalatore.cognome}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {t.manutentore
                        ? `${t.manutentore.nome} ${t.manutentore.cognome}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.data_apertura}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {t.data_intervento_richiesta || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}