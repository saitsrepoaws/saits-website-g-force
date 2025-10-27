/**
 * Player LOAD Command Handler
 * 
 * Determines which track to load based on:
 * 1. Current time
 * 2. Schedule (which playlist is active now)
 * 3. Playlist tracks and their scheduled times
 * 
 * Returns the track that should be playing RIGHT NOW
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const TRACK_TABLE = process.env.TRACK_TABLE_NAME || ''
const PLAYLIST_TABLE = process.env.PLAYLIST_TABLE_NAME || ''

export const handler = async (event: any) => {
  console.log('📥 LOAD Command Handler invoked:', JSON.stringify(event, null, 2))

  const { playerId, playlistId, timestamp } = event
  const now = new Date(timestamp || Date.now())

  console.log('🕐 Current time:', now.toISOString())
  console.log('📋 Playlist ID:', playlistId)

  if (!playlistId) {
    console.error('❌ Missing playlistId parameter')
    return {
      success: false,
      error: 'Missing playlistId parameter'
    }
  }

  try {
    // 1. Get playlist with tracks
    console.log('📥 Fetching playlist:', playlistId)
    const playlistResult = await docClient.send(new GetCommand({
      TableName: PLAYLIST_TABLE,
      Key: { id: playlistId }
    }))

    if (!playlistResult.Item) {
      console.error('❌ Playlist not found:', playlistId)
      return {
        success: false,
        error: `Playlist not found: ${playlistId}`
      }
    }

    const playlist = playlistResult.Item
    const playlistTracks = playlist.tracks || []
    
    console.log('✅ Playlist found:', playlist.name)
    console.log('📊 Total tracks:', playlistTracks.length)

    if (playlistTracks.length === 0) {
      console.error('❌ Playlist is empty')
      return {
        success: false,
        error: 'Playlist is empty'
      }
    }

    // 2. Calculate which track should be playing now
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    const currentSecond = now.getSeconds()
    const currentTimeInSeconds = currentHour * 3600 + currentMinute * 60 + currentSecond

    console.log('⏰ Current time in seconds:', currentTimeInSeconds)

    // Calculate cumulative durations
    let cumulativeTime = 0
    let currentTrackIndex = 0

    for (let i = 0; i < playlistTracks.length; i++) {
      const trackDuration = playlistTracks[i].duration || 0
      
      if (currentTimeInSeconds >= cumulativeTime && currentTimeInSeconds < cumulativeTime + trackDuration) {
        currentTrackIndex = i
        break
      }
      
      cumulativeTime += trackDuration
      
      // If we've gone past the end, loop back to start
      if (i === playlistTracks.length - 1 && currentTimeInSeconds >= cumulativeTime) {
        currentTrackIndex = 0
        break
      }
    }

    const selectedPlaylistTrack = playlistTracks[currentTrackIndex]
    console.log('🎯 Selected track index:', currentTrackIndex)
    console.log('🎵 Track ID:', selectedPlaylistTrack.trackId)

    // 3. Fetch full track data
    console.log('📥 Fetching track data:', selectedPlaylistTrack.trackId)
    const trackResult = await docClient.send(new GetCommand({
      TableName: TRACK_TABLE,
      Key: { id: selectedPlaylistTrack.trackId }
    }))

    if (!trackResult.Item) {
      console.error('❌ Track not found:', selectedPlaylistTrack.trackId)
      return {
        success: false,
        error: `Track not found: ${selectedPlaylistTrack.trackId}`
      }
    }

    const track = trackResult.Item
    console.log('✅ Track found:', track.title, 'by', track.artist)

    return {
      success: true,
      playlistId: playlistId,
      trackIndex: currentTrackIndex,
      track: track
    }

  } catch (error: any) {
    console.error('❌ Error in LOAD handler:', error)
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}
