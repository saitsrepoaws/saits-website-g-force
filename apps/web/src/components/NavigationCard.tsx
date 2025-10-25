import { Link } from 'react-router-dom'

interface NavigationCardProps {
  to: string
  icon: string
  title: string
  description: string
  disabled?: boolean
}

function NavigationCard({ to, icon, title, description, disabled = false }: NavigationCardProps) {
  if (disabled) {
    return (
      <div className="bg-white border border-gray-300 rounded-lg p-6 opacity-50 cursor-not-allowed">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <span className="text-2xl">{icon}</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-600">{description}</p>
        <div className="mt-4 text-xs text-gray-400 font-medium">
          Coming soon...
        </div>
      </div>
    )
  }

  return (
    <Link 
      to={to}
      className="block bg-white border border-gray-300 rounded-lg p-6 hover:shadow-lg hover:border-blue-400 transition-all"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <span className="text-2xl">{icon}</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <p className="text-sm text-gray-600">{description}</p>
      <div className="mt-4 text-xs text-blue-600 font-medium">
        Open →
      </div>
    </Link>
  )
}

export default NavigationCard
