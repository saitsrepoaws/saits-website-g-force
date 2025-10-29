// Service layer for Schedule data operations
import { generateClient } from 'aws-amplify/data'

export type Schedule = any
export type CreateScheduleInput = any
export type UpdateScheduleInput = any

let client: any = null

function getClient() {
  if (!client) {
    // @ts-ignore - Amplify Gen 2 client will have models at runtime
    client = generateClient()
    console.log('[Schedules] Client generated')
  }
  return client
}

/**
 * List all schedules
 */
export async function listSchedules() {
  const c = getClient()
  console.log('[Schedules] Fetching all schedules...')
  
  try {
    // @ts-ignore
    const result = await c.models.Schedule.list()
    console.log('[Schedules] Fetched:', result.data?.length || 0, 'schedules')
    return result
  } catch (error) {
    console.error('[Schedules] Failed to list schedules:', error)
    throw error
  }
}

/**
 * Get schedule by ID
 */
export async function getSchedule(id: string) {
  const c = getClient()
  console.log('[Schedules] Fetching schedule:', id)
  
  try {
    // @ts-ignore
    const result = await c.models.Schedule.get({ id })
    console.log('[Schedules] Fetched:', result.data?.name || 'Unknown')
    return result
  } catch (error) {
    console.error('[Schedules] Failed to get schedule:', error)
    throw error
  }
}

/**
 * Create a new schedule
 */
export async function createSchedule(input: CreateScheduleInput) {
  const c = getClient()
  console.log('[Schedules] Creating schedule:', input.name)
  
  try {
    // @ts-ignore
    const result = await c.models.Schedule.create(input)
    console.log('[Schedules] Created:', result.data?.id)
    return result
  } catch (error) {
    console.error('[Schedules] Failed to create schedule:', error)
    throw error
  }
}

/**
 * Update an existing schedule
 */
export async function updateSchedule(id: string, input: UpdateScheduleInput) {
  const c = getClient()
  console.log('[Schedules] Updating schedule:', id)
  
  try {
    // @ts-ignore
    const result = await c.models.Schedule.update({ id, ...input })
    console.log('[Schedules] Updated:', result.data?.id)
    return result
  } catch (error) {
    console.error('[Schedules] Failed to update schedule:', error)
    throw error
  }
}

/**
 * Delete a schedule
 */
export async function deleteSchedule(id: string) {
  const c = getClient()
  console.log('[Schedules] Deleting schedule:', id)
  
  try {
    // @ts-ignore
    const result = await c.models.Schedule.delete({ id })
    console.log('[Schedules] Deleted:', id)
    return result
  } catch (error) {
    console.error('[Schedules] Failed to delete schedule:', error)
    throw error
  }
}

/**
 * Get active schedule for current time
 */
export async function getActiveSchedule() {
  const c = getClient()
  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  const currentDay = now.getDay() // 0=Sunday, 1=Monday, etc.
  
  console.log('[Schedules] Finding active schedule for:', currentTime, 'on day', currentDay)
  
  try {
    // @ts-ignore
    const result = await c.models.Schedule.list({
      filter: { isActive: { eq: true } }
    })
    
    const schedules = result.data || []
    
    // Find schedule that matches current time and day
    const activeSchedule = schedules.find((schedule: any) => {
      // Check if schedule applies to current day (null = every day)
      if (schedule.dayOfWeek !== null && schedule.dayOfWeek !== currentDay) {
        return false
      }
      
      // Check if current time is within schedule range
      const startTime = schedule.startTime
      const endTime = schedule.endTime || '23:59'
      
      return currentTime >= startTime && currentTime < endTime
    })
    
    console.log('[Schedules] Active schedule:', activeSchedule?.name || 'None')
    return activeSchedule
  } catch (error) {
    console.error('[Schedules] Failed to get active schedule:', error)
    throw error
  }
}
