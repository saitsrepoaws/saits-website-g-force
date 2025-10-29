/**
 * Schedule Service
 * 
 * Handles schedule loading and playlist determination from DynamoDB
 * NO localStorage - all data from AWS!
 */

import { findActiveSlot } from '../utils/scheduleCalculator'
import type { ScheduleSlot } from '../utils/scheduleCalculator'
import { listSchedules } from './schedules'

// DAY mapping
const DAY_INDEX_TO_CODE: Record<number, string> = {
  0: 'SUN',
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT'
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

/**
 * Load schedule from DynamoDB and determine active playlist
 */
export async function loadScheduleAndDeterminePlaylist(): Promise<{
  slots: ScheduleSlot[]
  activeSlot: ScheduleSlot | null
  playlistId: string | null
}> {
  console.log('📅 Loading schedule from DynamoDB...')
  
  try {
    const { data: schedules } = await listSchedules()
    
    if (!schedules || schedules.length === 0) {
      console.log('⚠️ No schedules found in DynamoDB')
      return { slots: [], activeSlot: null, playlistId: null }
    }
    
    // Group schedules by time+name to reconstruct TimeSlot with days array
    const slotMap = new Map<string, ScheduleSlot>()
    
    schedules.forEach((schedule: any) => {
      const key = `${schedule.startTime}-${schedule.name}`
      
      if (!slotMap.has(key)) {
        // Create new TimeSlot
        slotMap.set(key, {
          id: schedule.id,
          time: schedule.startTime,
          name: schedule.name,
          playlistId: schedule.playlistId,
          days: schedule.dayOfWeek !== null && schedule.dayOfWeek !== undefined
            ? [DAY_INDEX_TO_CODE[schedule.dayOfWeek]] 
            : DAYS,
          duration: 0, // TODO: calculate from start/end time
          active: schedule.isActive !== false
        })
      } else {
        // Add day to existing slot
        const slot = slotMap.get(key)!
        if (schedule.dayOfWeek !== null && schedule.dayOfWeek !== undefined) {
          const dayCode = DAY_INDEX_TO_CODE[schedule.dayOfWeek]
          if (!slot.days.includes(dayCode)) {
            slot.days.push(dayCode)
          }
        }
      }
    })
    
    const slots = Array.from(slotMap.values())
    console.log('✅ Loaded', slots.length, 'schedule slots from DynamoDB')
    
    // Find active slot for current time
    const activeSlot = findActiveSlot(slots)
    
    if (activeSlot) {
      console.log('✅ Active slot found:', activeSlot.name, `(${activeSlot.time})`)
      console.log('📋 Playlist ID:', activeSlot.playlistId)
      
      return {
        slots,
        activeSlot,
        playlistId: activeSlot.playlistId
      }
    } else {
      console.log('⚠️ No active slot for current time')
      return { slots, activeSlot: null, playlistId: null }
    }
  } catch (error) {
    console.error('❌ Failed to load schedules from DynamoDB:', error)
    return { slots: [], activeSlot: null, playlistId: null }
  }
}
