/**
 * Libery State Machine
 * Manages the state of a Libery IoT device with state transitions
 */

// Libery device states
export enum LiberyState {
  OFFLINE = 'OFFLINE',
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR',
}

// Events that can trigger state transitions
export enum LiberyEvent {
  CONNECT = 'CONNECT',
  DISCONNECT = 'DISCONNECT',
  LOAD_TRACK = 'LOAD_TRACK',
  PLAY = 'PLAY',
  PAUSE = 'PAUSE',
  STOP = 'STOP',
  ERROR = 'ERROR',
  TRACK_ENDED = 'TRACK_ENDED',
}

// State machine context (data that persists across states)
export interface LiberyContext {
  deviceId: string
  currentTrackId?: string
  currentTrackTitle?: string
  position: number // playback position in seconds
  volume: number // 0-100
  playlist?: string[]
  playlistIndex: number
  lastError?: string
  lastUpdated: number
}

// State transition definition
interface StateTransition {
  from: LiberyState
  event: LiberyEvent
  to: LiberyState
  guard?: (context: LiberyContext) => boolean
  action?: (context: LiberyContext) => Partial<LiberyContext>
}

// Define all valid state transitions
const transitions: StateTransition[] = [
  // Connection transitions
  { from: LiberyState.OFFLINE, event: LiberyEvent.CONNECT, to: LiberyState.IDLE },
  { from: LiberyState.IDLE, event: LiberyEvent.DISCONNECT, to: LiberyState.OFFLINE },
  { from: LiberyState.PLAYING, event: LiberyEvent.DISCONNECT, to: LiberyState.OFFLINE },
  { from: LiberyState.PAUSED, event: LiberyEvent.DISCONNECT, to: LiberyState.OFFLINE },
  
  // Playback transitions
  { from: LiberyState.IDLE, event: LiberyEvent.LOAD_TRACK, to: LiberyState.LOADING },
  { from: LiberyState.LOADING, event: LiberyEvent.PLAY, to: LiberyState.PLAYING },
  { from: LiberyState.PLAYING, event: LiberyEvent.PAUSE, to: LiberyState.PAUSED },
  { from: LiberyState.PAUSED, event: LiberyEvent.PLAY, to: LiberyState.PLAYING },
  { from: LiberyState.PLAYING, event: LiberyEvent.STOP, to: LiberyState.IDLE },
  { from: LiberyState.PAUSED, event: LiberyEvent.STOP, to: LiberyState.IDLE },
  { from: LiberyState.PLAYING, event: LiberyEvent.TRACK_ENDED, to: LiberyState.IDLE },
  
  // Error transitions (can happen from any state)
  { from: LiberyState.IDLE, event: LiberyEvent.ERROR, to: LiberyState.ERROR },
  { from: LiberyState.LOADING, event: LiberyEvent.ERROR, to: LiberyState.ERROR },
  { from: LiberyState.PLAYING, event: LiberyEvent.ERROR, to: LiberyState.ERROR },
  { from: LiberyState.PAUSED, event: LiberyEvent.ERROR, to: LiberyState.ERROR },
  { from: LiberyState.ERROR, event: LiberyEvent.STOP, to: LiberyState.IDLE },
]

export class LiberyStateMachine {
  private state: LiberyState
  private context: LiberyContext
  private listeners: Set<(state: LiberyState, context: LiberyContext) => void> = new Set()

  constructor(deviceId: string, initialState: LiberyState = LiberyState.OFFLINE) {
    this.state = initialState
    this.context = {
      deviceId,
      position: 0,
      volume: 50,
      playlistIndex: 0,
      lastUpdated: Date.now(),
    }
  }

  /**
   * Get current state
   */
  getState(): LiberyState {
    return this.state
  }

  /**
   * Get current context
   */
  getContext(): Readonly<LiberyContext> {
    return { ...this.context }
  }

  /**
   * Send an event to trigger a state transition
   */
  send(event: LiberyEvent, payload?: Partial<LiberyContext>): boolean {
    const transition = transitions.find(
      (t) => t.from === this.state && t.event === event
    )

    if (!transition) {
      console.warn(`No transition found for ${this.state} + ${event}`)
      return false
    }

    // Check guard condition if exists
    if (transition.guard && !transition.guard(this.context)) {
      console.warn(`Guard condition failed for ${this.state} + ${event}`)
      return false
    }

    // Execute action if exists
    if (transition.action) {
      const updates = transition.action(this.context)
      this.context = { ...this.context, ...updates }
    }

    // Apply payload updates
    if (payload) {
      this.context = { ...this.context, ...payload }
    }

    // Update timestamp
    this.context.lastUpdated = Date.now()

    // Transition to new state
    const previousState = this.state
    this.state = transition.to

    console.log(`[LiberyStateMachine] ${previousState} --[${event}]--> ${this.state}`)

    // Notify listeners
    this.notifyListeners()

    return true
  }

  /**
   * Update context without changing state
   */
  updateContext(updates: Partial<LiberyContext>): void {
    this.context = { ...this.context, ...updates, lastUpdated: Date.now() }
    this.notifyListeners()
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: LiberyState, context: LiberyContext) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Notify all listeners of state/context changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener(this.state, this.context)
    })
  }

  /**
   * Check if a transition is valid from current state
   */
  canTransition(event: LiberyEvent): boolean {
    return transitions.some((t) => t.from === this.state && t.event === event)
  }

  /**
   * Get all possible events from current state
   */
  getPossibleEvents(): LiberyEvent[] {
    return transitions
      .filter((t) => t.from === this.state)
      .map((t) => t.event)
  }

  /**
   * Serialize state machine to JSON (for IoT messages)
   */
  toJSON() {
    return {
      state: this.state,
      context: this.context,
    }
  }

  /**
   * Restore state machine from JSON (from IoT messages)
   */
  static fromJSON(json: { state: LiberyState; context: LiberyContext }): LiberyStateMachine {
    const machine = new LiberyStateMachine(json.context.deviceId, json.state)
    machine.context = json.context
    return machine
  }
}

/**
 * Helper to create IoT command messages
 */
export function createLiberyCommand(
  deviceId: string,
  event: LiberyEvent,
  payload?: Record<string, unknown>
) {
  return {
    deviceId,
    event,
    payload,
    timestamp: Date.now(),
  }
}

/**
 * Helper to parse IoT state messages
 */
export function parseLiberyState(message: unknown): {
  state: LiberyState
  context: LiberyContext
} | null {
  try {
    const data = message as { state: LiberyState; context: LiberyContext }
    if (data.state && data.context) {
      return data
    }
    return null
  } catch {
    return null
  }
}
