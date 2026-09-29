import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { formatData, formatOra } from '../../lib/costanti'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function ConfigLog() {
  const [log, setLog]         = useState([])
  const [loading, setLoading] = useState(true)
  const [errore, setErrore]   = useState('')
  const [filtri, setFiltri]   = useState({ data_da: '', data_a: '' })

  useEffect(() => { caricaLog() }, [])

  async function caricaLog() {
    setLoading(true)
    setErrore('')
    try {
      const token = localStorage.getItem('access_token')
      const params = new URLSearchParams()
      if (filtri.data_da) params.set('data_da', filtri.data_da)
      if (filtri.data_a)  params.set('data_a', filtri.data_a)

      const r = await fetch(`${API_BASE}/api/audit-log?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      if (!r.ok) {
        setErrore(data.error || 'Errore nel caricamento dei log.')
        return
      }
      setLog(data)
    } catch (err) {
      setErrore(`Errore di rete: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleFiltro(e) {
    setFiltri(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function righeExport() {
    return log.map(l => ({
      'Data':      formatData(l.created_at),
      'Ora':       formatOra(l.created_at),
      'Utente':    l.nome ? `${l.nome} ${l.cognome}` : '—',
      'Email':     l.email || '',
      'Azione':    l.action,
      'Risorsa':   l.resource || '',
      'ID Risorsa': l.resource_id || '',
      'IP':        l.ip_address || '',
      'Dettagli':  l.details ? JSON.stringify(l.details) : '',
    }))
  }

  function esportaExcel() {
    const ws = XLSX.utils.json_to_sheet(righeExport())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Log')
    XLSX.writeFile(wb, `audit_log_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function esportaCsv() {
    const righe = righeExport()
    if (righe.length === 0) return
    const intestazioni = Object.keys(righe[0])
    const escapeCsv = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const righeCsv = [
      intestazioni.join(','),
      ...righe.map(r => intestazioni.map(k => escapeCsv(r[k])).join(',')),
    ]
    const blob = new Blob(['﻿' + righeCsv.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Gestione Log</h1>
          <p className="text-sm text-gray-500 mt-1">{log.length} eventi registrati</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={esportaExcel}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            Esporta Excel
          </button>
          <button onClick={esportaCsv}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            Esporta CSV
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data da</label>
            <input type="date" name="data_da" value={filtri.data_da} onChange={handleFiltro}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data a</label>
            <input type="date" name="data_a" value={filtri.data_a} onChange={handleFiltro}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <button onClick={caricaLog}
            style={{ backgroundColor: '#C8181E' }}
            className="text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition">
            Applica filtro
          </button>
        </div>
      </div>

      {errore && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{errore}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-400 text-sm">Caricamento log...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data/Ora</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Utente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Azione</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Risorsa</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Dettagli</th>
                </tr>
              </thead>
              <tbody>
                {log.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-400">Nessun log trovato</td>
                  </tr>
                ) : (
                  log.map(l => (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatData(l.created_at)} <span className="text-gray-400">{formatOra(l.created_at)}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {l.nome ? `${l.nome} ${l.cognome}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-mono text-xs">{l.action}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {l.resource || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">
                        {l.details ? JSON.stringify(l.details) : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
