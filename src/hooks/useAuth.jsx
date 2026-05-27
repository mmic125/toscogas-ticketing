import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null)
  const [profilo, setProfilo]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [profiloLoading, setProfiloLoading] = useState(false)

  async function caricaProfilo(userId) {
    setProfiloLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) throw error
      setProfilo(data)
    } catch (e) {
      console.error('Errore caricamento profilo:', e)
      setProfilo(null)
    } finally {
      setProfiloLoading(false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      console.warn('Timeout auth')
      setLoading(false)
    }, 8000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session?.user?.id)
        clearTimeout(timeout)
        if (session?.user) {
          setUser(session.user)
          setLoading(false)
          // Carica il profilo in background senza bloccare
          caricaProfilo(session.user.id)
        } else {
          setUser(null)
          setProfilo(null)
          setLoading(false)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/toscogas-ticketing/reset-password`,
    })
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{
      user,
      profilo,
      ruolo: profilo?.ruolo ?? null,
      loading,
      profiloLoading,
      login,
      logout,
      resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider')
  return ctx
}