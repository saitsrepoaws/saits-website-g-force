/**
 * Parse audio filename to extract metadata
 * Format: Artist - Title (Version) [Label]
 * 
 * Examples:
 * - "Hollen - Vintage Time (Original Mix) [Prospect Records]"
 * - "Artist - Title"
 * - "Title Only"
 * - "Artist - Title (Mix)"
 * - "Artist - Title [Label]"
 */

export interface ParsedFilename {
  artist: string | null
  title: string
  version: string | null
  label: string | null
  originalFilename: string
}

export function parseFilename(filename: string): ParsedFilename {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  
  // Initialize result
  const result: ParsedFilename = {
    artist: null,
    title: nameWithoutExt, // Fallback to full filename
    version: null,
    label: null,
    originalFilename: filename,
  }

  try {
    let remaining = nameWithoutExt.trim()

    // Extract label [Label]
    const labelMatch = remaining.match(/\[([^\]]+)\]/)
    if (labelMatch) {
      result.label = labelMatch[1].trim()
      remaining = remaining.replace(labelMatch[0], '').trim()
    }

    // Extract version (Version)
    const versionMatch = remaining.match(/\(([^)]+)\)/)
    if (versionMatch) {
      result.version = versionMatch[1].trim()
      remaining = remaining.replace(versionMatch[0], '').trim()
    }

    // Extract artist and title: Artist - Title
    const dashIndex = remaining.indexOf(' - ')
    if (dashIndex > 0) {
      result.artist = remaining.substring(0, dashIndex).trim()
      result.title = remaining.substring(dashIndex + 3).trim()
    } else {
      // No dash found, use remaining as title
      result.title = remaining.trim() || nameWithoutExt
    }

    // Fallback: if title is empty after parsing, use original filename
    if (!result.title || result.title.length === 0) {
      result.title = nameWithoutExt
    }

  } catch (error) {
    console.error('Error parsing filename:', error)
    // On error, return filename as title
    result.title = nameWithoutExt
  }

  return result
}

/**
 * Format parsed data back to display string
 */
export function formatTrackDisplay(parsed: ParsedFilename): string {
  const parts: string[] = []
  
  if (parsed.artist) parts.push(parsed.artist)
  if (parsed.title) parts.push(parsed.title)
  if (parsed.version) parts.push(`(${parsed.version})`)
  if (parsed.label) parts.push(`[${parsed.label}]`)
  
  return parts.join(' ')
}

/**
 * Test cases for validation
 */
export function testFilenameParser() {
  const testCases = [
    'Hollen - Vintage Time (Original Mix) [Prospect Records].mp3',
    'Artist - Title.mp3',
    'Title Only.mp3',
    'Artist - Title (Mix).mp3',
    'Artist - Title [Label].mp3',
    'Complex - Name (Extended Mix) [Big Label].flac',
    'empty.mp3', // Edge case: simple name
    'No Extension',
    'Multiple - Dashes - In - Name.mp3',
  ]

  console.log('=== Filename Parser Tests ===')
  testCases.forEach(filename => {
    const result = parseFilename(filename)
    console.log(`\nInput: "${filename}"`)
    console.log(`  Artist:  ${result.artist || '(none)'}`)
    console.log(`  Title:   ${result.title}`)
    console.log(`  Version: ${result.version || '(none)'}`)
    console.log(`  Label:   ${result.label || '(none)'}`)
  })
}
