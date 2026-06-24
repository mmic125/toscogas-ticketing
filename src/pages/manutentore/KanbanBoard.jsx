import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  PRIORITA_LABEL, TIPI_INTERVENTO,
  PRIORITA_COLORS, CATEGORIE
} from '../../lib/costanti'

function Badge({ testo, colori }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colori}`}>
      {testo}
    </span>
  )
}

const COLONNE = [
  { stato: 'assegnato',      colore: 'border-yellow-400', sfondo: 'bg-yellow-50', titolo: 'Assegnato' },
  { stato: 'in_lavorazione', colore: 'border-orange-400', sfondo: 'bg-orange-50', titolo: 'In Lavorazione' },
  { stato: 'risolto',        colore: 'border-green-400',  sfondo: 'bg-green-50',  titolo: 'Risolto' },
  { stato: 'chiuso',         colore: 'border-gray-400',   sfondo: 'bg-gray-50',   titolo: 'Chiuso' },
]

function TicketCard({ ticket, onClick }) {
  return (
    <div
      onClick={() => onClick(ticket.id)}
      className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 cursor-pointer hover:shadow-md hover:border-gray-200 transition"
    >
      <p className="font-medium text-gray-800 text-sm truncate mb-1">
        {ticket.nome_cliente}
      </p>

      {ticket.codice_cliente && (
        <p className="text-xs text-gray-400 mb-2">{ticket.codice_cliente}</p>
      )}

      <p className="text-xs text-gray-500 mb-2 truncate">
        {TIPI_INTERVENTO[ticket.tipo_problema] || ticket.tipo_problema}
      </p>

      <div className="flex items-center gap-1 flex-wrap">
        <Badge
          testo={PRIORITA_LABEL[ticket.priorita] || ticket.priorita}
          colori={PRIORITA_COLORS[ticket.priorita] || 'bg-gray-100 text-gray-600'}
        />
        {ticket.categoria && (
          <Badge
            testo={CATEGORIE[ticket.categoria] || ticket.categoria}
            colori="bg-blue-100 text-blue-800"
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
        <span className="text-xs text-gray-400">{ticket.provincia || '—'}</span>
        <span className="text-xs text-gray-400">{ticket.data_apertura}</span>
      </div>
    </div>
  )
}

export default function KanbanBoard() {
  const navigate = useNavigate()
  const { profilo } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [cerca, setCerca]     = useState('')

  useEffect(() => { caricaTickets() }, [])

  async function caricaTickets() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('manutentore_id', profilo.id)
      .order('created_at', { ascending: false })

    if (!error) setTickets(data || [])
    setLoading(false)
  }

  const ticketsFiltrati = tickets.filter(t => {
    if (!cerca) return true
    const c = cerca.toLowerCase()
    return (
      t.nome_cliente?.toLowerCase().includes(c) ||
      t.codice_cliente?.toLowerCase().includes(c) ||
      t.provincia?.toLowerCase().includes(c)
    )
  })

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Kanban Board</h1>
          <p className="text-sm text-gray-500 mt-1">{tickets.length} ticket assegnati</p>
        </div>
        <input
          type="text"
          value={cerca}
          onChange={e => setCerca(e.target.value)}
          placeholder="Cerca cliente, codice, provincia..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 w-64"
        />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLONNE.map(col => {
          const ticketColonna = ticketsFiltrati.filter(t => t.stato === col.stato)
          return (
            <div key={col.stato} className="flex-shrink-0 w-72">
              <div className={`rounded-t-lg border-t-4 ${col.colore} ${col.sfondo} px-3 py-2 flex items-center justify-between mb-2`}>
                <span className="text-sm font-semibold text-gray-700">{col.titolo}</span>
                <span className="bg-white text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full border border-gray-200">
                  {ticketColonna.length}
                </span>
              </div>

              <div className="space-y-2 min-h-24">
                {ticketColonna.length === 0 ? (
                  <div className="text-center py-6 text-gray-300 text-xs border-2 border-dashed border-gray-200 rounded-lg">
                    Nessun ticket
                  </div>
                ) : (
                  ticketColonna.map(t => (
                    <TicketCard
                      key={t.id}
                      ticket={t}
                      onClick={id => navigate(`/manutentore/ticket/${id}`)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
