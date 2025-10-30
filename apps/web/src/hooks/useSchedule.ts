import { useState, useEffect, useCallback } from 'react'
import { loadScheduleAndDeterminePlaylist } from '../services/scheduleService'
import { calculateCurrentTrack } from '../utils/scheduleCalculator'
import type { ScheduleSlot, CurrentTrackInfo } from '../utils/scheduleCalculator'

export interface UseScheduleReturn {
  scheduleSlots: ScheduleSlot[]
  activeSlot: ScheduleSlot | null
  currentTrackInfo: CurrentTrackInfo | null
  scheduledTrackId: string | null
  isLoading: boolean
  error: Error | null
  reload: () => Promise<void>
}

interface UseScheduleOptions {
  playlistTracksCache?: any[]
  playlistName?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useSchedule(options: UseScheduleOptions = {}): UseScheduleReturn {
  const {
    playlistTracksCache = [],
    playlistName = 'Playlist',
    autoRefresh = true,
    refreshInterval = 1000
  } = options

  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([])
  const [activeSlot, setActiveSlot] = useState<ScheduleSlot | null>(null)
  const [currentTrackInfo, setCurrentTrackInfo] = useState<CurrentTrackInfo | null>(null)
  const [scheduledTrackId, setScheduledTrackId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Load schedule from service
  const loadSchedule = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await loadScheduleAndDeterminePlaylist()
      setScheduleSlots(result.slots)
      setActiveSlot(result.activeSlot)
      console.log('✅ Schedule loaded:', result.slots.length, 'slots')
      console.log('🎯 Active slot:', result.activeSlot?.name)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load schedule')
      setError(error)
      console.error('❌ Failed to load schedule:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Calculate scheduled track
  const updateScheduledTrack = useCallback(() => {
    if (!activeSlot || playlistTracksCache.length === 0) {
      setScheduledTrackId(null)
      setCurrentTrackInfo(null)
      return
    }

    try {
      // Calculate current track
      const trackInfo = calculateCurrentTrack(
        activeSlot,
        playlistTracksCache,
        playlistName
      )

      if (trackInfo) {
        setScheduledTrackId(trackInfo.track.trackId)
        setCurrentTrackInfo(trackInfo)
        console.log('🎵 Scheduled track updated:', trackInfo.track.trackTitle)
      } else {
        setScheduledTrackId(null)
        setCurrentTrackInfo(null)
      }
    } catch (err) {
      console.error('❌ Failed to calculate scheduled track:', err)
      setScheduledTrackId(null)
      setCurrentTrackInfo(null)
    }
  }, [activeSlot, playlistTracksCache, playlistName])

  // Load schedule on mount
  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

  // Auto-refresh scheduled track calculation
  useEffect(() => {
    if (!autoRefresh) return

    updateScheduledTrack()
    const interval = setInterval(updateScheduledTrack, refreshInterval)
    
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, updateScheduledTrack])

  return {
    scheduleSlots,
    activeSlot,
    currentTrackInfo,
    scheduledTrackId,
    isLoading,
    error,
    reload: loadSchedule
  }
}
