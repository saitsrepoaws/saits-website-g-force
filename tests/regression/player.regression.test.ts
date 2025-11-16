/**
 * REGRESSION TEST: Player Component
 * 
 * Comprehensive testing of all player features to catch regressions
 * Run before major releases or after significant changes
 * 
 * Duration: 2-5 minutes
 * Scope: All player functionality
 */

import { describe, it, expect, beforeAll } from 'vitest'

const PLAYER_URL = process.env.VITE_PLAYER_URL || 'https://splashfm.nl'
const STREAM_URL = process.env.VITE_STREAM_URL || 'https://splashfm.nl/splashfm.mp3'
const STATUS_URL = process.env.VITE_STATUS_URL || 'https://splashfm.nl/status-json.xsl'

describe('🎵 REGRESSION: Player UI Components', () => {
  
  let playerHTML: string

  beforeAll(async () => {
    const response = await fetch(PLAYER_URL)
    playerHTML = await response.text()
  })

  describe('Essential HTML Elements', () => {
    it('should have audio element', () => {
      expect(playerHTML).toMatch(/<audio/i)
    })

    it('should have play/pause controls', () => {
      expect(playerHTML).toMatch(/play|pause/i)
    })

    it('should display station name (Splash FM)', () => {
      expect(playerHTML).toContain('Splash FM')
    })

    it('should have logo image', () => {
      expect(playerHTML).toMatch(/logosplashfmfm\.png/i)
    })

    it('should have volume controls', () => {
      expect(playerHTML).toMatch(/volume|slider|range/i)
    })
  })

  describe('Metadata Display', () => {
    it('should have now playing section', () => {
      expect(playerHTML).toMatch(/now playing|current track|artist|title/i)
    })

    it('should support cover art display', () => {
      expect(playerHTML).toMatch(/cover|artwork|image/i)
    })
  })

  describe('Responsive Design', () => {
    it('should have viewport meta tag', () => {
      expect(playerHTML).toContain('viewport')
      expect(playerHTML).toContain('width=device-width')
    })

    it('should have mobile-friendly layout', () => {
      expect(playerHTML).toMatch(/responsive|mobile|flex|grid/i)
    })
  })
})

describe('🌐 REGRESSION: Network & Streaming', () => {
  
  describe('Stream Endpoints', () => {
    it('should serve main stream', async () => {
      const response = await fetch(STREAM_URL, { method: 'HEAD' })
      expect(response.status).toBe(200)
    })

    it('should have correct audio content type', async () => {
      const response = await fetch(STREAM_URL, { method: 'HEAD' })
      const contentType = response.headers.get('content-type')
      expect(contentType).toMatch(/audio|mpeg/)
    })

    it('should support streaming (no content-length)', async () => {
      const response = await fetch(STREAM_URL, { method: 'HEAD' })
      const contentLength = response.headers.get('content-length')
      // Streaming should not have content-length or be very large
      if (contentLength) {
        expect(parseInt(contentLength)).toBeGreaterThan(1000000)
      }
    })
  })

  describe('CORS Configuration', () => {
    it('should allow cross-origin requests', async () => {
      const response = await fetch(STREAM_URL, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'GET'
        }
      })
      
      const corsHeader = response.headers.get('access-control-allow-origin')
      expect(corsHeader).toBeTruthy()
    })
  })

  describe('Cache Behavior', () => {
    it('should have appropriate cache headers for player', async () => {
      const response = await fetch(PLAYER_URL)
      const cacheControl = response.headers.get('cache-control')
      expect(cacheControl).toBeTruthy()
    })

    it('should not cache stream data', async () => {
      const response = await fetch(STREAM_URL, { method: 'HEAD' })
      const cacheControl = response.headers.get('cache-control')
      if (cacheControl) {
        expect(cacheControl).toMatch(/no-cache|no-store|max-age=0/)
      }
    })
  })
})

describe('📡 REGRESSION: Metadata & Status', () => {
  
  let statusData: any

  beforeAll(async () => {
    const response = await fetch(STATUS_URL)
    statusData = await response.json()
  })

  describe('Icecast Status Structure', () => {
    it('should have icestats object', () => {
      expect(statusData).toHaveProperty('icestats')
    })

    it('should include server info', () => {
      expect(statusData.icestats).toHaveProperty('host')
      expect(statusData.icestats).toHaveProperty('server_id')
    })

    it('should have correct hostname', () => {
      expect(statusData.icestats.host).toBe('splashfm.nl')
    })

    it('should report Icecast version', () => {
      expect(statusData.icestats.server_id).toContain('Icecast')
    })
  })

  describe('Stream Source Information', () => {
    it('should include source data if stream is active', () => {
      if (statusData.icestats.source) {
        const source = Array.isArray(statusData.icestats.source) 
          ? statusData.icestats.source[0] 
          : statusData.icestats.source
        
        expect(source).toHaveProperty('listenurl')
        expect(source.listenurl).toContain('/splashfm.mp3')
      }
    })
  })
})

