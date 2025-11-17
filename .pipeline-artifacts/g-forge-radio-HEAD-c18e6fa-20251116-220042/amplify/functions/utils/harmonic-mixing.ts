/**
 * Harmonic Mixing Utilities
 * Camelot Wheel implementation for key-aware track transitions
 */

// Camelot Wheel Mapping
export const CAMELOT_WHEEL: Record<string, string> = {
  // Major keys
  'C': '8B', 'Db': '3B', 'D': '10B', 'Eb': '5B',
  'E': '12B', 'F': '7B', 'F#': '2B', 'Gb': '2B',
  'G': '9B', 'Ab': '4B', 'A': '11B', 'Bb': '6B', 'B': '1B',
  
  // Minor keys  
  'Cm': '5A', 'C#m': '12A', 'Dbm': '12A', 'Dm': '7A',
  'Ebm': '2A', 'Em': '9A', 'Fm': '4A', 'F#m': '11A',
  'Gbm': '11A', 'Gm': '6A', 'G#m': '1A', 'Abm': '1A',
  'Am': '8A', 'Bbm': '3A', 'Bm': '10A'
}

// Reverse lookup
export const CAMELOT_TO_KEY: Record<string, string> = Object.entries(CAMELOT_WHEEL)
  .reduce((acc, [key, camelot]) => ({ ...acc, [camelot]: key }), {})

/**
 * Convert musical key to Camelot notation
 */
export function keyToCamelot(key: string): string | null {
  // Normalize key format
  const normalized = key.trim()
    .replace(/major/i, '')
    .replace(/minor/i, 'm')
    .replace(/sharp/i, '#')
    .replace(/flat/i, 'b')
    .trim()
  
  return CAMELOT_WHEEL[normalized] || null
}

/**
 * Extract Camelot number and letter
 */
export function parseCamelot(camelot: string): { number: number; letter: 'A' | 'B' } | null {
  const match = camelot.match(/^(\d+)([AB])$/)
  if (!match) return null
  
  return {
    number: parseInt(match[1]),
    letter: match[2] as 'A' | 'B'
  }
}

/**
 * Calculate Camelot distance (0 = same, 12 = opposite)
 */
export function camelotDistance(camelot1: string, camelot2: string): number {
  const c1 = parseCamelot(camelot1)
  const c2 = parseCamelot(camelot2)
  
  if (!c1 || !c2) return 12 // Invalid = max distance
  
  // Same key
  if (camelot1 === camelot2) return 0
  
  // Relative major/minor (8A ↔ 8B)
  if (c1.number === c2.number && c1.letter !== c2.letter) return 1
  
  // Adjacent numbers (8A → 9A or 7A)
  if (c1.letter === c2.letter) {
    const diff = Math.abs(c1.number - c2.number)
    return Math.min(diff, 12 - diff) // Circular distance
  }
  
  // Different number and letter
  const numDiff = Math.abs(c1.number - c2.number)
  return Math.min(numDiff, 12 - numDiff) + 1
}

/**
 * Check if two keys are compatible for harmonic mixing
 */
export function areKeysCompatible(
  key1: string,
  key2: string,
  strict: boolean = false
): boolean {
  const camelot1 = keyToCamelot(key1)
  const camelot2 = keyToCamelot(key2)
  
  if (!camelot1 || !camelot2) return false
  
  const distance = camelotDistance(camelot1, camelot2)
  
  if (strict) {
    // Strict: only same, relative, or ±1
    return distance <= 1
  } else {
    // Relaxed: allow ±2
    return distance <= 2
  }
}

/**
 * Calculate key compatibility score (0-1)
 */
export function calculateKeyScore(key1: string, key2: string): number {
  const camelot1 = keyToCamelot(key1)
  const camelot2 = keyToCamelot(key2)
  
  if (!camelot1 || !camelot2) return 0.5 // Unknown = neutral
  
  const distance = camelotDistance(camelot1, camelot2)
  
  // Score based on distance
  if (distance === 0) return 1.0  // Perfect (same key)
  if (distance === 1) return 0.95 // Excellent (relative or ±1)
  if (distance === 2) return 0.75 // Good (±2)
  if (distance === 3) return 0.5  // Acceptable
  if (distance === 4) return 0.3  // Poor
  return 0.1 // Very poor
}

