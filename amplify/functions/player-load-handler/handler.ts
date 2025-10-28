/**
 * Player LOAD Command Handler
 * 
 * SIMPLIFIED VERSION: Returns hardcoded track for testing
 * TODO: Add GraphQL queries once IoT flow is verified working
 */

export const handler = async (event: any) => {
  console.log('📥 LOAD Command Handler invoked:', JSON.stringify(event, null, 2))

  const { playerId, timestamp } = event
  const now = new Date(timestamp || Date.now())

  console.log('🎯 Player:', playerId)
  console.log('⏰ Time:', now.toISOString())

  // HARDCODED track for testing - this proves the IoT flow works!
  const testTrack = {
    id: 'track-test-001',
    title: 'Test Track',
    artist: 'Test Artist',
    album: 'Test Album',
    fileUrl: 'https://example.com/test.mp3',
    coverArtUrl: 'https://example.com/cover.jpg',
    duration: 180,
    bpm: 128,
    genre: 'Techno',
    year: 2025
  }

  console.log('✅ Returning hardcoded test track:', testTrack.title)

  return {
    success: true,
    playlistId: 'test-playlist',
    trackIndex: 0,
    track: testTrack
  }
}
