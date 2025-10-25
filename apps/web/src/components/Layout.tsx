import { type ReactNode, useEffect, useState } from 'react'
import { getCurrentUser } from 'aws-amplify/auth'
import { useAuthenticator } from '@aws-amplify/ui-react'
import { Link } from 'react-router-dom'

interface LayoutProps {
  children: ReactNode
  title?: string
  showBackButton?: boolean
  backTo?: string
}

function Layout({ children, title, showBackButton = false, backTo = '/' }: LayoutProps) {
  const [email, setEmail] = useState<string>('')
  const { signOut } = useAuthenticator()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const user = await getCurrentUser()
        if (mounted) setEmail(user?.username ?? '')
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="w-full bg-white border-b border-gray-300 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <Link 
              to={backTo}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          )}
          <Link to="/" className="text-lg font-bold text-gray-900 hover:text-gray-700">
            G-Forge IoT
          </Link>
          {title && (
            <>
              <span className="text-gray-400">/</span>
              <span className="text-sm text-gray-600">{title}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-700">
          <span className="font-medium">{email}</span>
          <button
            onClick={() => signOut()}
            className="ml-2 rounded bg-gray-900 px-2 py-1 text-white text-[11px] hover:bg-gray-700"
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="w-full p-6 flex-1">
        {children}
      </main>
    </div>
  )
}

export default Layout
