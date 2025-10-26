/**
 * Schedule Service
 * 
 * Handles schedule loading and playlist determination
 */

import { findActiveSlot } from '../utils/scheduleCalculator'
import type { ScheduleSlot } from '../utils/scheduleCalculator'

const STORAGE_KEY = 'planner-time-slots'

/**
 * Load schedule from localStorage
 */
export function loadScheduleFromStorage(): ScheduleSlot[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('❌ Failed to load schedule from localStorage:', error)
  }
  return []
}

/**
 * Save schedule to localStorage
 */
export function saveScheduleToStorage(slots: ScheduleSlot[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots))
  } catch (error) {
    console.error('❌ Failed to save schedule to localStorage:', error)
  }
}

/**
 * Load schedule and determine active playlist
 */
export function loadScheduleAndDeterminePlaylist(): {
  slots: ScheduleSlot[]
  activeSlot: ScheduleSlot | null
  playlistId: string | null
} {
  console.log('📅 Loading schedule from localStorage...')
  
  const slots = loadScheduleFromStorage()
  
  if (slots.length === 0) {
    console.log('⚠️ No schedule found in localStorage')
    return { slots: [], activeSlot: null, playlistId: null }
  }
  
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
}
