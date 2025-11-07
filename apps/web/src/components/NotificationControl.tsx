/**
 * Notification Control Component
 * 
 * UI for enabling/disabling browser notifications
 */

import { useNotifications } from '../hooks/useNotifications'

export default function NotificationControl() {
  const { isSupported, permission, requestPermission, userId } = useNotifications()

  if (!isSupported) {
    return (
      <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
        🔕 Notifications not supported in this browser
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
        🔕 Login to enable notifications
      </div>
    )
  }

  const handleEnable = async () => {
    const granted = await requestPermission()
    if (granted) {
      console.log('✅ Notifications enabled!')
    } else {
      console.warn('⚠️ Notification permission denied')
    }
  }

  if (permission === 'granted') {
    return (
      <div className="px-3 py-2 bg-green-100 rounded-lg text-sm text-green-700 flex items-center gap-2">
        <span>🔔</span>
        <span className="font-medium">Notifications enabled</span>
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div className="px-3 py-2 bg-red-100 rounded-lg text-sm text-red-700">
        🔕 Notifications blocked - enable in browser settings
      </div>
    )
  }

  return (
    <button
      onClick={handleEnable}
      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
    >
      <span>🔔</span>
      <span>Enable Notifications</span>
    </button>
  )
}
