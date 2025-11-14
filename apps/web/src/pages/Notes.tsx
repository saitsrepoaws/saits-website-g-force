import { useState } from 'react'
import Layout from '../components/Layout'

interface Note {
  id: string
  title: string
  description: string
  status: 'todo' | 'in-progress' | 'done'
  priority: 'low' | 'medium' | 'high'
  createdAt: string
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([
    {
      id: '1',
      title: 'Stereo Tool Standalone Processing',
      description: `
        Professional audio processing via Stereo Tool - ACTIVE & WORKING!
        
        STATUS (13 Nov 2025 - 20:35 CET):
        ✅ STEREO TOOL ACTIVE - Standalone implementation
        ✅ Binary: /usr/local/bin/stereotool-cmd (37MB)
        ✅ Service: stereotool-relay.service (running)
        ✅ Processing pipeline: MP3 → WAV → Stereo Tool → MP3 → Icecast
        
        ARCHITECTURE (Standalone):
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        Liquidsoap → /stream-raw.mp3 (Icecast)
                              ↓
                     Stereo Tool Relay Service
                     (curl → ffmpeg → stereotool → ffmpeg)
                              ↓
                     /stream-processed.mp3 (Icecast)
        
        AVAILABLE STREAMS:
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        1. /stream-processed.mp3 - WITH Stereo Tool (RECOMMENDED)
        2. /stream-raw.mp3 - Without processing (A/B testing)
        3. /stream.mp3 - Main stream (duplicate of raw for now)
        
        BENEFITS:
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ✅ Works with ANY Liquidsoap version (no upgrade needed!)
        ✅ Change presets without stream restart
        ✅ Independent processing (easy troubleshooting)
        ✅ A/B testing capability (raw vs processed)
        ✅ Professional broadcast setup (industry standard)
        ✅ Can disable/enable anytime
        
        RESOURCE USAGE:
        • Memory: ~210MB additional for processing pipeline
        • CPU: ~7% for real-time processing
        • Latency: ~5 seconds (acceptable for streaming)
        
        CONTROLS:
        • Start: sudo systemctl start stereotool-relay.service
        • Stop: sudo systemctl stop stereotool-relay.service  
        • Status: sudo systemctl status stereotool-relay.service
        • Logs: tail -f /var/log/stereotool-relay.log
        
        FILES:
        • Script: /usr/local/bin/stereotool-relay.sh
        • Service: /etc/systemd/system/stereotool-relay.service
        • Config: /opt/radio/radio.liq (dual output)
        
        EC2: 46.137.184.91
        Processed Stream: http://46.137.184.91:8000/stream-processed.mp3
        Raw Stream: http://46.137.184.91:8000/stream-raw.mp3
      `,
      status: 'done',
      priority: 'high',
      createdAt: '2025-11-13'
    },
    {
      id: '2',
      title: 'Video Overlay via Sockets',
      description: `
        Real-time video overlay systeem met WebSockets
        
        Features:
        • Live track info overlay
        • Album art display
        • Animated transitions
        • Customizable templates
        • OBS Studio integration
        
        Architecture:
        • Backend: WebSocket server (AWS IoT Core / Socket.io)
        • Frontend: OBS Browser Source
        • Data: Real-time track metadata from Icecast
        • Updates: Push-based (no polling)
        
        Components:
        1. WebSocket server (Lambda + API Gateway WebSocket)
        2. OBS Browser Source HTML/CSS/JS
        3. Track metadata publisher (from Liquidsoap)
        4. Template system (customizable overlays)
        
        Stack:
        • AWS IoT Core (already setup!)
        • React/HTML overlay
        • CSS animations
        • Real-time updates
      `,
      status: 'todo',
      priority: 'medium',
      createdAt: '2025-11-13'
    },
    {
      id: '3',
      title: 'QR Code Generator voor Websites & Video Streams',
      description: `
        QR codes genereren voor makkelijke toegang tot player en streams
        
        Use Cases:
        • Player URL (https://www.splashfm.nl/)
        • Direct stream URL (https://stream.splashfm.nl/stream.mp3)
        • Video overlay streams (OBS Browser Source)
        • Playlist sharing
        • Station info page
        
        Features:
        • Dynamic QR code generatie
        • Customizable size & colors
        • Logo in center (Splash FM)
        • Download als PNG/SVG
        • Print-ready posters
        
        Implementation:
        • Library: qrcode.react of qr-code-styling
        • UI: QR generator pagina in app
        • API: Lambda function voor server-side generatie
        • Storage: S3 voor generated QR codes
        
        Example URLs:
        • Player: https://www.splashfm.nl/
        • Stream: https://stream.splashfm.nl/stream.mp3
        • Status: https://stream.splashfm.nl/status-json.xsl
        • Video Overlay: https://overlay.splashfm.nl/ (toekomstig)
        
        Poster Templates:
        • A4 met QR + "Luister live!"
        • Social media format (1080x1080)
        • Sticker format (rond)
        • TV display (16:9)
      `,
      status: 'todo',
      priority: 'medium',
      createdAt: '2025-11-13'
    },
    {
      id: '4',
      title: 'WordPress Plugin - Player & Admin Control',
      description: `
        WordPress plugin voor beheer van Splash FM player en admin functies
        
        Features:
        • Embedded player shortcode [splashfm-player]
        • Admin dashboard voor stream management
        • Playlist editor integratie
        • Schedule management via WP admin
        • Stream statistics widget
        • Track upload via WordPress media library
        
        Player Shortcode:
        • [splashfm-player] - Volledige player
        • [splashfm-player type="mini"] - Compact player
        • [splashfm-player type="button"] - Play button only
        • Customizable via attributes (theme, size, autoplay)
        
        Admin Features:
        • Dashboard: Stream status, listeners, current track
        • Playlists: Create, edit, schedule playlists
        • Tracks: Upload, metadata, cover art
        • Schedule: Visual calendar met drag & drop
        • Settings: Stream URLs, branding, API keys
        • Analytics: Listener stats, popular tracks
        
        Technical:
        • WordPress REST API integration
        • GraphQL queries naar Amplify backend
        • Real-time updates via WebSockets
        • Admin AJAX voor quick actions
        • Gutenberg blocks voor player embedding
        
        Integration:
        • Connects to: https://www.splashfm.nl/
        • Stream: https://stream.splashfm.nl/stream.mp3
        • API: GraphQL endpoint (Amplify)
        • Auth: Cognito of WP users
        
        Installation:
        1. Upload plugin to /wp-content/plugins/
        2. Activate in WordPress admin
        3. Configure API credentials
        4. Add player via shortcode of Gutenberg block
        
        Benefits:
        • Non-technical users kunnen stream beheren
        • Geen directe AWS/Amplify kennis nodig
        • Familiar WordPress interface
        • Integration met bestaande WordPress site
      `,
      status: 'todo',
      priority: 'high',
      createdAt: '2025-11-13'
    },
    {
      id: '5',
      title: 'CloudWatch Monitoring & Dashboard - Complete Observability',
      description: `
        Verzamel ALLE logs en metrics van het complete radio systeem in CloudWatch
        
        LOGS COLLECTIE:
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        EC2 / Radio Server:
        • Liquidsoap logs (/tmp/liquidsoap.log, /var/log/liquidsoap.log)
        • Icecast logs (/var/log/icecast2/)
        • Nginx access & error logs (/var/log/nginx/)
        • System logs (syslog, auth.log)
        • Application logs (custom radio scripts)
        
        Amplify / Lambda:
        • Lambda function logs (al in CloudWatch)
        • API Gateway logs
        • AppSync GraphQL logs
        • DynamoDB streams
        
        METRICS COLLECTIE:
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        Stream Metrics:
        • Current listeners (Icecast stats)
        • Peak listeners
        • Bandwidth usage
        • Stream uptime
        • Buffer health
        • Track changes per hour
        
        Server Metrics:
        • CPU usage (Liquidsoap, Icecast, Nginx)
        • Memory usage per process
        • Disk I/O
        • Network traffic
        • Queue depth (SQS)
        
        Application Metrics:
        • Playlist generation time
        • Track download success/fail rate
        • API response times
        • GraphQL query performance
        • User actions (track uploads, playlist edits)
        
        Custom Metrics:
        • Tracks played per genre
        • Most played artists
        • Schedule adherence
        • News bulletin delivery success
        • Stereo Tool processing load
        
        IMPLEMENTATIE:
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        1. CloudWatch Agent op EC2:
           - Install AWS CloudWatch Agent
           - Configure log streams
           - Configure custom metrics
           - Auto-start on boot
        
        2. Log Parsing Scripts:
           - Parse Icecast stats (listeners, bitrate)
           - Parse Liquidsoap logs (tracks, errors)
           - Parse Nginx logs (requests, errors)
           - Push as structured CloudWatch logs
        
        3. Custom Metrics Script:
           - Cron job every minute
           - Scrape Icecast status JSON
           - Query SQS queue depth
           - Check Liquidsoap process health
           - Push to CloudWatch Metrics
        
        4. Lambda Metrics:
           - Custom metrics in Lambda functions
           - Track processing time
           - Success/failure rates
           - Add CloudWatch Insights queries
        
        5. CloudWatch Dashboard (later):
           - Real-time stream status
           - Listener trends (hour/day/week)
           - Server health overview
           - Error rate tracking
           - Performance metrics
           - Alert thresholds
        
        DASHBOARD WIDGETS:
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        • 🎵 Live Stream Status (listeners, bitrate, track)
        • 📊 Listener Trends (line graph, 24h/7d/30d)
        • 🖥️  Server Health (CPU, memory, disk)
        • 🔊 Audio Processing (Stereo Tool, Liquidsoap)
        • 📡 Network (bandwidth, requests/sec)
        • ⚠️  Errors & Warnings (log insights)
        • 🎼 Track Statistics (plays, genres)
        • ⏱️  Playlist Performance (generation time)
        
        ALERTING:
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        • Stream down > 2 min → SNS notification
        • 0 listeners for > 5 min → Alert
        • High CPU > 80% for > 5 min → Warning
        • Disk > 85% → Alert
        • Lambda errors > 5% → Notification
        • Queue depth > 50 → Warning
        
        BENEFITS:
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        ✅ Complete visibility in hele systeem
        ✅ Proactive problem detection
        ✅ Historical data voor optimization
        ✅ Professional monitoring setup
        ✅ Easy troubleshooting via logs
        ✅ Performance insights
        ✅ Cost optimization data
        
        FILES:
        • EC2: /opt/cloudwatch/config.json
        • Metrics script: /opt/cloudwatch/push-metrics.sh
        • Cron: /etc/cron.d/cloudwatch-metrics
        
        COST:
        • ~$5-10/month voor complete monitoring
        • First 5GB logs ingestion free
        • Custom metrics: $0.30 per metric
      `,
      status: 'todo',
      priority: 'high',
      createdAt: '2025-11-13'
    }
  ])

  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPriority, setNewPriority] = useState<Note['priority']>('medium')
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    const newNote: Note = {
      id: Date.now().toString(),
      title: newTitle,
      description: newDescription,
      status: 'todo',
      priority: newPriority,
      createdAt: new Date().toISOString().split('T')[0]
    }

    setNotes([newNote, ...notes])
    setNewTitle('')
    setNewDescription('')
    setNewPriority('medium')
  }

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedNotes)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedNotes(newExpanded)
  }

  const getStatusColor = (status: Note['status']) => {
    switch (status) {
      case 'todo': return 'bg-orange-100 text-orange-800 border border-orange-300'
      case 'in-progress': return 'bg-blue-100 text-blue-800 border border-blue-300'
      case 'done': return 'bg-green-100 text-green-800 border border-green-300'
    }
  }

  const getPriorityColor = (priority: Note['priority']) => {
    switch (priority) {
      case 'low': return 'bg-gray-200 text-gray-700 border border-gray-300'
      case 'medium': return 'bg-orange-200 text-orange-800 border border-orange-400'
      case 'high': return 'bg-red-200 text-red-800 border border-red-400'
    }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📝 Notes & TODO</h1>
          <p className="text-gray-600">Project notes en toekomstige features</p>
        </div>

        {/* ADD TODO FORM */}
        <form onSubmit={addTodo} className="mb-8 bg-gradient-to-r from-orange-50 to-blue-50 rounded-lg p-6 border-2 border-orange-200 shadow-md">
          <h2 className="text-xl font-bold text-orange-900 mb-4">➕ Nieuwe TODO</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Titel *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Bijv: Stereo Tool installeren"
                className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Beschrijving
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Gedetailleerde beschrijving, stappen, links, etc..."
                rows={4}
                className="w-full px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none transition resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as Note['priority'])}
                className="px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none transition"
              >
                <option value="low">📌 Low</option>
                <option value="medium">⚡ Medium</option>
                <option value="high">🔥 High</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 px-6 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg"
            >
              ➕ TODO Toevoegen
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {notes.map((note) => {
            const isExpanded = expandedNotes.has(note.id)
            
            return (
              <div
                key={note.id}
                className="bg-gradient-to-br from-orange-50 to-white rounded-lg shadow-md border-2 border-orange-200 hover:shadow-xl hover:border-orange-300 transition-all overflow-hidden"
              >
                {/* HEADER - Altijd zichtbaar, klikbaar om uit te klappen */}
                <div 
                  className="p-4 cursor-pointer hover:bg-orange-100/50 transition-colors"
                  onClick={() => toggleExpand(note.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <button 
                        className="text-2xl text-orange-600 hover:text-orange-700 transition-transform"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      >
                        ▶
                      </button>
                      
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">
                          {note.title}
                        </h3>
                        <div className="flex gap-2 mt-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(note.status)}`}>
                            {note.status === 'todo' && '📋 TODO'}
                            {note.status === 'in-progress' && '🔄 In Progress'}
                            {note.status === 'done' && '✅ Done'}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(note.priority)}`}>
                            {note.priority === 'high' && '🔥 High'}
                            {note.priority === 'medium' && '⚡ Medium'}
                            {note.priority === 'low' && '📌 Low'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500 ml-4">{note.createdAt}</span>
                  </div>
                </div>

                {/* CONTENT - Alleen zichtbaar als uitgeklapt */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t-2 border-orange-100 bg-white">
                    <div className="mt-4">
                      <pre className="bg-gray-50 p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap font-mono text-gray-800 border border-gray-200">
{note.description}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-8 p-6 bg-gradient-to-r from-orange-50 to-blue-50 rounded-lg border-2 border-orange-200">
          <h3 className="text-lg font-bold text-orange-900 mb-2">💡 Tip</h3>
          <p className="text-gray-800">
            Deze pagina bevat belangrijke notes voor toekomstige development. 
            Check regelmatig voor updates en nieuwe features!
          </p>
        </div>
      </div>
    </Layout>
  )
}
