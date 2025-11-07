/**
 * Notifications Hook
 * 
 * Manages IoT-based push notifications per user
 * Uses browser Notification API for display
 */

import { useEffect, useState } from 'react'
import { useIoT } from '../contexts/IoTContext'
import { getCurrentUser } from 'aws-amplify/auth'
import { getUserPreferences } from '../services/userPreferences'

export interface NotificationMessage {
  type: 'track_change' | 'playlist_update' | 'schedule_alert' | 'system' | 'user_login' | 'user_logout'
  title: string
  body: string
  playerId?: string
  track?: {
    artist: string
    title: string
  }
  user?: {
    username: string
    email?: string
  }
  timestamp: string
}

export function useNotifications() {
  const iot = useIoT()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [userId, setUserId] = useState<string | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  // Get user ID and send login notification
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getCurrentUser()
        setUserId(user.userId)
        
        // Load user preferences
        const prefs = await getUserPreferences(user.userId)
        if (prefs) {
          setNotificationsEnabled(prefs.notificationsEnabled)
        }
        
        // Send login notification to IoT (will be picked up by other tabs/devices)
        if (iot.connectionState === 'Connected' && prefs?.notifyOnLogin) {
          await iot.publish(`user/${user.userId}/notifications/user_login`, {
            type: 'user_login',
            title: 'Welcome Back!',
            body: `You logged in as ${user.username || 'User'}`,
            user: {
              username: user.username || 'User',
              email: (user as any).email || undefined
            },
            timestamp: new Date().toISOString()
          })
          console.log('📬 Login notification sent via IoT')
        }
      } catch (error) {
        console.warn('No authenticated user')
      }
    }
    loadUser()
  }, [iot.connectionState])

  // Request notification permission
  const requestPermission = async () => {
    if ('Notification' in window) {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === 'granted'
    }
    return false
  }

  // Show browser notification (respects user preferences)
  const showNotification = (message: NotificationMessage) => {
    // Check if notifications are enabled in preferences
    if (!notificationsEnabled) {
      console.log('🔕 Notifications disabled in user preferences')
      return
    }
    
    if (permission !== 'granted') {
      console.warn('Notification permission not granted')
      return
    }

    const notification = new Notification(message.title, {
      body: message.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: message.type,
      requireInteraction: false,
      silent: false
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000)
  }

  // Subscribe to user notifications
  useEffect(() => {
    if (iot.connectionState !== 'Connected' || !userId) {
      return
    }

    console.log('📬 Subscribing to user notifications...')

    // Subscribe to all notification types
    const topics = [
      // User-specific topics
      `user/${userId}/notifications/track_change`,
      `user/${userId}/notifications/playlist_update`,
      `user/${userId}/notifications/schedule_alert`,
      `user/${userId}/notifications/system`,
      `user/${userId}/notifications/user_login`,
      `user/${userId}/notifications/user_logout`,
      // Broadcast topics (all users)
      'notifications/track_change',
      'notifications/playlist_update',
      'notifications/system'
    ]

    const unsubscribePromises = topics.map(topic =>
      iot.subscribe(topic, (data: unknown) => {
        const message = data as NotificationMessage
        console.log('📬 Notification received:', message)
        showNotification(message)
      })
    )

    return () => {
      unsubscribePromises.forEach(promise => promise.then(unsub => unsub()))
    }
  }, [iot.connectionState, userId, permission])
  
  // Send logout notification on unmount (when user logs out)
  useEffect(() => {
    return () => {
      if (userId && iot.connectionState === 'Connected') {
        iot.publish(`user/${userId}/notifications/user_logout`, {
          type: 'user_logout',
          title: 'Goodbye!',
          body: 'You have logged out',
          user: {
            username: 'User'
          },
          timestamp: new Date().toISOString()
        }).then(() => {
          console.log('📬 Logout notification sent via IoT')
        }).catch((error) => {
          console.warn('Failed to send logout notification:', error)
        })
      }
    }
  }, [userId, iot.connectionState])

  // Check if notifications are supported
  const isSupported = 'Notification' in window

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    userId
  }
}
