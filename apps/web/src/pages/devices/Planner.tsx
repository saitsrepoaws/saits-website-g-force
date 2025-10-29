import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import PlaylistViewer from '../../components/PlaylistViewer'
import { listPlaylists } from '../../services/playlists'
import { listSchedules, createSchedule, updateSchedule, deleteSchedule } from '../../services/schedules'
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

// Schedule data is loaded from DynamoDB - no hardcoded defaults needed!

// DAY mapping: Index to code
const DAY_INDEX_TO_CODE: Record<number, string> = {
  0: 'SUN',
  1: 'MON',
  2: 'TUE',
  3: 'WED',
  4: 'THU',
  5: 'FRI',
  6: 'SAT'
}

const DAY_CODE_TO_INDEX: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6
}

function Planner() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [showAddSlot, setShowAddSlot] = useState(false)
  const [currentDay, setCurrentDay] = useState<string>('MON')
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkPlaylistId, setBulkPlaylistId] = useState<string>('')
  const [bulkDays, setBulkDays] = useState<string[]>([])
  const [bulkSlots, setBulkSlots] = useState<string[]>([])
  const [bulkTimes, setBulkTimes] = useState<string[]>([])
  const [bulkMode, setBulkMode] = useState<'existing' | 'create'>('existing')
  const [isLoading, setIsLoading] = useState(true)

  // Load playlists and schedules from DynamoDB on mount
  useEffect(() => {
    loadPlaylists()
    loadSchedulesFromDB()
  }, [])

  async function loadSchedulesFromDB() {
    try {
      console.log('📅 Loading schedules from DynamoDB...')
      setIsLoading(true)
      
      const { data: schedules } = await listSchedules()
      
      if (!schedules || schedules.length === 0) {
        console.log('⚠️ No schedules found - using empty list')
        setTimeSlots([])
        return
      }
      
      // Group schedules by time+name to reconstruct TimeSlot with days array
      const slotMap = new Map<string, TimeSlot>()
      
      schedules.forEach((schedule: any) => {
        const key = `${schedule.startTime}-${schedule.name}`
        
        if (!slotMap.has(key)) {
          // Create new TimeSlot
          slotMap.set(key, {
            id: schedule.id,
            time: schedule.startTime,
            name: schedule.name,
            playlistId: schedule.playlistId,
            days: schedule.dayOfWeek !== null ? [DAY_INDEX_TO_CODE[schedule.dayOfWeek]] : DAYS,
            duration: 0, // TODO: calculate from start/end time
            active: schedule.isActive !== false
          })
        } else {
          // Add day to existing slot
          const slot = slotMap.get(key)!
          if (schedule.dayOfWeek !== null) {
            const dayCode = DAY_INDEX_TO_CODE[schedule.dayOfWeek]
            if (!slot.days.includes(dayCode)) {
              slot.days.push(dayCode)
            }
          }
        }
      })
      
      const slots = Array.from(slotMap.values())
      console.log('✅ Loaded', slots.length, 'time slots from DynamoDB')
      setTimeSlots(slots)
    } catch (error) {
      console.error('❌ Failed to load schedules:', error)
      setTimeSlots([])
    } finally {
      setIsLoading(false)
    }
  }

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

  async function handlePlaylistSelect(slotId: string, playlistId: string) {
    // Get current slot before updating
    const currentSlot = timeSlots.find(s => s.id === slotId)
    const isNewSlot = currentSlot?.playlistId === null
    
    // Update local state immediately
    setTimeSlots(slots => slots.map(slot => 
      slot.id === slotId ? { ...slot, playlistId } : slot
    ))
    
    // Persist to DynamoDB
    try {
      if (isNewSlot && currentSlot) {
        // First time selecting playlist - CREATE in DynamoDB
        console.log('📝 Creating new schedule in DynamoDB...')
        const result = await createSchedule({
          name: currentSlot.name,
          startTime: currentSlot.time,
          endTime: null,
          playlistId: playlistId,
          dayOfWeek: null, // null = every day
          isActive: currentSlot.active,
          priority: 0
        })
        
        // IMPORTANT: Update local slot with DynamoDB-generated ID!
        const dbId = result.data?.id
        if (dbId) {
          setTimeSlots(slots => slots.map(slot => 
            slot.id === slotId ? { ...slot, id: dbId } : slot
          ))
          console.log('✅ New schedule created in DynamoDB with ID:', dbId)
        }
      } else {
        // Already exists - UPDATE in DynamoDB
        await updateSchedule(slotId, { playlistId })
        console.log('✅ Playlist updated in DynamoDB')
      }
    } catch (error) {
      console.error('❌ Failed to save playlist:', error)
      alert('Failed to save playlist selection')
    }
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

  async function toggleSlotActive(slotId: string) {
    const slot = timeSlots.find(s => s.id === slotId)
    if (!slot) return
    
    const newActive = !slot.active
    
    // Update local state immediately
    setTimeSlots(slots => slots.map(s =>
      s.id === slotId ? { ...s, active: newActive } : s
    ))
    
    // Persist to DynamoDB
    try {
      await updateSchedule(slotId, { isActive: newActive })
      console.log('✅ Schedule active status updated in DynamoDB')
    } catch (error) {
      console.error('❌ Failed to toggle active:', error)
      alert('Failed to save active status')
    }
  }

  async function addNewSlot() {
    // IMPORTANT: Don't save to DynamoDB yet - user needs to set playlist first!
    const newSlot: TimeSlot = {
      id: Date.now().toString(),
      time: '00:00',
      name: 'New Slot',
      playlistId: null,
      days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      duration: 60,
      active: true
    }
    
    // Add to local state only
    setTimeSlots([...timeSlots, newSlot])
    setShowAddSlot(false)
    setSelectedSlot(newSlot) // Auto-select so user can set playlist
    
    console.log('⚠️ New slot created locally - select a playlist and it will auto-save to DynamoDB')
    
    // NOTE: DynamoDB save happens when user selects playlist via handlePlaylistSelect()
  }

  async function deleteSlot(slotId: string) {
    if (confirm('Remove this time slot?')) {
      // Remove from local state immediately
      setTimeSlots(slots => slots.filter(s => s.id !== slotId))
      if (selectedSlot?.id === slotId) {
        setSelectedSlot(null)
      }
      
      // Delete from DynamoDB
      try {
        await deleteSchedule(slotId)
        console.log('✅ Schedule deleted from DynamoDB')
      } catch (error) {
        console.error('❌ Failed to delete schedule:', error)
        alert('Failed to delete slot from database')
      }
    }
  }

  // Clear All Slots
  async function clearAllSlots() {
    const confirmMessage = `⚠️ WARNING: This will delete ALL ${timeSlots.length} time slots and planning!\n\nThis action cannot be undone.\n\nAre you sure?`
    
    if (confirm(confirmMessage)) {
      const doubleCheck = confirm('🚨 FINAL CONFIRMATION\n\nDelete ALL slots and start fresh?\n\nClick OK to proceed.')
      
      if (doubleCheck) {
        // Clear local state
        setTimeSlots([])
        setSelectedSlot(null)
        
        // Delete all from DynamoDB
        try {
          const deletePromises = timeSlots.map(slot => deleteSchedule(slot.id))
          await Promise.all(deletePromises)
          console.log('✅ All schedules deleted from DynamoDB')
          alert('✅ All slots cleared! Starting fresh.')
        } catch (error) {
          console.error('❌ Failed to clear all schedules:', error)
          alert('Some slots may not have been deleted from database')
        }
      }
    }
  }

  // Bulk Edit Functions
  function applyBulkEdit() {
    if (!bulkPlaylistId || bulkDays.length === 0) {
      alert('Please select playlist and days')
      return
    }

    if (bulkMode === 'existing') {
      // Update existing slots
      if (bulkSlots.length === 0) {
        alert('Please select at least one time slot')
        return
      }

      setTimeSlots(slots => slots.map(slot => {
        if (bulkSlots.includes(slot.id)) {
          return {
            ...slot,
            playlistId: bulkPlaylistId,
            days: bulkDays,
            active: true
          }
        }
        return slot
      }))

      alert(`✅ Bulk edit applied to ${bulkSlots.length} slots!`)
    } else {
      // Create new slots from selected times
      if (bulkTimes.length === 0) {
        alert('Please select at least one time')
        return
      }

      const newSlots: TimeSlot[] = bulkTimes.map((time, index) => ({
        id: `${Date.now()}-${index}`,
        time,
        name: `Slot ${time}`,
        playlistId: bulkPlaylistId,
        days: bulkDays,
        duration: 60,
        active: true
      }))

      setTimeSlots([...timeSlots, ...newSlots])
      alert(`✅ Created ${newSlots.length} new slots!`)
    }

    setShowBulkEdit(false)
    setBulkPlaylistId('')
    setBulkDays([])
    setBulkSlots([])
    setBulkTimes([])
    setBulkMode('existing')
  }

  function quickFillWeekdays(playlistId: string) {
    if (!playlistId) return
    
    setTimeSlots(slots => slots.map(slot => ({
      ...slot,
      playlistId,
      days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      active: true
    })))
    alert('✅ All slots filled with playlist for weekdays!')
  }

  function quickFillWeekend(playlistId: string) {
    if (!playlistId) return
    
    setTimeSlots(slots => slots.map(slot => ({
      ...slot,
      playlistId,
      days: ['SAT', 'SUN'],
      active: true
    })))
    alert('✅ All slots filled with playlist for weekend!')
  }

  function quickFillAllDays(playlistId: string) {
    if (!playlistId) return
    
    setTimeSlots(slots => slots.map(slot => ({
      ...slot,
      playlistId,
      days: DAYS,
      active: true
    })))
    alert('✅ All slots filled with playlist for all days!')
  }

  function duplicateSlot(slotId: string) {
    const slot = timeSlots.find(s => s.id === slotId)
    if (!slot) return

    const newSlot: TimeSlot = {
      ...slot,
      id: Date.now().toString(),
      name: `${slot.name} (Copy)`,
    }
    setTimeSlots([...timeSlots, newSlot])
  }

  function toggleBulkSlot(slotId: string) {
    setBulkSlots(prev => 
      prev.includes(slotId)
        ? prev.filter(id => id !== slotId)
        : [...prev, slotId]
    )
  }

  function toggleBulkDay(day: string) {
    setBulkDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    )
  }

  function toggleBulkTime(time: string) {
    setBulkTimes(prev =>
      prev.includes(time)
        ? prev.filter(t => t !== time)
        : [...prev, time]
    )
  }

  // Generate all hours from 00:00 to 23:00
  const allHours = Array.from({ length: 24 }, (_, i) => 
    `${String(i).padStart(2, '0')}:00`
  )

  // Common time presets
  const businessHours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
  const morningSlots = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00']
  const afternoonSlots = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00']
  const eveningSlots = ['18:00', '19:00', '20:00', '21:00', '22:00', '23:00']

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
          <div className="flex gap-3">
            <button
              onClick={clearAllSlots}
              disabled={timeSlots.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
              title={timeSlots.length === 0 ? 'No slots to clear' : 'Clear all slots'}
            >
              <span>🗑️</span> Clear All
            </button>
            <button
              onClick={() => setShowBulkEdit(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <span>⚡</span> Bulk Fill
            </button>
            <button
              onClick={() => setShowAddSlot(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add Time Slot
            </button>
          </div>
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
                              duplicateSlot(slot.id)
                            }}
                            className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                            title="Duplicate"
                          >
                            📋
                          </button>
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

                {/* Playlist Preview with Audio Player */}
                {selectedSlot.playlistId && (
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
                    {/* Header Section */}
                    <div className="p-6 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                            <span className="text-3xl">🎵</span>
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-lg">Playlist Preview</h3>
                            <p className="text-white/80 text-sm">{selectedSlot.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-sm font-bold text-gray-800 shadow-lg">
                            ⏰ {selectedSlot.time}
                          </div>
                          <div className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-sm font-bold text-white shadow-lg border border-white/30">
                            ⏱️ {selectedSlot.duration}m
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                        <div className="text-lg font-bold text-white mb-1">
                          {playlists.find(p => p.id === selectedSlot.playlistId)?.name || 'Loading...'}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-white/90">
                          <span className="flex items-center gap-1">
                            <span className="text-green-300">▶️</span>
                            Click track to preview
                          </span>
                          <span className="text-white/50">•</span>
                          <span className="flex items-center gap-1">
                            🎧 Inline player
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Info Bar */}
                    <div className="px-6 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Days:</span>
                            <div className="flex gap-1">
                              {selectedSlot.days.map(day => (
                                <span key={day} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                  {day}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                            selectedSlot.active 
                              ? 'bg-green-500 text-white shadow-sm' 
                              : 'bg-gray-300 text-gray-600'
                          }`}>
                            {selectedSlot.active ? '✓ Active' : '○ Inactive'}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const playlist = playlists.find(p => p.id === selectedSlot.playlistId)
                            if (playlist) {
                              alert(`📋 Playlist: ${playlist.name}\n⏰ Time: ${selectedSlot.time}\n📅 Days: ${selectedSlot.days.join(', ')}\n⏱️ Duration: ${selectedSlot.duration} minutes`)
                            }
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm"
                        >
                          ℹ️ Details
                        </button>
                      </div>
                    </div>

                    {/* Playlist Tracks */}
                    <div className="bg-white">
                      <PlaylistViewer
                        playlistId={selectedSlot.playlistId}
                        compact={true}
                        maxHeight="450px"
                        showHeader={false}
                        showDragHandle={false}
                        allowReorder={false}
                        allowRemove={false}
                        allowPlay={true}
                        containerClassName=""
                      />
                    </div>
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

        {/* Bulk Edit Modal */}
        {showBulkEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">⚡ Bulk Fill Schedule</h3>
                <button
                  onClick={() => setShowBulkEdit(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Quick Fill Templates */}
              <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
                <h4 className="font-bold text-gray-900 mb-3">🚀 Quick Fill (All Slots)</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Instantly fill ALL time slots with a playlist
                </p>
                <div className="flex items-center gap-3">
                  <select
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    onChange={(e) => {
                      if (e.target.value) {
                        const action = e.target.value
                        e.target.value = ''
                        
                        const playlistId = prompt('Enter Playlist ID or select from dropdown below:')
                        if (!playlistId) return

                        if (action === 'weekdays') quickFillWeekdays(playlistId)
                        else if (action === 'weekend') quickFillWeekend(playlistId)
                        else if (action === 'alldays') quickFillAllDays(playlistId)
                      }
                    }}
                  >
                    <option value="">Choose template...</option>
                    <option value="weekdays">📅 Weekdays (Mon-Fri)</option>
                    <option value="weekend">🎉 Weekend (Sat-Sun)</option>
                    <option value="alldays">🌍 All Days (Mon-Sun)</option>
                  </select>
                  <div className="text-sm text-gray-600">
                    or use Custom Fill below →
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 my-6"></div>

              {/* Custom Bulk Fill */}
              <div>
                <h4 className="font-bold text-gray-900 mb-4">🎯 Custom Bulk Fill</h4>
                
                {/* Step 1: Select Playlist */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    1️⃣ Select Playlist
                  </label>
                  <select
                    value={bulkPlaylistId}
                    onChange={(e) => setBulkPlaylistId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Choose playlist...</option>
                    {playlists.map(playlist => (
                      <option key={playlist.id} value={playlist.id}>
                        {playlist.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mode Toggle */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    2️⃣ Choose Mode
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setBulkMode('existing')
                        setBulkTimes([])
                      }}
                      className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                        bulkMode === 'existing'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      📝 Update Existing Slots
                    </button>
                    <button
                      onClick={() => {
                        setBulkMode('create')
                        setBulkSlots([])
                      }}
                      className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                        bulkMode === 'create'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      ➕ Create New Slots
                    </button>
                  </div>
                </div>

                {/* Step 2: Select Time Slots OR Times */}
                {bulkMode === 'existing' ? (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      3️⃣ Select Existing Time Slots
                    </label>
                    <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 rounded-lg max-h-60 overflow-y-auto">
                      {timeSlots.map(slot => (
                        <button
                          key={slot.id}
                          onClick={() => toggleBulkSlot(slot.id)}
                          className={`text-left p-3 rounded-lg border-2 transition-all ${
                            bulkSlots.includes(slot.id)
                              ? 'border-purple-600 bg-purple-50'
                              : 'border-gray-200 bg-white hover:border-purple-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              bulkSlots.includes(slot.id)
                                ? 'border-purple-600 bg-purple-600'
                                : 'border-gray-300'
                            }`}>
                              {bulkSlots.includes(slot.id) && (
                                <span className="text-white text-xs">✓</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-sm">{slot.time} - {slot.name}</div>
                              <div className="text-xs text-gray-600">{slot.duration}m</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => setBulkSlots(timeSlots.map(s => s.id))}
                        className="text-sm text-purple-600 hover:text-purple-700"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setBulkSlots([])}
                        className="text-sm text-gray-600 hover:text-gray-700"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      3️⃣ Select Times (00:00 - 23:00)
                    </label>
                    
                    {/* Time Presets */}
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setBulkTimes(allHours)}
                        className="text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                      >
                        🌍 All Hours (24)
                      </button>
                      <button
                        onClick={() => setBulkTimes(businessHours)}
                        className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        💼 Business (9-17)
                      </button>
                      <button
                        onClick={() => setBulkTimes(morningSlots)}
                        className="text-xs px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                      >
                        🌅 Morning (6-11)
                      </button>
                      <button
                        onClick={() => setBulkTimes(afternoonSlots)}
                        className="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                      >
                        ☀️ Afternoon (12-17)
                      </button>
                      <button
                        onClick={() => setBulkTimes(eveningSlots)}
                        className="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                      >
                        🌙 Evening (18-23)
                      </button>
                      <button
                        onClick={() => setBulkTimes([])}
                        className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Clear
                      </button>
                    </div>

                    {/* All Hours Grid */}
                    <div className="grid grid-cols-8 gap-2 p-4 bg-gray-50 rounded-lg max-h-60 overflow-y-auto">
                      {allHours.map(time => (
                        <button
                          key={time}
                          onClick={() => toggleBulkTime(time)}
                          className={`py-2 px-3 rounded-lg font-mono text-sm font-medium transition-all ${
                            bulkTimes.includes(time)
                              ? 'bg-purple-600 text-white'
                              : 'bg-white text-gray-700 hover:bg-purple-100 border border-gray-200'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      {bulkTimes.length > 0 ? (
                        <span className="font-medium text-purple-600">
                          {bulkTimes.length} times selected
                        </span>
                      ) : (
                        'Click times or use presets above'
                      )}
                    </div>
                  </div>
                )}

                {/* Step 4: Select Days */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    4️⃣ Select Days
                  </label>
                  <div className="flex gap-2">
                    {DAYS.map(day => (
                      <button
                        key={day}
                        onClick={() => toggleBulkDay(day)}
                        className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                          bulkDays.includes(day)
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setBulkDays(['MON', 'TUE', 'WED', 'THU', 'FRI'])}
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      Weekdays
                    </button>
                    <button
                      onClick={() => setBulkDays(['SAT', 'SUN'])}
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      Weekend
                    </button>
                    <button
                      onClick={() => setBulkDays(DAYS)}
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      All Days
                    </button>
                    <button
                      onClick={() => setBulkDays([])}
                      className="text-sm text-gray-600 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Summary */}
                {(bulkPlaylistId || bulkSlots.length > 0 || bulkTimes.length > 0 || bulkDays.length > 0) && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h5 className="font-semibold text-blue-900 mb-2">Summary:</h5>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>
                        <strong>Mode:</strong> {bulkMode === 'existing' ? '📝 Update Existing Slots' : '➕ Create New Slots'}
                      </li>
                      <li>
                        <strong>Playlist:</strong>{' '}
                        {bulkPlaylistId
                          ? playlists.find(p => p.id === bulkPlaylistId)?.name || 'Unknown'
                          : 'Not selected'}
                      </li>
                      {bulkMode === 'existing' ? (
                        <li>
                          <strong>Existing Slots:</strong> {bulkSlots.length} selected
                        </li>
                      ) : (
                        <li>
                          <strong>Times:</strong> {bulkTimes.length > 0 ? `${bulkTimes.length} times (${bulkTimes.join(', ')})` : 'None'}
                        </li>
                      )}
                      <li>
                        <strong>Days:</strong> {bulkDays.length > 0 ? bulkDays.join(', ') : 'None'}
                      </li>
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={applyBulkEdit}
                    disabled={
                      !bulkPlaylistId || 
                      bulkDays.length === 0 || 
                      (bulkMode === 'existing' && bulkSlots.length === 0) ||
                      (bulkMode === 'create' && bulkTimes.length === 0)
                    }
                    className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
                  >
                    {bulkMode === 'existing' ? 'Apply Bulk Fill' : `Create ${bulkTimes.length} New Slots`}
                  </button>
                  <button
                    onClick={() => {
                      setShowBulkEdit(false)
                      setBulkPlaylistId('')
                      setBulkDays([])
                      setBulkSlots([])
                      setBulkTimes([])
                      setBulkMode('existing')
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
