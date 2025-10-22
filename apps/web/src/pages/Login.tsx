import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus])
  const navigate = useNavigate()

  useEffect(() => {
    if (authStatus === 'authenticated') {
      navigate('/', { replace: true })
    }
  }, [authStatus, navigate])
  return (
    <div className="min-h-screen w-full grid place-items-center p-6 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 text-white">
      <div className="[&_[data-amplify-authenticator]]:bg-transparent [&_[data-amplify-authenticator]]:shadow-none [&_[data-amplify-authenticator]]:border-0">
        <Authenticator loginMechanisms={["email"]} signUpAttributes={["email"]} />
      </div>
    </div>
  )
}
