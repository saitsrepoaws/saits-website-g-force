/**
 * User Preferences Service
 * 
 * Manages user settings in DynamoDB
 */

import { generateClient } from 'aws-amplify/data'

export interface UserPreferences {
  userId: string
  notificationsEnabled: boolean
  notifyOnTrackChange: boolean
  notifyOnPlaylistUpdate: boolean
  notifyOnLogin: boolean
  theme?: string
  defaultView?: string
  lastLoginAt?: string
  lastLogoutAt?: string
  loginCount?: number
  createdAt?: string
  updatedAt?: string
}

// Lazy client
let client: any = null

function getClient() {
  if (!client) {
    // @ts-ignore
    client = generateClient()
  }
  return client
}

/**
 * Get user preferences by userId
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    // @ts-ignore
    const { data, errors } = await getClient().models.UserPreferences.get({ userId })
    
    if (errors) {
      console.error('Error getting user preferences:', errors)
      return null
    }
    
    return data as UserPreferences
  } catch (error) {
    console.error('Failed to get user preferences:', error)
    return null
  }
}

/**
 * Create or update user preferences
 */
export async function saveUserPreferences(preferences: Partial<UserPreferences> & { userId: string }) {
  try {
    // Try to get existing preferences first
    const existing = await getUserPreferences(preferences.userId)
    
    if (existing) {
      // Update existing
      const updateData = {
        ...preferences,
        updatedAt: new Date().toISOString()
      }
      // @ts-ignore
      const { data, errors } = await getClient().models.UserPreferences.update(updateData)
      
      if (errors) {
        console.error('Error updating user preferences:', errors)
        return { data: null, errors }
      }
      
      console.log('✅ User preferences updated')
      return { data, errors: null }
    } else {
      // Create new
      // @ts-ignore
      const { data, errors } = await getClient().models.UserPreferences.create({
        userId: preferences.userId,
        notificationsEnabled: preferences.notificationsEnabled ?? true,
        notifyOnTrackChange: preferences.notifyOnTrackChange ?? true,
        notifyOnPlaylistUpdate: preferences.notifyOnPlaylistUpdate ?? true,
        notifyOnLogin: preferences.notifyOnLogin ?? false,
        theme: preferences.theme ?? 'light',
        defaultView: preferences.defaultView ?? undefined,
        lastLoginAt: preferences.lastLoginAt ?? undefined,
        lastLogoutAt: preferences.lastLogoutAt ?? undefined,
        loginCount: preferences.loginCount ?? 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      
      if (errors) {
        console.error('Error creating user preferences:', errors)
        return { data: null, errors }
      }
      
      console.log('✅ User preferences created')
      return { data, errors: null }
    }
  } catch (error) {
    console.error('Failed to save user preferences:', error)
    return { data: null, errors: [error] }
  }
}

/**
 * Toggle notification setting
 */
export async function toggleNotifications(userId: string, enabled: boolean) {
  return saveUserPreferences({
    userId,
    notificationsEnabled: enabled
  })
}
