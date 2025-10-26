/**
 * Schedule Calculator
 * 
 * Berekent welke track NU zou moeten spelen op basis van:
 * - Huidige tijd
 * - Actieve playlist in schedule
 * - Track durations
 */

export interface ScheduleSlot {
  id: string
  time: string // "06:00"
  name: string
  playlistId: string | null
  days: string[]
  duration: number // minutes
  active: boolean
}

export interface PlaylistTrack {
  trackId: string
  trackTitle?: string
  trackArtist?: string
  trackDuration?: number // seconds
  order: number
}

export interface CurrentTrackInfo {
  track: PlaylistTrack
  trackIndex: number
  playlistName: string
  slotName: string
  slotStartTime: string
  trackStartTime: string // HH:MM:SS
  trackEndTime: string // HH:MM:SS
  elapsedInTrack: number // seconds
  remainingInTrack: number // seconds
  percentComplete: number // 0-100
}

/**
 * Vind de actieve time slot voor de huidige tijd
 */
export function findActiveSlot(
  slots: ScheduleSlot[],
  currentTime: Date = new Date()
): ScheduleSlot | null {
  const currentHour = currentTime.getHours()
  const currentMinute = currentTime.getMinutes()
  const currentTimeMinutes = currentHour * 60 + currentMinute
  
  // Sorteer slots op tijd
  const sortedSlots = [...slots]
    .filter(slot => slot.active && slot.playlistId)
    .sort((a, b) => {
      const [aHour, aMin] = a.time.split(':').map(Number)
      const [bHour, bMin] = b.time.split(':').map(Number)
      return (aHour * 60 + aMin) - (bHour * 60 + bMin)
    })
  
  // Vind de slot die nu actief is
  for (let i = sortedSlots.length - 1; i >= 0; i--) {
    const slot = sortedSlots[i]
    const [slotHour, slotMin] = slot.time.split(':').map(Number)
    const slotStartMinutes = slotHour * 60 + slotMin
    
    if (currentTimeMinutes >= slotStartMinutes) {
      // Check of we binnen de duration zijn
      const slotEndMinutes = slotStartMinutes + slot.duration
      if (currentTimeMinutes < slotEndMinutes) {
        return slot
      }
    }
  }
  
  return null
}

/**
 * Bereken welke track NU zou moeten spelen
 */
export function calculateCurrentTrack(
  slot: ScheduleSlot,
  tracks: PlaylistTrack[],
  playlistName: string,
  currentTime: Date = new Date()
): CurrentTrackInfo | null {
  if (!tracks || tracks.length === 0) {
    return null
  }
  
  // Sorteer tracks op order
  const sortedTracks = [...tracks].sort((a, b) => a.order - b.order)
  
  // Bereken hoeveel seconden we in de slot zitten
  const [slotHour, slotMin] = slot.time.split(':').map(Number)
  const slotStartTime = new Date(currentTime)
  slotStartTime.setHours(slotHour, slotMin, 0, 0)
  
  const secondsIntoSlot = Math.floor((currentTime.getTime() - slotStartTime.getTime()) / 1000)
  
  // Loop door tracks en tel durations op
  let accumulatedSeconds = 0
  
  for (let i = 0; i < sortedTracks.length; i++) {
    const track = sortedTracks[i]
    const trackDuration = track.trackDuration || 180 // Default 3 min
    
    // Check of we in deze track zitten
    if (secondsIntoSlot >= accumulatedSeconds && secondsIntoSlot < accumulatedSeconds + trackDuration) {
      const elapsedInTrack = secondsIntoSlot - accumulatedSeconds
      const remainingInTrack = trackDuration - elapsedInTrack
      
      // Bereken start en end tijd van deze track
      const trackStartSeconds = accumulatedSeconds
      const trackEndSeconds = accumulatedSeconds + trackDuration
      
      const trackStartTime = new Date(slotStartTime.getTime() + trackStartSeconds * 1000)
      const trackEndTime = new Date(slotStartTime.getTime() + trackEndSeconds * 1000)
      
      return {
        track,
        trackIndex: i,
        playlistName,
        slotName: slot.name,
        slotStartTime: slot.time,
        trackStartTime: formatTime(trackStartTime),
        trackEndTime: formatTime(trackEndTime),
        elapsedInTrack,
        remainingInTrack,
        percentComplete: Math.round((elapsedInTrack / trackDuration) * 100)
      }
    }
    
    accumulatedSeconds += trackDuration
  }
  
  // Als we hier komen, zijn we voorbij alle tracks
  // Return de laatste track
  const lastTrack = sortedTracks[sortedTracks.length - 1]
  return {
    track: lastTrack,
    trackIndex: sortedTracks.length - 1,
    playlistName,
    slotName: slot.name,
    slotStartTime: slot.time,
    trackStartTime: '--:--:--',
    trackEndTime: '--:--:--',
    elapsedInTrack: 0,
    remainingInTrack: 0,
    percentComplete: 100
  }
}

/**
 * Format tijd als HH:MM:SS
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

/**
 * Format seconden als MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}
