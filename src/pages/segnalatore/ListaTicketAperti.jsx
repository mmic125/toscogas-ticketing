import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
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

export default function ListaTicketAperti() {
  const { profilo } = useAuth()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [errore, setErrore]   = useState('')
  const [filtri, setFiltri]   = useState({
    cerca: '', stato: '', priorita: '', tipo_problema: '',
    data_apertura_da: '', data_apertura_a: '',
    data_risoluzione_da: '', data_risoluzione_a: '',
  })

  useEffect(() => { caricaTickets() }, [])

  async function caricaTickets() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('segnalatore_id', profilo.id)
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
      if (filtri.stato && t.stato !== filtri.stato) return false
      if (filtri.priorita && t.priorita !== filtri.priorita) return false
      if (filtri.tipo_problema && t.tipo_problema !== filtri.tipo_problema) return false
      if (filtri.data_apertura_da && (!t.data_apertura || t.data_apertura < filtri.data_apertura_da)) return false
      if (filtri.data_apertura_a && (!t.data_apertura || t.data_apertura > filtri.data_apertura_a)) return false
      if (filtri.data_risoluzione_da && (!t.data_intervento || t.data_intervento < filtri.data_risoluzione_da)) return false
      if (filtri.data_risoluzione_a && (!t.data_intervento || t.data_intervento > filtri.data_risoluzione_a)) return false
      return true
    })
  }, [tickets, filtri])

  function handleFiltro(e) {
    setFiltri(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function resetFiltri() {
    setFiltri({
      cerca: '', stato: '', priorita: '', tipo_problema: '',
      data_apertura_da: '', data_apertura_a: '',
      data_risoluzione_da: '', data_risoluzione_a: '',
    })
  }

  function filtraApertoOggi() {
    const oggi = new Date().toISOString().split('T')[0]
    setFiltri(f => ({ ...f, data_apertura_da: oggi, data_apertura_a: oggi }))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-gray-400 text-sm">Caricamento ticket...</p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">I miei Ticket</h1>
          <p className="text-sm text-gray-500 mt-1">{ticketsFiltrati.length} ticket trovati</p>
        </div>
        <button
          onClick={() => navigate('/segnalatore/nuovo')}
          style={{ backgroundColor: '#C8181E' }}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuovo Ticket
        </button>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            name="cerca"
            value={filtri.cerca}
            onChange={handleFiltro}
            placeholder="Cerca cliente, provincia..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <select name="stato" value={filtri.stato} onChange={handleFiltro}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
            <option value="">Tutti gli stati</option>
            {Object.entries(STATI_LABEL).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <select name="priorita" value={filtri.priorita} onChange={handleFiltro}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
            <option value="">Tutte le priorità</option>
            {Object.entries(PRIORITA_LABEL).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <select name="tipo_problema" value={filtri.tipo_problema} onChange={handleFiltro}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
            <option value="">Tutte le tipologie</option>
            {Object.entries(TIPI_INTERVENTO).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Filtri data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Apertura da</label>
            <input type="date" name="data_apertura_da" value={filtri.data_apertura_da} onChange={handleFiltro}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">a</label>
              <input type="date" name="data_apertura_a" value={filtri.data_apertura_a} onChange={handleFiltro}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <button type="button" onClick={filtraApertoOggi}
              className="border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
              Oggi
            </button>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Risoluzione da</label>
            <input type="date" name="data_risoluzione_da" value={filtri.data_risoluzione_da} onChange={handleFiltro}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">a</label>
            <input type="date" name="data_risoluzione_a" value={filtri.data_risoluzione_a} onChange={handleFiltro}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>

        {(filtri.cerca || filtri.stato || filtri.priorita || filtri.tipo_problema ||
          filtri.data_apertura_da || filtri.data_apertura_a ||
          filtri.data_risoluzione_da || filtri.data_risoluzione_a) && (
          <button onClick={resetFiltri} className="mt-2 text-sm text-red-600 hover:underline">
            Reset filtri
          </button>
        )}
      </div>

      {errore && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{errore}</p>
      )}

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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Apertura</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Data Risoluzione</th>
              </tr>
            </thead>
            <tbody>
              {ticketsFiltrati.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    Nessun ticket trovato
                  </td>
                </tr>
              ) : (
                ticketsFiltrati.map(t => (
                  <tr key={t.id}
                    onClick={() => navigate(`/segnalatore/ticket/${t.id}`)}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{t.nome_cliente}</div>
                      {t.codice_cliente && (
                        <div className="text-xs text-gray-400">{t.codice_cliente}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.provincia || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{CATEGORIE[t.categoria] || '—'}</td>
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
                    <td className="px-4 py-3 text-gray-600">{t.data_apertura}</td>
                    <td className="px-4 py-3 text-gray-600">{t.data_intervento || '—'}</td>
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