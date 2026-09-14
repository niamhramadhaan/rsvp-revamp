import { useEffect, useState } from 'react'
import DashboardLayout from './components/DashboardLayout'
import LoginPage from './components/ui/login'
import { useSessionUser } from './data/hooks'
import { getSessionUser } from './data/session'
import { cn } from './lib/utils'

function App() {
  // No session → the login gate owns the screen; signing in writes the
  // session key, which this subscription picks up (see session.ts).
  const user = useSessionUser()
  // The gate stays mounted just past sign-in so it fades over the incoming
  // dashboard instead of vanishing between frames — and remounts instantly,
  // already opaque, on sign-out.
  const [gateOpen, setGateOpen] = useState(() => getSessionUser() == null)

  useEffect(() => {
    if (!user) {
      setGateOpen(true)
      return
    }
    const timer = window.setTimeout(() => setGateOpen(false), 500)
    return () => window.clearTimeout(timer)
  }, [user])

  return (
    <div className="relative min-h-dvh">
      {user && <DashboardLayout />}
      {gateOpen && (
        <div
          className={cn(
            'absolute inset-0 z-50 transition-opacity duration-500',
            user ? 'pointer-events-none opacity-0' : 'opacity-100',
          )}
        >
          <LoginPage />
        </div>
      )}
    </div>
  )
}

export default App
