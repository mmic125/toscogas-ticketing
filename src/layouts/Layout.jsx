import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { RUOLI } from '../lib/costanti'

// Icone SVG inline leggere
function IconTicket() {
  return <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
}
function IconPlus() {
  return <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
}
function IconChart() {
  return <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
}
function IconUsers() {
  return <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
}
function IconLogout() {
  return <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
}
function IconMenu() {
  return <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
}
function IconClose() {
  return <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
}
function IconKanban() {
  return <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
}

// Voci di menu per ruolo
function getMenuVoci(ruolo) {
  switch (ruolo) {
    case RUOLI.COORDINATORE:
  return [
    { to: '/coordinatore',         label: 'Tutti i Ticket',  icon: <IconTicket /> },
    { to: '/coordinatore/kanban',  label: 'Kanban Board',    icon: <IconKanban /> },
    { to: '/coordinatore/nuovo',   label: 'Nuovo Ticket',    icon: <IconPlus /> },
    { to: '/coordinatore/analisi', label: 'Analisi',         icon: <IconChart /> },
    { to: '/coordinatore/utenti',  label: 'Gestione Utenti', icon: <IconUsers /> },
  ]
    case RUOLI.SEGNALATORE:
      return [
        { to: '/segnalatore',          label: 'I miei Ticket',     icon: <IconTicket /> },
        { to: '/segnalatore/nuovo',    label: 'Nuovo Ticket',      icon: <IconPlus /> },
      ]
    case RUOLI.MANUTENTORE:
      return [
        { to: '/manutentore',          label: 'Ticket Assegnati',  icon: <IconTicket /> },
        { to: '/manutentore/kanban',   label: 'Kanban Board',      icon: <IconKanban /> },
      ]
    case RUOLI.SEGNALATORE_MANUTENTORE:
      return [
        { to: '/segnalatore',              label: 'I miei Ticket',    icon: <IconTicket /> },
        { to: '/segnalatore/nuovo',        label: 'Nuovo Ticket',     icon: <IconPlus /> },
        { to: '/segnalatore/assegnati',    label: 'Ticket Assegnati', icon: <IconTicket /> },
      ]
    default:
      return []
  }
}

export default function Layout() {
  const { profilo, ruolo, logout } = useAuth()
  const navigate = useNavigate()
  const [menuAperto, setMenuAperto] = useState(false)
  const voci = getMenuVoci(ruolo)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const linkBase = "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-150"
  const linkAttivo = "bg-white text-[#C8181E]"
  const linkInattivo = "text-red-100 hover:bg-red-800 hover:text-white"

  return (
    <div className="min-h-screen bg-gray-100 flex">

      {/* Overlay mobile */}
      {menuAperto && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setMenuAperto(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-[#C8181E] z-30 flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${menuAperto ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-red-700">
          <div>
            <p className="text-white font-bold text-lg leading-tight">Toscogas</p>
            <p className="text-red-200 text-xs mt-0.5">Sistema Ticketing</p>
          </div>
          <button
            onClick={() => setMenuAperto(false)}
            className="lg:hidden text-red-200 hover:text-white"
          >
            <IconClose />
          </button>
        </div>

        {/* Menu voci */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {voci.map(v => (
            <NavLink
              key={v.to}
              to={v.to}
              end={v.to.split('/').length <= 2}
              onClick={() => setMenuAperto(false)}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? linkAttivo : linkInattivo}`
              }
            >
              {v.icon}
              {v.label}
            </NavLink>
          ))}
        </nav>

        {/* Profilo utente + logout */}
        <div className="px-4 py-4 border-t border-red-700">
          <div className="mb-3 px-1">
            <p className="text-white text-sm font-medium truncate">
              {profilo?.nome} {profilo?.cognome}
            </p>
            <p className="text-red-200 text-xs capitalize mt-0.5">
              {ruolo?.replace(/_/g, ' ')}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm text-red-100 hover:bg-red-800 hover:text-white transition-colors"
          >
            <IconLogout />
            Esci
          </button>
        </div>
      </aside>

      {/* Contenuto principale */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header mobile */}
        <header className="lg:hidden bg-[#C8181E] px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow">
          <button
            onClick={() => setMenuAperto(true)}
            className="text-white"
          >
            <IconMenu />
          </button>
          <p className="text-white font-semibold">Toscogas Ticketing</p>
        </header>

        {/* Area pagina */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}