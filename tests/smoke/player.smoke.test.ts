/**
 * SMOKE TEST: Player Component
 * 
 * Quick validation that critical player functionality works
 * Run after every deployment to catch breaking changes
 * 
 * Duration: < 30 seconds
 * Scope: Critical paths only
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const PLAYER_URL = process.env.VITE_PLAYER_URL || 'https://splashfm.nl'
const STREAM_URL = process.env.VITE_STREAM_URL || 'https://splashfm.nl/splashfm.mp3'
const STATUS_URL = process.env.VITE_STATUS_URL || 'https://splashfm.nl/status-json.xsl'

describe('🎵 SMOKE TEST: Player Component', () => {
  
  describe('1. Page Availability', () => {
    it('should load player page (200 OK)', async () => {
      const response = await fetch(PLAYER_URL)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/html')
    })

    it('should have valid SSL certificate', async () => {
      const response = await fetch(PLAYER_URL)
      expect(response.url).toMatch(/^https:\/\//)
    })
  })

  describe('2. Critical Assets', () => {
    it('should serve logo file', async () => {
      const response = await fetch(`${PLAYER_URL}/logosplashfmfm.png`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('image')
    })

    it('should have player HTML with essential elements', async () => {
      const response = await fetch(PLAYER_URL)
      const html = await response.text()
      
      // Check for essential player elements
      expect(html).toContain('Splash FM')
      expect(html).toContain('audio') // Audio element
      expect(html).toMatch(/play|stream/i) // Play controls
    })
  })

  describe('3. Stream Availability', () => {
    it('should respond to stream URL', async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      
      try {
        const response = await fetch(STREAM_URL, { 
          signal: controller.signal,
          method: 'HEAD'
        })
        clearTimeout(timeout)
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toMatch(/audio|mpeg/)
      } catch (error) {
        clearTimeout(timeout)
        if (error.name === 'AbortError') {
          throw new Error('Stream response timeout (>5s)')
        }
        throw error
      }
    })
  })

  describe('4. Metadata API', () => {
    it('should respond with Icecast status JSON', async () => {
      const response = await fetch(STATUS_URL)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('icestats')
      expect(data.icestats).toHaveProperty('host')
      expect(data.icestats.host).toBe('splashfm.nl')
    })
  })

  describe('5. Security Checks', () => {
    it('should block raw stream endpoint (403)', async () => {
      const EC2_IP = '79.125.44.178'
      const response = await fetch(`http://${EC2_IP}/stream-raw.mp3`, {
        method: 'HEAD'
      }).catch(() => ({ status: 403 })) // Expect connection refused or 403
      
      expect([403, 0]).toContain(response.status) // 0 = connection refused
    })

    it('should block admin panel (403)', async () => {
      const EC2_IP = '79.125.44.178'
      const response = await fetch(`http://${EC2_IP}/admin`, {
        method: 'HEAD'
      }).catch(() => ({ status: 403 }))
      
      expect([403, 0]).toContain(response.status)
    })
  })
})

describe('🔥 SMOKE TEST: CloudFront Distribution', () => {
  
  it('should serve content via CloudFront', async () => {
    const response = await fetch(PLAYER_URL)
    const cfHeaders = [
      response.headers.get('x-amz-cf-id'),
      response.headers.get('x-cache'),
      response.headers.get('via')
    ]
    
    const hasCloudFrontHeaders = cfHeaders.some(header => header !== null)
    expect(hasCloudFrontHeaders).toBe(true)
  })

  it('should support www subdomain', async () => {
    const response = await fetch('https://www.splashfm.nl/')
    expect(response.status).toBe(200)
  })
})

describe('⚡ SMOKE TEST: Performance', () => {
  
  it('should load page in < 3 seconds', async () => {
    const start = Date.now()
    const response = await fetch(PLAYER_URL)
    await response.text()
    const duration = Date.now() - start
    
    expect(duration).toBeLessThan(3000)
  })

  it('should have reasonable page size (< 50KB)', async () => {
    const response = await fetch(PLAYER_URL)
    const text = await response.text()
    const sizeKB = new Blob([text]).size / 1024
    
    expect(sizeKB).toBeLessThan(50)
  })
})
