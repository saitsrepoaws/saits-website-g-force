/**
 * React hook for managing Libery device state via IoT
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { publish, subscribe } from '../services/pubsub'
import {
  LiberyStateMachine,
  LiberyState,
  LiberyEvent,
  type LiberyContext,
  createLiberyCommand,
  parseLiberyState,
} from '../services/liberyStateMachine'

interface UseLiberyDeviceOptions {
  deviceId: string
  autoConnect?: boolean
}

export function useLiberyDevice({ deviceId, autoConnect = true }: UseLiberyDeviceOptions) {
  const [state, setState] = useState<LiberyState>(LiberyState.OFFLINE)
  const [context, setContext] = useState<LiberyContext | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const machineRef = useRef<LiberyStateMachine | null>(null)

  // Topics for this device
  const commandTopic = `gforce/libery/${deviceId}/command`
  const stateTopic = `gforce/libery/${deviceId}/state`

  // Initialize state machine
  useEffect(() => {
    if (!machineRef.current) {
      machineRef.current = new LiberyStateMachine(deviceId)
      
      // Subscribe to state changes
      const unsubscribe = machineRef.current.subscribe((newState, newContext) => {
        setState(newState)
        setContext(newContext)
      })

      // Initialize state
      setState(machineRef.current.getState())
      setContext(machineRef.current.getContext())

      return unsubscribe
    }
  }, [deviceId])

  // Subscribe to device state updates via IoT
  useEffect(() => {
    if (!isConnected) return

    const subscription = subscribe(
      { topic: stateTopic },
      (message) => {
        console.log('[useLiberyDevice] Received state update:', message)
        
        const stateData = parseLiberyState((message as any)?.value || message)
        if (stateData && machineRef.current) {
          // Update machine from remote state
          machineRef.current = LiberyStateMachine.fromJSON(stateData)
          setState(stateData.state)
          setContext(stateData.context)
        }
      },
      (error) => {
        console.error('[useLiberyDevice] Subscription error:', error)
      }
    )

    return () => {
      subscription.then((sub) => sub?.unsubscribe())
    }
  }, [isConnected, stateTopic])

  /**
   * Connect to device
   */
  const connect = useCallback(async () => {
    if (!machineRef.current) return false

    const success = machineRef.current.send(LiberyEvent.CONNECT)
    if (success) {
      setIsConnected(true)
      
      // Publish initial state
      await publish({
        topic: stateTopic,
        message: machineRef.current.toJSON(),
      })
    }
    return success
  }, [stateTopic])

  /**
   * Disconnect from device
   */
  const disconnect = useCallback(async () => {
    if (!machineRef.current) return false

    const success = machineRef.current.send(LiberyEvent.DISCONNECT)
    if (success) {
      setIsConnected(false)
    }
    return success
  }, [])

  /**
   * Send command to device
   */
  const sendCommand = useCallback(
    async (event: LiberyEvent, payload?: Partial<LiberyContext>) => {
      if (!machineRef.current || !isConnected) {
        console.warn('[useLiberyDevice] Cannot send command: not connected')
        return false
      }

      // Update local state machine
      const success = machineRef.current.send(event, payload)
      
      if (success) {
        // Publish command to IoT
        const command = createLiberyCommand(deviceId, event, payload as Record<string, unknown>)
        await publish({
          topic: commandTopic,
          message: command,
        })

        // Publish updated state
        await publish({
          topic: stateTopic,
          message: machineRef.current.toJSON(),
        })
      }

      return success
    },
    [deviceId, commandTopic, stateTopic, isConnected]
  )

  /**
   * Convenience methods for common actions
   */
  const loadTrack = useCallback(
    (trackId: string, trackTitle: string) => {
      return sendCommand(LiberyEvent.LOAD_TRACK, {
        currentTrackId: trackId,
        currentTrackTitle: trackTitle,
        position: 0,
      })
    },
    [sendCommand]
  )

  const play = useCallback(() => {
    return sendCommand(LiberyEvent.PLAY)
  }, [sendCommand])

  const pause = useCallback(() => {
    return sendCommand(LiberyEvent.PAUSE)
  }, [sendCommand])

  const stop = useCallback(() => {
    return sendCommand(LiberyEvent.STOP, { position: 0 })
  }, [sendCommand])

  const setVolume = useCallback(
    (volume: number) => {
      if (!machineRef.current) return
      machineRef.current.updateContext({ volume })
      
      // Publish updated state
      publish({
        topic: stateTopic,
        message: machineRef.current.toJSON(),
      })
    },
    [stateTopic]
  )

  const setPosition = useCallback(
    (position: number) => {
      if (!machineRef.current) return
      machineRef.current.updateContext({ position })
    },
    []
  )

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect()
    }
  }, [autoConnect, connect])

  return {
    // State
    state,
    context,
    isConnected,
    
    // Actions
    connect,
    disconnect,
    sendCommand,
    
    // Playback controls
    loadTrack,
    play,
    pause,
    stop,
    setVolume,
    setPosition,
    
    // Helpers
    canTransition: (event: LiberyEvent) => machineRef.current?.canTransition(event) ?? false,
    getPossibleEvents: () => machineRef.current?.getPossibleEvents() ?? [],
  }
}
