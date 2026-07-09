import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { RUOLI } from './lib/costanti'
import Layout from './layouts/Layout'

// Auth
import Login          from './pages/auth/Login'
import CambioPassword from './pages/auth/CambioPassword'
import AttivaMFA      from './pages/auth/AttivaMFA'

// Coordinatore
import ListaTicket     from './pages/coordinatore/ListaTicket'
import DettaglioTicket from './pages/coordinatore/DettaglioTicket'
import RisoluzioneTicket from './pages/coordinatore/RisoluzioneTicket'
import Analisi         from './pages/coordinatore/Analisi'
import ConfigUtenti    from './pages/coordinatore/ConfigUtenti'
import KanbanBoard     from './pages/coordinatore/KanbanBoard'

// Segnalatore
import NuovoTicket       from './pages/segnalatore/NuovoTicket'
import ListaTicketAperti from './pages/segnalatore/ListaTicketAperti'

// Manutentore
import ListaTicketAssegnati   from './pages/manutentore/ListaTicketAssegnati'
import LavorazioneTicket      from './pages/manutentore/LavorazioneTicket'
import KanbanBoardManutentore from './pages/manutentore/KanbanBoard'

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
  // Se deve cambiare password, reindirizza
  if (profilo.must_change_pwd) return <Navigate to="/change-password" replace />
  if (ruoliConsentiti && !ruoliConsentiti.includes(profilo.ruolo)) {
    return <Navigate to="/" replace />
  }
  return children
}

function HomeRedirect() {
  const { profilo, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!profilo) return <Navigate to="/login" replace />
  // Se deve cambiare password, reindirizza
  if (profilo.must_change_pwd) return <Navigate to="/change-password" replace />
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
      <Route path="/change-password" element={<CambioPassword />} />
            {/* MFA — accessibile a tutti gli utenti autenticati */}
      <Route path="/mfa" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<AttivaMFA />} />
      </Route>
      <Route path="/" element={<HomeRedirect />} />


      {/* Coordinatore */}
      <Route path="/coordinatore" element={
        <ProtectedRoute ruoliConsentiti={[RUOLI.COORDINATORE]}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<ListaTicket />} />
        <Route path="kanban" element={<KanbanBoard />} />
        <Route path="ticket/:id" element={<DettaglioTicket />} />
        <Route path="ticket/:id/risoluzione" element={<RisoluzioneTicket />} />
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
        <Route path="ticket/:id" element={<NuovoTicket />} />
      </Route>

      {/* Manutentore */}
      <Route path="/manutentore" element={
        <ProtectedRoute ruoliConsentiti={[RUOLI.MANUTENTORE]}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<ListaTicketAssegnati />} />
        <Route path="kanban" element={<KanbanBoardManutentore />} />
        <Route path="ticket/:id" element={<LavorazioneTicket />} />
      </Route>

      {/* Segnalatore/Manutentore - sezione assegnati */}
      <Route path="/segnalatore/assegnati" element={
        <ProtectedRoute ruoliConsentiti={[RUOLI.SEGNALATORE_MANUTENTORE]}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<ListaTicketAssegnati />} />
        <Route path="ticket/:id" element={<LavorazioneTicket />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}