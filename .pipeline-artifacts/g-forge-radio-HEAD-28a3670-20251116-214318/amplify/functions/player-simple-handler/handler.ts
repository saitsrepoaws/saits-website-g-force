/**
 * Player Simple Command Handler
 * 
 * Handles simple commands that don't require data fetching:
 * - PLAY
 * - PAUSE
 * - STOP
 * - UNLOAD
 * 
 * Just validates and passes through
 */

interface SimpleCommandEvent {
  command: string
  playerId: string
}

interface SimpleCommandResponse {
  success: boolean
  command: string
  playerId: string
  error?: string
}

export const handler = async (event: SimpleCommandEvent): Promise<SimpleCommandResponse> => {
  console.log('⚡ Simple Command Handler invoked:', JSON.stringify(event, null, 2))

  const { command, playerId } = event

  if (!command || !playerId) {
    console.error('❌ Missing command or playerId')
    return {
      success: false,
      command: command || 'UNKNOWN',
      playerId: playerId || 'UNKNOWN',
      error: 'Missing command or playerId parameter'
    }
  }

  // Validate command type
  const validCommands = ['PLAY', 'PAUSE', 'STOP', 'UNLOAD']
  if (!validCommands.includes(command)) {
    console.error('❌ Invalid command:', command)
    return {
      success: false,
      command,
      playerId,
      error: `Invalid command: ${command}`
    }
  }

  console.log(`✅ ${command} command validated for player: ${playerId}`)

  return {
    success: true,
    command,
    playerId
  }
}
