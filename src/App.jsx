import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { RUOLI } from './lib/costanti'
import Login from './pages/auth/Login'
import Layout from './layouts/Layout'
import NuovoTicket from './pages/segnalatore/NuovoTicket'
import ListaTicket from './pages/coordinatore/ListaTicket'
import DettaglioTicket from './pages/coordinatore/DettaglioTicket'
import ListaTicketAperti from './pages/segnalatore/ListaTicketAperti'
import ListaTicketAssegnati from './pages/manutentore/ListaTicketAssegnati'
import LavorazioneTicket from './pages/manutentore/LavorazioneTicket'
import Analisi from './pages/coordinatore/Analisi'
import ConfigUtenti from './pages/coordinatore/ConfigUtenti'

// Pagine temporanee placeholder (le costruiamo una per una)
const Placeholder = ({ titolo }) => (
  <div className="bg-white rounded-xl shadow-sm p-8">
    <h1 className="text-xl font-semibold text-gray-800">{titolo}</h1>
    <p className="text-gray-400 text-sm mt-1">Pagina in costruzione</p>
  </div>
)

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <p className="text-gray-400 text-sm">Caricamento...</p>
    </div>
  )
}

function ProtectedRoute({ children, ruoliConsentiti }) {
  const { user, profilo, loading, profiloLoading } = useAuth()
  if (loading || profiloLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!profilo) return <Navigate to="/login" replace />
  if (ruoliConsentiti && !ruoliConsentiti.includes(profilo.ruolo)) {
    return <Navigate to="/" replace />
  }
  return children
}

function HomeRedirect() {
  const { profilo, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!profilo) return <Navigate to="/login" replace />
  switch (profilo.ruolo) {
    case RUOLI.COORDINATORE:            return <Navigate to="/coordinatore" replace />
    case RUOLI.SEGNALATORE:             return <Navigate to="/segnalatore" replace />
    case RUOLI.MANUTENTORE:             return <Navigate to="/manutentore" replace />
    case RUOLI.SEGNALATORE_MANUTENTORE: return <Navigate to="/segnalatore" replace />
    default:                            return <Navigate to="/login" replace />
  }
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<HomeRedirect />} />

      {/* Coordinatore */}
      <Route path="/coordinatore" element={
        <ProtectedRoute ruoliConsentiti={[RUOLI.COORDINATORE]}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<ListaTicket />} />
        <Route path="ticket/:id" element={<DettaglioTicket />} />
        <Route path="analisi" element={<Analisi />} />
        <Route path="utenti" element={<ConfigUtenti />} />
        <Route path="nuovo" element={<NuovoTicket />} />
      </Route>

      {/* Segnalatore */}
      <Route path="/segnalatore" element={
        <ProtectedRoute ruoliConsentiti={[RUOLI.SEGNALATORE, RUOLI.SEGNALATORE_MANUTENTORE]}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<ListaTicketAperti />} />
        <Route path="nuovo" element={<NuovoTicket />} />
      </Route>

      {/* Manutentore */}
      <Route path="/manutentore" element={
        <ProtectedRoute ruoliConsentiti={[RUOLI.MANUTENTORE]}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<ListaTicketAssegnati />} />
        <Route path="ticket/:id" element={<LavorazioneTicket />} />
      </Route>

      {/* Segnalatore/Manutentore - sezione assegnati */}
      <Route path="/segnalatore/assegnati" element={
        <ProtectedRoute ruoliConsentiti={[RUOLI.SEGNALATORE_MANUTENTORE]}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Placeholder titolo="Ticket Assegnati" />} />
        <Route path="ticket/:id" element={<Placeholder titolo="Lavorazione Ticket" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/toscogas-ticketing">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}