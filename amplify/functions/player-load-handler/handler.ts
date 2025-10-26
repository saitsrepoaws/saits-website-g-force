/**
 * Player LOAD Command Handler
 * 
 * TEMPORARY MOCK - Returns hardcoded track data
 * TODO: Implement real data fetching once bundling issues are resolved
 */

export const handler = async (event: any) => {
  console.log('📥 LOAD Command Handler (MOCK) invoked:', JSON.stringify(event, null, 2))

  const { playerId, playlistId } = event

  if (!playlistId) {
    return {
      success: false,
      error: 'Missing playlistId parameter'
    }
  }

  // MOCK: Return hardcoded track data
  console.log('🎵 Returning MOCK track data')
  
  return {
    success: true,
    playlistId: playlistId,
    track: {
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
  }
}
