/**
 * Schedule Playlist Component
 * 
 * Shows the currently active playlist from the schedule
 */

import PlaylistViewer from '../PlaylistViewer'
import type { ScheduleSlot } from '../../utils/scheduleCalculator'
import type { Playlist } from '../../types/playlist'

interface SchedulePlaylistProps {
  activeSlot: ScheduleSlot
  playlists: Playlist[]
}

export default function SchedulePlaylist({ activeSlot, playlists }: SchedulePlaylistProps) {
  if (!activeSlot.playlistId) return null

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-lg overflow-hidden border border-purple-200">
      <div className="p-6 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <span className="text-3xl">📻</span>
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Now Playing Schedule</h3>
              <p className="text-white/80 text-sm">{activeSlot.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-sm font-bold text-gray-800 shadow-lg">
              ⏰ {activeSlot.time}
            </div>
            <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-sm font-bold text-white shadow-lg border border-white/30">
              ⏱️ {activeSlot.duration}m
            </div>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 mt-3">
          <div className="text-lg font-bold text-white mb-1">
            {playlists.find(p => p.id === activeSlot.playlistId)?.name || 'Loading...'}
          </div>
          <div className="flex items-center gap-3 text-sm text-white/90">
            <span className="flex items-center gap-1">
              <span className="text-green-300">▶️</span>
              Auto-loaded from schedule
            </span>
            <span className="text-white/50">•</span>
            <span className="flex items-center gap-1">
              🎧 Click track to preview
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white">
        <PlaylistViewer
          playlistId={activeSlot.playlistId}
          compact={true}
          maxHeight="400px"
          showHeader={false}
          showDragHandle={false}
          allowReorder={false}
          allowRemove={false}
          allowPlay={true}
          containerClassName=""
        />
      </div>
    </div>
  )
}
