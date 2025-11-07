/**
 * Notification Control Component
 * 
 * UI for enabling/disabling browser notifications
 * Saves preference to DynamoDB
 */

import { useEffect, useState } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import { getUserPreferences, toggleNotifications } from '../services/userPreferences'

export default function NotificationControl() {
  const { isSupported, permission, requestPermission, userId } = useNotifications()
  const [isLoading, setIsLoading] = useState(true)
  const [preferencesEnabled, setPreferencesEnabled] = useState(true)
  
  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!userId) return
      
      setIsLoading(true)
      const prefs = await getUserPreferences(userId)
      
      if (prefs) {
        setPreferencesEnabled(prefs.notificationsEnabled)
      }
      
      setIsLoading(false)
    }
    
    loadPreferences()
  }, [userId])

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

  const handleToggle = async () => {
    if (!userId) return
    
    const newState = !preferencesEnabled
    setPreferencesEnabled(newState)
    
    // Save to DynamoDB
    await toggleNotifications(userId, newState)
    
    // If enabling, also request browser permission
    if (newState && permission !== 'granted') {
      await requestPermission()
    }
  }

  if (isLoading) {
    return (
      <button
        className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium flex items-center gap-2"
        disabled
      >
        <span>⏳</span>
        <span>Loading...</span>
      </button>
    )
  }

  // Show current state with toggle ability
  if (preferencesEnabled && permission === 'granted') {
    return (
      <button
        onClick={handleToggle}
        className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-green-200 transition-colors"
      >
        <span>🔔</span>
        <span>Notifications enabled</span>
        <span className="px-2 py-0.5 bg-green-200 rounded text-xs">✓ Click to disable</span>
      </button>
    )
  }
  
  if (!preferencesEnabled) {
    return (
      <button
        onClick={handleToggle}
        className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-200 transition-colors"
      >
        <span>🔕</span>
        <span>Notifications disabled</span>
        <span className="px-2 py-0.5 bg-gray-200 rounded text-xs">Click to enable</span>
      </button>
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
