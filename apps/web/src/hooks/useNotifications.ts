/**
 * Notifications Hook
 * 
 * Manages IoT-based push notifications per user
 * Uses browser Notification API for display
 */

import { useEffect, useState } from 'react'
import { useIoT } from '../contexts/IoTContext'
import { getCurrentUser } from 'aws-amplify/auth'
import { getUserPreferences, saveUserPreferences } from '../services/userPreferences'
import { getCoverArtUrl } from '../utils/mediaUrl'

export interface NotificationMessage {
  type: 'track_change' | 'playlist_update' | 'schedule_alert' | 'system' | 'user_login' | 'user_logout'
  title: string
  body: string
  playerId?: string
  track?: {
    artist: string
    title: string
    coverArtUrl?: string
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
    let isCleanedUp = false
    
    const loadUser = async () => {
      try {
        const user = await getCurrentUser()
        
        // Prevent duplicate execution in React Strict Mode
        if (isCleanedUp) return
        
        setUserId(user.userId)
        
        // Load user preferences
        const prefs = await getUserPreferences(user.userId)
        if (prefs) {
          setNotificationsEnabled(prefs.notificationsEnabled)
        }
        
        // Update login timestamp and count
        const loginTimestamp = new Date().toISOString()
        const loginCount = (prefs?.loginCount || 0) + 1
        
        await saveUserPreferences({
          userId: user.userId,
          lastLoginAt: loginTimestamp,
          loginCount: loginCount
        })
        
        console.log(`🔐 Login tracked: #${loginCount} at ${loginTimestamp}`)
        
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
            timestamp: loginTimestamp
          })
          console.log('📬 Login notification sent via IoT')
        }
      } catch (error) {
        console.warn('No authenticated user')
      }
    }
    
    loadUser()
    
    return () => {
      isCleanedUp = true
    }
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
  const showNotification = async (message: NotificationMessage) => {
    console.log('🎯 Checking notification conditions...')
    console.log('Settings:', { notificationsEnabled, permission })
    
    if (!notificationsEnabled) {
      console.log('🔕 Notifications disabled by user preference')
      return
    }
    
    if (permission !== 'granted') {
      console.log('📬 IoT notification received:', message.title)
      console.log('⚠️ Browser permission not granted - Click the notification button to enable')
      return
    }

    console.log('🔔 Showing browser notification:', message.title)
    console.log('📝 Notification body:', message.body)
    
    try {
      // Get cover art URL if track info is available
      let icon: string | undefined = undefined
      
      if (message.track?.coverArtUrl) {
        console.log('🎨 Loading cover art for notification...')
        icon = await getCoverArtUrl(message.track.coverArtUrl)
        console.log('✅ Cover art URL:', icon)
      }
      
      const notification = new Notification(message.title, {
        body: message.body,
        tag: message.type,
        icon: icon, // Cover art as notification icon
        requireInteraction: false,
        silent: false
      })

      console.log('✅ Notification object created successfully')

      notification.onclick = () => {
        console.log('👆 Notification clicked!')
        window.focus()
        notification.close()
      }

      notification.onshow = () => {
        console.log('👀 Notification is now visible!')
      }

      notification.onerror = (error) => {
        console.error('❌ Notification error:', error)
      }

      notification.onclose = () => {
        console.log('🚪 Notification closed')
      }

      // Auto close after 10 seconds
      setTimeout(() => {
        console.log('⏰ Auto-closing notification after 10s')
        notification.close()
      }, 10000)
    } catch (error) {
      console.error('❌ Failed to create notification:', error)
    }
  }

  // Subscribe to user notifications
  useEffect(() => {
    if (iot.connectionState !== 'Connected' || !userId) {
      console.log('⏳ Waiting for IoT connection and userId...')
      return
    }

    console.log('📬 Subscribing to notification topics...')
    console.log('📋 Settings:', {
      notificationsEnabled,
      browserPermission: permission,
      userId: userId.substring(0, 8) + '...'
    })

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

    console.log(`📡 Subscribing to ${topics.length} topics...`)

    const unsubscribePromises = topics.map(topic =>
      iot.subscribe(topic, (data: unknown) => {
        const message = data as NotificationMessage
        console.log('📬 Notification received:', message)
        showNotification(message)
      })
    )

    console.log('✅ Subscribed to all notification topics')

    return () => {
      console.log('🔌 Unsubscribing from notification topics...')
      unsubscribePromises.forEach(promise => promise.then(unsub => unsub()))
    }
  }, [iot.connectionState, userId, permission, notificationsEnabled])
  
  // Send logout notification on unmount (when user logs out)
  useEffect(() => {
    return () => {
      if (userId && iot.connectionState === 'Connected') {
        const logoutTimestamp = new Date().toISOString()
        
        // Update logout timestamp
        saveUserPreferences({
          userId,
          lastLogoutAt: logoutTimestamp
        }).then(() => {
          console.log(`🔐 Logout tracked at ${logoutTimestamp}`)
        }).catch((error) => {
          console.warn('Failed to save logout timestamp:', error)
        })
        
        // Send IoT notification
        iot.publish(`user/${userId}/notifications/user_logout`, {
          type: 'user_logout',
          title: 'Goodbye!',
          body: 'You have logged out',
          user: {
            username: 'User'
          },
          timestamp: logoutTimestamp
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

  // Initialize and monitor permission state
  useEffect(() => {
    if (!isSupported) return
    
    // Set initial permission
    const initialPermission = Notification.permission
    setPermission(initialPermission)
    console.log('📊 Initial notification permission:', initialPermission)
    
    // Check permission periodically (user might change in browser settings)
    const checkPermission = () => {
      const current = Notification.permission
      setPermission(prev => {
        if (current !== prev) {
          console.log('📊 Permission changed:', prev, '→', current)
        }
        return current
      })
    }
    
    // Check every 2 seconds
    const interval = setInterval(checkPermission, 2000)
    
    // Also check when window gains focus
    window.addEventListener('focus', checkPermission)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', checkPermission)
    }
  }, [isSupported])

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    userId
  }
}