/**
 * Get compatible keys for harmonic mixing
 */
export function getCompatibleKeys(key: string): string[] {
  const camelot = keyToCamelot(key)
  if (!camelot) return []
  
  const parsed = parseCamelot(camelot)
  if (!parsed) return []
  
  const { number, letter } = parsed
  const compatible: string[] = []
  
  // Same key
  compatible.push(camelot)
  
  // Relative major/minor
  const relativeLetter = letter === 'A' ? 'B' : 'A'
  compatible.push(`${number}${relativeLetter}`)
  
  // ±1 same mode
  const prevNumber = number === 1 ? 12 : number - 1
  const nextNumber = number === 12 ? 1 : number + 1
  compatible.push(`${prevNumber}${letter}`)
  compatible.push(`${nextNumber}${letter}`)
  
  // Convert back to keys
  return compatible
    .map(c => CAMELOT_TO_KEY[c])
    .filter(Boolean)
}

/**
 * Suggest best next keys for energy progression
 */
export function suggestNextKeys(currentKey: string, energyDirection: 'up' | 'down' | 'same'): string[] {
  const camelot = keyToCamelot(currentKey)
  if (!camelot) return []
  
  const parsed = parseCamelot(camelot)
  if (!parsed) return []
  
  const { number, letter } = parsed
  const suggestions: string[] = []
  
  switch (energyDirection) {
    case 'up':
      // +1 for energy boost
      const nextNumber = number === 12 ? 1 : number + 1
      suggestions.push(`${nextNumber}${letter}`)
      // Or go to major if in minor
      if (letter === 'A') {
        suggestions.push(`${number}B`)
      }
      break
      
    case 'down':
      // -1 for energy drop
      const prevNumber = number === 1 ? 12 : number - 1
      suggestions.push(`${prevNumber}${letter}`)
      // Or go to minor if in major
      if (letter === 'B') {
        suggestions.push(`${number}A`)
      }
      break
      
    case 'same':
      // Stay in same key or relative
      suggestions.push(camelot)
      const relativeLetter = letter === 'A' ? 'B' : 'A'
      suggestions.push(`${number}${relativeLetter}`)
      break
  }
  
  return suggestions
    .map(c => CAMELOT_TO_KEY[c])
    .filter(Boolean)
}

/**
 * Detect key transition type
 */
export type KeyTransitionType = 
  | 'perfect'      // Same key
  | 'relative'     // Relative major/minor
  | 'energy_up'    // +1 on wheel
  | 'energy_down'  // -1 on wheel
  | 'compatible'   // Within ±2
  | 'clash'        // >2 distance

export function detectTransitionType(key1: string, key2: string): KeyTransitionType {
  const camelot1 = keyToCamelot(key1)
  const camelot2 = keyToCamelot(key2)
  
  if (!camelot1 || !camelot2) return 'compatible'
  
  if (camelot1 === camelot2) return 'perfect'
  
  const distance = camelotDistance(camelot1, camelot2)
  const c1 = parseCamelot(camelot1)!
  const c2 = parseCamelot(camelot2)!
  
  // Relative major/minor
  if (distance === 1 && c1.number === c2.number) return 'relative'
  
  // Energy shifts
  if (c1.letter === c2.letter && distance === 1) {
    const diff = c2.number - c1.number
    if (diff === 1 || diff === -11) return 'energy_up'
    if (diff === -1 || diff === 11) return 'energy_down'
  }
  
  if (distance <= 2) return 'compatible'
  return 'clash'
}

export default {
  keyToCamelot,
  parseCamelot,
  camelotDistance,
  areKeysCompatible,
  calculateKeyScore,
  getCompatibleKeys,
  suggestNextKeys,
  detectTransitionType,
  CAMELOT_WHEEL,
  CAMELOT_TO_KEY
}
