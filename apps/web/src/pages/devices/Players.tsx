import Layout from '../../components/Layout'
import PlayerCard from '../../components/PlayerCard'
import { useTabTitle } from '../../hooks/useTabTitle'

/**
 * Players Component - Multi-Player View
 * 
 * Displays multiple player cards in a 2-column grid layout
 * Each PlayerCard manages its own state and IoT subscription independently
 */
export default function Players() {
  useTabTitle('Players', '🎵')
  
  return (
    <Layout title="Players" showBackButton backTo="/devices">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
        {/* Player 1 */}
        <PlayerCard 
          playerId="player-001" 
          playerName="🎵 Player 1"
        />
        
        {/* Player 2 */}
        <PlayerCard 
          playerId="player-002" 
          playerName="🎵 Player 2"
        />
      </div>
    </Layout>
  )
}
