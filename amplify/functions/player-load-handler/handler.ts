/**
 * Player LOAD Command Handler
 * 
 * TEMPORARY: Returns mock track data
 * TODO: Implement DynamoDB queries once bundling is fixed
 */

export const handler = async (event: any) => {
  console.log('📥 LOAD Command Handler invoked:', JSON.stringify(event, null, 2))

  const { playerId, playlistId, timestamp } = event

  console.log('🕐 Timestamp:', timestamp)
  console.log('📋 Playlist ID:', playlistId)
  console.log('🎯 Player ID:', playerId)

  // MOCK: Return test track
  const mockTrack = {
    id: 'mock-track-001',
    title: 'Test Track',
    artist: 'Test Artist',
    album: 'Test Album',
    fileUrl: 'audio/tracks/test.mp3',
    coverArtUrl: null,
    waveformUrl: null,
    duration: 180,
    bpm: 128,
    key: 'Am',
    energy: 0.8,
    genre: 'Techno',
    year: 2024,
    label: 'Test Label'
  }

  console.log('✅ Returning mock track:', mockTrack.title)

  return {
    success: true,
    playlistId: playlistId,
    trackIndex: 0,
    track: mockTrack
  }
}
