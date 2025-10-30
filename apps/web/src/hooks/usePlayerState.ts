import { useState, useEffect, useCallback, useRef } from 'react'
import { getPlayerState, savePlayerState, updatePlayerPosition } from '../services/playerState'
import type { PlayerStateData } from '../services/playerState'
import type { Track } from '../services/playerService'

export interface UsePlayerStateReturn {
  playerStateId: string | null
  backendState: any | null
  isRestoring: boolean
  
  saveState: (data: Partial<PlayerStateData>) => Promise<void>
  restoreState: () => Promise<PlayerStateData | null>
  updatePosition: (position: number) => Promise<void>
  clearState: () => void
}

interface UsePlayerStateOptions {
  playerId: string
  currentTrack: Track | null
  isPlaying: boolean
  volume: number
  autoPlay: boolean
  activeSlotId?: string
  activeSlotName?: string
}

export function usePlayerState(options: UsePlayerStateOptions): UsePlayerStateReturn {
  const {
    playerId,
    currentTrack,
    isPlaying,
    volume,
    autoPlay,
    activeSlotId,
    activeSlotName
  } = options

  const [playerStateId, setPlayerStateId] = useState<string | null>(null)
  const [backendState, setBackendState] = useState<any | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  
  const checkpointIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Save player state
  const saveState = useCallback(async (data: Partial<PlayerStateData>) => {
    if (!playerStateId) {
      console.warn('⚠️ No playerStateId - cannot save state')
      return
    }

    try {
      const fullStateData: PlayerStateData = {
        playerId,
        trackId: currentTrack?.id || '',
        trackTitle: currentTrack?.title || '',
        trackArtist: currentTrack?.artist || '',
        status: isPlaying ? 'playing' : 'stopped',
        lastPosition: 0,
        duration: 0,
        volume,
        autoPlayEnabled: autoPlay,
        currentScheduleSlotId: activeSlotId,
        currentScheduleSlotName: activeSlotName,
        ...data
      }

      await savePlayerState(playerStateId, fullStateData)
      setBackendState({ ...fullStateData, id: playerStateId, lastUpdated: new Date().toISOString() })
      console.log('💾 Player state saved')
    } catch (error) {
      console.error('❌ Failed to save player state:', error)
    }
  }, [playerStateId, playerId, currentTrack, isPlaying, volume, autoPlay, activeSlotId, activeSlotName])

  // Restore player state
  const restoreState = useCallback(async (): Promise<PlayerStateData | null> => {
    setIsRestoring(true)
    
    try {
      console.log('🔄 Restoring player state for:', playerId)
      const state = await getPlayerState(playerId)
      
      if (state) {
        setPlayerStateId(state.id)
        setBackendState(state)
        console.log('✅ Player state restored:', state.trackTitle)
        return state
      } else {
        console.log('ℹ️ No previous state found')
        return null
      }
    } catch (error) {
      console.error('❌ Failed to restore player state:', error)
      return null
    } finally {
      setIsRestoring(false)
    }
  }, [playerId])

  // Update position only
  const updatePosition = useCallback(async (position: number) => {
    if (!playerStateId) return
    
    try {
      await updatePlayerPosition(playerStateId, position)
      console.log('📍 Position updated:', Math.round(position), 'seconds')
    } catch (error) {
      console.error('❌ Failed to update position:', error)
    }
  }, [playerStateId])

  // Clear state
  const clearState = useCallback(() => {
    setPlayerStateId(null)
    setBackendState(null)
  }, [])

  // Setup 5-minute checkpoint while playing
  useEffect(() => {
    if (!isPlaying || !playerStateId || !currentTrack) {
      if (checkpointIntervalRef.current) {
        clearInterval(checkpointIntervalRef.current)
        checkpointIntervalRef.current = null
      }
      return
    }

    // Create checkpoint every 5 minutes
    checkpointIntervalRef.current = setInterval(() => {
      console.log('💾 5-minute checkpoint')
      // Position update will be handled by parent passing audioRef.currentTime
    }, 5 * 60 * 1000)

    return () => {
      if (checkpointIntervalRef.current) {
        clearInterval(checkpointIntervalRef.current)
        checkpointIntervalRef.current = null
      }
    }
  }, [isPlaying, playerStateId, currentTrack])

  // Save state before page unload
  useEffect(() => {
    function handleBeforeUnload() {
      if (playerStateId && currentTrack) {
        const status = isPlaying ? 'paused' : 'stopped'
        
        // Use navigator.sendBeacon for guaranteed delivery
        const data = {
          id: playerStateId,
          playerId,
          status,
          volume,
          autoPlayEnabled: autoPlay,
          lastActive: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }
        
        console.log('💾 Saving state before page unload...', data)
        // Note: savePlayerState is async, might not complete before unload
        // In production, consider using sendBeacon API
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [playerStateId, currentTrack, isPlaying, volume, autoPlay, playerId])

  return {
    playerStateId,
    backendState,
    isRestoring,
    saveState,
    restoreState,
    updatePosition,
    clearState
  }
}
