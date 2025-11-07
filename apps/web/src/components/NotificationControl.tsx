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
      if (!userId) {
        console.log('⏳ No userId yet, waiting...')
        return
      }
      
      console.log('📥 Loading notification preferences for user:', userId)
      setIsLoading(true)
      
      try {
        const prefs = await getUserPreferences(userId)
        
        if (prefs) {
          console.log('✅ Preferences loaded:', {
            notificationsEnabled: prefs.notificationsEnabled,
            lastLoginAt: prefs.lastLoginAt,
            loginCount: prefs.loginCount
          })
          setPreferencesEnabled(prefs.notificationsEnabled)
        } else {
          console.log('ℹ️ No preferences found, using defaults')
          setPreferencesEnabled(true) // Default to enabled
        }
      } catch (error) {
        console.error('❌ Error loading preferences:', error)
        setPreferencesEnabled(true) // Default to enabled on error
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
    console.log(`🔔 Toggling notifications: ${preferencesEnabled} → ${newState}`)
    
    // Optimistically update UI
    setPreferencesEnabled(newState)
    
    try {
      // Save to DynamoDB
      const result = await toggleNotifications(userId, newState)
      
      if (result.errors) {
        // Check if it's just that the table isn't deployed yet
        if (result.errors[0] === 'TABLE_NOT_DEPLOYED') {
          console.warn('⚠️ Preferences not saved (table not deployed). Functionality still works!')
          // Don't rollback or show alert - just log it
          // Local state still works for this session
        } else {
          console.error('❌ Failed to save notification preference:', result.errors)
          // Rollback on real error
          setPreferencesEnabled(!newState)
          alert('Failed to save notification preference. Please try again.')
          return
        }
      } else {
        console.log('✅ Notification preference saved:', newState)
      }
      
      // If enabling, also request browser permission
      if (newState && permission !== 'granted') {
        const granted = await requestPermission()
        if (!granted) {
          console.warn('⚠️ Browser permission denied')
        }
      }
    } catch (error) {
      console.error('❌ Error toggling notifications:', error)
      // Rollback on error
      setPreferencesEnabled(!newState)
      alert('Failed to toggle notifications. Please try again.')
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
  
  // Case 1: User disabled in preferences
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
  
  // Case 2: User enabled in preferences + browser permission granted
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
  
  // Case 3: Browser explicitly denied
  if (permission === 'denied') {
    return (
      <div className="px-3 py-2 bg-red-100 rounded-lg text-sm text-red-700 flex items-center gap-2">
        <span>🔕</span>
        <span>Notifications blocked - enable in browser settings</span>
      </div>
    )
  }

  // Case 4: User enabled in preferences but needs browser permission
  return (
    <button
      onClick={handleEnable}
      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
    >
      <span>🔔</span>
      <span>Enable Browser Notifications</span>
    </button>
  )
}