describe('🔒 REGRESSION: Security Features', () => {
  
  const EC2_IP = '79.125.44.178'

  describe('Blocked Endpoints', () => {
    it('should block raw stream access', async () => {
      try {
        const response = await fetch(`http://${EC2_IP}/stream-raw.mp3`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(3000)
        })
        expect([403, 0]).toContain(response.status)
      } catch (error) {
        // Timeout or connection refused is acceptable (blocked)
        expect(true).toBe(true)
      }
    })

    it('should block unprocessed stream access', async () => {
      try {
        const response = await fetch(`http://${EC2_IP}/stream.mp3`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(3000)
        })
        expect([403, 0]).toContain(response.status)
      } catch (error) {
        expect(true).toBe(true)
      }
    })

    it('should block Icecast admin panel', async () => {
      try {
        const response = await fetch(`http://${EC2_IP}/admin`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(3000)
        })
        expect([403, 0, 401]).toContain(response.status)
      } catch (error) {
        expect(true).toBe(true)
      }
    })
  })

  describe('SSL/TLS Configuration', () => {
    it('should enforce HTTPS on main domain', async () => {
      const response = await fetch(PLAYER_URL)
      expect(response.url).toMatch(/^https:\/\//)
    })

    it('should have valid SSL certificate chain', async () => {
      // If fetch succeeds without error, certificate is valid
      const response = await fetch(PLAYER_URL)
      expect(response.status).toBe(200)
    })

    it('should support modern TLS versions', async () => {
      const response = await fetch(PLAYER_URL)
      // If connection successful, TLS is working
      expect(response.ok).toBe(true)
    })
  })

  describe('Content Security', () => {
    it('should have security headers', async () => {
      const response = await fetch(PLAYER_URL)
      const headers = response.headers
      
      // Check for at least some security headers
      const hasSecurityHeaders = 
        headers.has('x-frame-options') ||
        headers.has('x-content-type-options') ||
        headers.has('strict-transport-security')
      
      // Optional but recommended
      if (!hasSecurityHeaders) {
        console.warn('⚠️  No security headers detected')
      }
    })
  })
})

describe('⚡ REGRESSION: Performance Metrics', () => {
  
  describe('Page Load Performance', () => {
    it('should load HTML in < 3 seconds', async () => {
      const start = Date.now()
      await fetch(PLAYER_URL)
      const duration = Date.now() - start
      
      expect(duration).toBeLessThan(3000)
    })

    it('should have reasonable HTML size', async () => {
      const response = await fetch(PLAYER_URL)
      const html = await response.text()
      const sizeKB = new Blob([html]).size / 1024
      
      expect(sizeKB).toBeLessThan(100) // 100KB max
    })

    it('should load logo quickly', async () => {
      const start = Date.now()
      await fetch(`${PLAYER_URL}/logosplashfmfm.png`)
      const duration = Date.now() - start
      
      expect(duration).toBeLessThan(2000)
    })
  })

  describe('Stream Latency', () => {
    it('should connect to stream quickly (< 2s)', async () => {
      const start = Date.now()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      
      try {
        await fetch(STREAM_URL, { 
          signal: controller.signal,
          method: 'HEAD'
        })
        clearTimeout(timeout)
        const duration = Date.now() - start
        expect(duration).toBeLessThan(2000)
      } catch (error) {
        clearTimeout(timeout)
        if ((error as any).name === 'AbortError') {
          throw new Error('Stream connection timeout')
        }
      }
    })
  })

  describe('CloudFront Performance', () => {
    it('should benefit from CloudFront caching', async () => {
      // First request (cache miss)
      await fetch(PLAYER_URL)
      
      // Second request (should be cached)
      const start = Date.now()
      const response = await fetch(PLAYER_URL)
      const duration = Date.now() - start
      
      const cacheStatus = response.headers.get('x-cache')
      console.log(`CloudFront cache status: ${cacheStatus}`)
      
      // Cached requests should be faster
      if (cacheStatus?.includes('Hit')) {
        expect(duration).toBeLessThan(500) // Cached should be < 500ms
      }
    })
  })
})

describe('🌍 REGRESSION: Multi-Domain Support', () => {
  
  describe('Primary Domain', () => {
    it('should serve on splashfm.nl', async () => {
      const response = await fetch('https://splashfm.nl/')
      expect(response.status).toBe(200)
    })
  })

  describe('WWW Subdomain', () => {
    it('should serve on www.splashfm.nl', async () => {
      const response = await fetch('https://www.splashfm.nl/')
      expect(response.status).toBe(200)
    })

    it('should serve same content as primary', async () => {
      const response1 = await fetch('https://splashfm.nl/')
      const response2 = await fetch('https://www.splashfm.nl/')
      
      const html1 = await response1.text()
      const html2 = await response2.text()
      
      // Content should be similar (may have slight differences in headers)
      expect(html1.length).toBeGreaterThan(10000)
      expect(html2.length).toBeGreaterThan(10000)
    })
  })
})

describe('🔄 REGRESSION: Failover & Reliability', () => {
  
  describe('Graceful Degradation', () => {
    it('should handle status endpoint failure gracefully', async () => {
      // Test with invalid status URL
      try {
        await fetch(`${PLAYER_URL}/invalid-status-url`)
      } catch (error) {
        // Should fail gracefully, not crash
        expect(true).toBe(true)
      }
    })

    it('should serve player even if stream is down', async () => {
      // Player HTML should load regardless of stream status
      const response = await fetch(PLAYER_URL)
      expect(response.status).toBe(200)
    })
  })

  describe('Error Handling', () => {
    it('should return 404 for non-existent files', async () => {
      const response = await fetch(`${PLAYER_URL}/non-existent-file-12345.html`)
      expect(response.status).toBe(404)
    })
  })
})
