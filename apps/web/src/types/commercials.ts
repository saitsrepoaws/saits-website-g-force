/**
 * Commercial track types and categories
 * Preparation for ad block scheduling in planner
 */

export type TrackType = 'music' | 'jingle' | 'commercial'

export type CommercialCategory = 
  | 'Product'        // Product advertisements
  | 'Service'        // Service advertisements
  | 'PSA'            // Public Service Announcements
  | 'Promotion'      // Station promotions / events
  | 'Sponsorship'    // Sponsor messages
  | 'Contest'        // Contest announcements
  | 'Event'          // Event announcements
  | 'Other'          // Other commercial content

export type JingleCategory =
  | 'Station ID'     // Station identification
  | 'Sweeper'        // Short audio sweepers
  | 'Promo'          // Station promos
  | 'Time Check'     // Time announcements
  | 'Weather'        // Weather updates
  | 'Contest'        // Contest jingles
  | 'DJ Drop'        // DJ name drops
  | 'Other'          // Other jingles

export interface CommercialTrack {
  id: string
  title: string
  artist?: string
  duration: number
  trackType: 'commercial'
  commercialCategory: CommercialCategory
  tags?: string
  fileUrl: string
  fileSize?: number
  format?: string
  addedAt: string
}

export interface JingleTrack {
  id: string
  title: string
  artist?: string
  duration: number
  trackType: 'jingle'
  jingleCategory: JingleCategory
  tags?: string
  fileUrl: string
  fileSize?: number
  format?: string
  addedAt: string
}

export interface MusicTrack {
  id: string
  title: string
  artist?: string
  version?: string
  label?: string
  genre?: string
  duration: number
  trackType: 'music'
  tags?: string
  fileUrl: string
  fileSize?: number
  format?: string
  addedAt: string
  bpm?: number
  key?: string
  energy?: number
}

// Union type for all track types
export type Track = MusicTrack | JingleTrack | CommercialTrack

// Upload item for commercial tracks
export interface CommercialUploadItem {
  file: File
  title: string
  duration: number
  commercialCategory: CommercialCategory
  tags: string
  progress: number | null
  status: 'pending' | 'uploading' | 'success' | 'error' | 'skipped'
  error?: string
}

// Commercial block configuration (for future planner)
export interface CommercialBlock {
  id: string
  name: string
  duration: number // Total duration in seconds
  trackIds: string[] // IDs of commercial tracks in this block
  category?: CommercialCategory
  tags?: string
  createdAt: string
  updatedAt: string
}

// Commercial scheduling (for future planner integration)
export interface CommercialSchedule {
  id: string
  blockId: string // Reference to CommercialBlock
  playlistId?: string // Optional: link to specific playlist
  scheduleSlotId?: string // Optional: link to time slot
  frequency: 'hourly' | 'every_n_tracks' | 'manual'
  frequencyValue?: number // e.g., every 5 tracks
  enabled: boolean
  createdAt: string
  updatedAt: string
}

// Constants for UI
export const COMMERCIAL_CATEGORIES: CommercialCategory[] = [
  'Product',
  'Service',
  'PSA',
  'Promotion',
  'Sponsorship',
  'Contest',
  'Event',
  'Other',
]

export const JINGLE_CATEGORIES: JingleCategory[] = [
  'Station ID',
  'Sweeper',
  'Promo',
  'Time Check',
  'Weather',
  'Contest',
  'DJ Drop',
  'Other',
]

// Helper functions
export function isCommercial(track: Track): track is CommercialTrack {
  return track.trackType === 'commercial'
}

export function isJingle(track: Track): track is JingleTrack {
  return track.trackType === 'jingle'
}

export function isMusic(track: Track): track is MusicTrack {
  return track.trackType === 'music'
}

// Auto-detect track type from filename
export function detectTrackType(filename: string): TrackType {
  const lower = filename.toLowerCase()
  
  if (
    lower.includes('commercial') ||
    lower.includes('spot') ||
    lower.includes('ad_') ||
    lower.includes('_ad') ||
    lower.includes('reclame')
  ) {
    return 'commercial'
  }
  
  if (
    lower.includes('jingle') ||
    lower.includes('id_') ||
    lower.includes('_id') ||
    lower.includes('sweeper') ||
    lower.includes('promo')
  ) {
    return 'jingle'
  }
  
  return 'music'
}

// Auto-detect commercial category from filename/tags
export function detectCommercialCategory(filename: string, tags?: string): CommercialCategory {
  const text = `${filename} ${tags || ''}`.toLowerCase()
  
  if (text.includes('psa') || text.includes('public service')) return 'PSA'
  if (text.includes('sponsor')) return 'Sponsorship'
  if (text.includes('contest') || text.includes('wedstrijd')) return 'Contest'
  if (text.includes('event') || text.includes('evenement')) return 'Event'
  if (text.includes('promo') || text.includes('promotion')) return 'Promotion'
  if (text.includes('service') || text.includes('dienst')) return 'Service'
  if (text.includes('product')) return 'Product'
  
  return 'Other'
}

// Auto-detect jingle category from filename/tags
export function detectJingleCategory(filename: string, tags?: string): JingleCategory {
  const text = `${filename} ${tags || ''}`.toLowerCase()
  
  if (text.includes('station') || text.includes('id')) return 'Station ID'
  if (text.includes('sweeper')) return 'Sweeper'
  if (text.includes('promo')) return 'Promo'
  if (text.includes('time') || text.includes('tijd')) return 'Time Check'
  if (text.includes('weather') || text.includes('weer')) return 'Weather'
  if (text.includes('contest') || text.includes('wedstrijd')) return 'Contest'
  if (text.includes('dj') || text.includes('drop')) return 'DJ Drop'
  
  return 'Station ID' // Default for jingles
}
