import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import PlaylistViewer from '../../components/PlaylistViewer'
import { listPlaylists } from '../../services/playlists'
import type { Playlist } from '../../types/playlist'

interface TimeSlot {
  id: string
  time: string
  name: string
  playlistId: string | null
  days: string[]
  duration: number // minutes
  active: boolean
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function Planner() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([
    { id: '1', time: '06:00', name: 'Morning Show', playlistId: null, days: ['MON', 'TUE', 'WED', 'THU', 'FRI'], duration: 180, active: true },
    { id: '2', time: '09:00', name: 'Midday Mix', playlistId: null, days: ['MON', 'TUE', 'WED', 'THU', 'FRI'], duration: 180, active: true },
    { id: '3', time: '12:00', name: 'Lunch Hour', playlistId: null, days: ['MON', 'TUE', 'WED', 'THU', 'FRI'], duration: 60, active: true },
    { id: '4', time: '15:00', name: 'Afternoon Drive', playlistId: null, days: ['MON', 'TUE', 'WED', 'THU', 'FRI'], duration: 180, active: true },
    { id: '5', time: '18:00', name: 'Evening Session', playlistId: null, days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], duration: 180, active: true },
    { id: '6', time: '21:00', name: 'Night Vibes', playlistId: null, days: ['FRI', 'SAT'], duration: 240, active: true },
  ])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [showAddSlot, setShowAddSlot] = useState(false)
  const [currentDay, setCurrentDay] = useState<string>('MON')

  useEffect(() => {
    loadPlaylists()
  }, [])

  async function loadPlaylists() {
    try {
      const { data } = await listPlaylists()
      if (data) {
        setPlaylists(data)
      }
    } catch (error) {
      console.error('Failed to load playlists:', error)
    }
  }

  function handleSlotClick(slot: TimeSlot) {
    setSelectedSlot(selectedSlot?.id === slot.id ? null : slot)
  }

  function handlePlaylistSelect(slotId: string, playlistId: string) {
    setTimeSlots(slots => slots.map(slot => 
      slot.id === slotId ? { ...slot, playlistId } : slot
    ))
  }

  function toggleDay(slotId: string, day: string) {
    setTimeSlots(slots => slots.map(slot => {
      if (slot.id === slotId) {
        const days = slot.days.includes(day)
          ? slot.days.filter(d => d !== day)
          : [...slot.days, day]
        return { ...slot, days }
      }
      return slot
    }))
  }

  function toggleSlotActive(slotId: string) {
    setTimeSlots(slots => slots.map(slot =>
      slot.id === slotId ? { ...slot, active: !slot.active } : slot
    ))
  }

  function addNewSlot() {
    const newSlot: TimeSlot = {
      id: Date.now().toString(),
      time: '00:00',
      name: 'New Slot',
      playlistId: null,
      days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      duration: 60,
      active: true
    }
    setTimeSlots([...timeSlots, newSlot])
    setShowAddSlot(false)
  }

  function deleteSlot(slotId: string) {
    if (confirm('Remove this time slot?')) {
      setTimeSlots(slots => slots.filter(s => s.id !== slotId))
      if (selectedSlot?.id === slotId) {
        setSelectedSlot(null)
      }
    }
  }

  const filteredSlots = timeSlots
    .filter(slot => slot.days.includes(currentDay))
    .sort((a, b) => a.time.localeCompare(b.time))

  return (
    <Layout title="Radio Planner" showBackButton backTo="/devices">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">📻 Radio Schedule Planner</h2>
            <p className="text-sm text-gray-600 mt-1">
              Plan your broadcast schedule with playlists
            </p>
          </div>
          <button
            onClick={() => setShowAddSlot(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Time Slot
          </button>
        </div>

        {/* Day Selector */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2">View Day:</span>
            {DAYS.map(day => (
              <button
                key={day}
                onClick={() => setCurrentDay(day)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentDay === day
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {day}
              </button>
            ))}
            <button
              onClick={() => setCurrentDay('ALL')}
              className={`ml-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                currentDay === 'ALL'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ALL DAYS
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Schedule Overview */}
          <div className="col-span-2 space-y-3">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-bold text-gray-900">
                  {currentDay === 'ALL' ? 'Complete Schedule' : `${currentDay} Schedule`}
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  {currentDay === 'ALL' 
                    ? `${timeSlots.length} total time slots` 
                    : `${filteredSlots.length} time slots for ${currentDay}`
                  }
                </p>
              </div>
              
              <div className="p-4 space-y-2 max-h-[600px] overflow-auto">
                {(currentDay === 'ALL' ? timeSlots : filteredSlots).map(slot => {
                  const playlist = playlists.find(p => p.id === slot.playlistId)
                  const isSelected = selectedSlot?.id === slot.id
                  
                  return (
                    <div
                      key={slot.id}
                      className={`border rounded-lg p-4 transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50 shadow-md' 
                          : slot.active
                          ? 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                          : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                      onClick={() => handleSlotClick(slot)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          {/* Time */}
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{slot.time}</div>
                            <div className="text-xs text-gray-600">{slot.duration}m</div>
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{slot.name}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              {playlist ? (
                                <span className="text-blue-600">🎵 {playlist.name}</span>
                              ) : (
                                <span className="text-orange-600">⚠️ No playlist assigned</span>
                              )}
                            </div>
                            
                            {/* Days */}
                            <div className="flex gap-1 mt-2">
                              {DAYS.map(day => (
                                <button
                                  key={day}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleDay(slot.id, day)
                                  }}
                                  className={`text-xs px-2 py-1 rounded ${
                                    slot.days.includes(day)
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-200 text-gray-600'
                                  }`}
                                >
                                  {day.substring(0, 1)}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Status */}
                          <div className="text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleSlotActive(slot.id)
                              }}
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                slot.active
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              {slot.active ? '✓ Active' : '○ Inactive'}
                            </button>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteSlot(slot.id)
                            }}
                            className="text-red-600 hover:bg-red-50 p-2 rounded"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                
                {(currentDay === 'ALL' ? timeSlots : filteredSlots).length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p>No time slots for {currentDay}</p>
                    <button
                      onClick={() => setShowAddSlot(true)}
                      className="mt-4 text-blue-600 hover:text-blue-700"
                    >
                      + Add Time Slot
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Playlist Selector & Preview */}
          <div className="col-span-1 space-y-4">
            {selectedSlot ? (
              <>
                {/* Playlist Selector */}
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-bold text-gray-900 mb-3">Assign Playlist</h3>
                  <div className="text-sm text-gray-600 mb-3">
                    for {selectedSlot.time} - {selectedSlot.name}
                  </div>
                  
                  <select
                    value={selectedSlot.playlistId || ''}
                    onChange={(e) => handlePlaylistSelect(selectedSlot.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select playlist...</option>
                    {playlists.map(playlist => (
                      <option key={playlist.id} value={playlist.id}>
                        {playlist.name}
                      </option>
                    ))}
                  </select>
                  
                  {playlists.length === 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                      No playlists available. Create one first!
                    </p>
                  )}
                </div>

                {/* Playlist Preview */}
                {selectedSlot.playlistId && (
                  <div className="bg-white rounded-lg shadow">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="font-bold text-gray-900">Playlist Preview</h3>
                    </div>
                    <PlaylistViewer
                      playlistId={selectedSlot.playlistId}
                      compact={true}
                      maxHeight="400px"
                      showHeader={false}
                      showDragHandle={false}
                      allowReorder={false}
                      allowRemove={false}
                      containerClassName=""
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center text-gray-500">
                  <p className="text-4xl mb-3">👈</p>
                  <p className="font-medium">Select a time slot</p>
                  <p className="text-sm mt-1">to assign a playlist</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Slots</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{timeSlots.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Active</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {timeSlots.filter(s => s.active).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">With Playlist</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {timeSlots.filter(s => s.playlistId).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Needs Setup</div>
            <div className="text-2xl font-bold text-orange-600 mt-1">
              {timeSlots.filter(s => !s.playlistId && s.active).length}
            </div>
          </div>
        </div>

        {/* Add Slot Modal */}
        {showAddSlot && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Add Time Slot</h3>
              <p className="text-sm text-gray-600 mb-4">
                Create a new scheduled time slot
              </p>
              <div className="flex gap-3">
                <button
                  onClick={addNewSlot}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Slot
                </button>
                <button
                  onClick={() => setShowAddSlot(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Planner
