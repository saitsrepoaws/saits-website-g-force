/**
 * Notifications Hook
 * 
 * Manages IoT-based push notifications per user
 * Uses browser Notification API for display
 */

import { useEffect, useState } from 'react'
import { useIoT } from '../contexts/IoTContext'
import { getCurrentUser } from 'aws-amplify/auth'

export interface NotificationMessage {
  type: 'track_change' | 'playlist_update' | 'schedule_alert' | 'system'
  title: string
  body: string
  playerId?: string
  track?: {
    artist: string
    title: string
  }
  timestamp: string
}

export function useNotifications() {
  const iot = useIoT()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [userId, setUserId] = useState<string | null>(null)

  // Get user ID
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getCurrentUser()
        setUserId(user.userId)
      } catch (error) {
        console.warn('No authenticated user')
      }
    }
    loadUser()
  }, [])

  // Request notification permission
  const requestPermission = async () => {
    if ('Notification' in window) {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === 'granted'
    }
    return false
  }

  // Show browser notification
  const showNotification = (message: NotificationMessage) => {
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
      // User-specific topics (future)
      `user/${userId}/notifications/track_change`,
      `user/${userId}/notifications/playlist_update`,
      `user/${userId}/notifications/schedule_alert`,
      `user/${userId}/notifications/system`,
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
