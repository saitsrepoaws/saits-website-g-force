import { ReactNode, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthenticator } from '@aws-amplify/ui-react'

export default function AuthGate({ children }: { children: ReactNode }) {
  const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus])
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      if (location.pathname !== '/login') navigate('/login', { replace: true })
    }
  }, [authStatus, location.pathname, navigate])

  if (authStatus === 'configuring' || authStatus === 'loading') {
    return <div className="p-6 text-sm text-gray-600">Loading...</div>
  }
  if (authStatus !== 'authenticated') return null
  return <>{children}</>
}
