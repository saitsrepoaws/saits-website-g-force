/**
 * Crossfade Analysis Utilities
 * BPM matching, energy analysis, and optimal crossfade calculation
 */

import { calculateKeyScore, detectTransitionType, getKeyCompatibility, CAMELOT_WHEEL } from './harmonic-mixing'
import { generateLiquidsoapConfig } from './liquidsoap-config-generator'

export interface Track {
  id: string
  title: string
  artist: string
  bpm?: number
  key?: string
  energy?: number
  danceability?: number
  valence?: number
  duration: number
}

export interface CrossfadeSettings {
  // Basic
  crossfadeEnabled: boolean
  crossfadeStartNext: number
  crossfadeFadeIn: number
  crossfadeFadeOut: number
  crossfadeNormalize: boolean
  crossfadeConservative: boolean
  
  // Smart - BPM
  smartCrossfadeEnabled: boolean
  smartCrossfadeBpmTolerance: number
  smartCrossfadeAutoAdjust: boolean
  
  // Smart - Harmonic
  harmonicMixingEnabled: boolean
  harmonicMixingStrict: boolean
  harmonicMixingBoost: number
  
  // Smart - Energy
  energyMatchingEnabled: boolean
  energyMatchingTolerance: number
  energyMatchingSmoothTransitions: boolean
}

export interface TransitionAnalysis {
  bpmScore: number
  keyScore: number
  energyScore: number
  overallScore: number
  recommendedCrossfade: {
    startNext: number
    fadeIn: number
    fadeOut: number
  }
  quality: 'excellent' | 'good' | 'acceptable' | 'poor'
  warnings: string[]
}

/**
 * Calculate BPM compatibility score
 */
export function calculateBPMScore(
  bpm1: number | undefined,
  bpm2: number | undefined,
  tolerance: number
): number {
  if (!bpm1 || !bpm2) return 0.7 // Unknown = neutral-positive
  
  const diff = Math.abs(bpm1 - bpm2)
  
  if (diff === 0) return 1.0 // Perfect match
  if (diff <= tolerance) {
    // Linear decay within tolerance
    return 1.0 - (diff / tolerance) * 0.3
  }
  if (diff <= tolerance * 2) {
    // Acceptable range
    return 0.5 - ((diff - tolerance) / tolerance) * 0.3
  }
  
  // Poor match
  return 0.2
}

/**
 * Calculate energy compatibility score
 */
export function calculateEnergyScore(
  energy1: number | undefined,
  energy2: number | undefined,
  tolerance: number
): number {
  if (!energy1 || !energy2) return 0.7 // Unknown = neutral-positive
  
  const diff = Math.abs(energy1 - energy2)
  
  if (diff <= tolerance) return 1.0
  if (diff <= tolerance * 2) {
    return 1.0 - ((diff - tolerance) / tolerance) * 0.5
  }
  
  return 0.3
}

/**
 * Auto-adjust crossfade duration based on BPM difference
 */
export function adjustCrossfadeDuration(
  baseDuration: number,
  bpmDiff: number
): number {
  if (bpmDiff <= 2) return baseDuration // Perfect match
  if (bpmDiff <= 5) return baseDuration * 1.2 // Slight increase
  if (bpmDiff <= 10) return baseDuration * 1.5 // More blending needed
  if (bpmDiff <= 15) return baseDuration * 1.8
  return baseDuration * 2.0 // Significant blend needed
}

/**
 * Adjust crossfade for energy jumps
 */
export function adjustForEnergyJump(
  baseDuration: number,
  energyDiff: number,
  smoothTransitions: boolean
): number {
  if (!smoothTransitions) return baseDuration
  
  if (energyDiff <= 0.1) return baseDuration
  if (energyDiff <= 0.2) return baseDuration * 1.1
  if (energyDiff <= 0.3) return baseDuration * 1.3
  return baseDuration * 1.5
}

/**
 * Apply harmonic mixing boost
 */
export function applyHarmonicBoost(
  baseDuration: number,
  keyScore: number,
  boostFactor: number
): number {
  if (keyScore >= 0.9) {
    // Compatible keys - can shorten crossfade
    return baseDuration / boostFactor
  }
  if (keyScore < 0.5) {
    // Incompatible - extend crossfade
    return baseDuration * (1 + (1 - keyScore) * 0.5)
  }
  return baseDuration
}

/**
 * Apply conservative mode adjustments
 */
export function applyConservativeMode(
  startNext: number,
  fadeIn: number,
  fadeOut: number
): { startNext: number; fadeIn: number; fadeOut: number } {
  return {
    startNext: startNext + 1.0,
    fadeIn: fadeIn + 1.0,
    fadeOut: fadeOut + 1.0
  }
}

/**
 * Analyze transition between two tracks
 */
export function analyzeTransition(
  track1: Track,
  track2: Track,
  settings: CrossfadeSettings
): TransitionAnalysis {
  const warnings: string[] = []
  
  // Calculate scores
  let bpmScore = 1.0
  let keyScore = 1.0
  let energyScore = 1.0
  
  if (settings.smartCrossfadeEnabled && track1.bpm && track2.bpm) {
    bpmScore = calculateBPMScore(
      track1.bpm,
      track2.bpm,
      settings.smartCrossfadeBpmTolerance
    )
    
    if (bpmScore < 0.5) {
      warnings.push(`Large BPM difference: ${track1.bpm} → ${track2.bpm}`)
    }
  }
  
  if (settings.harmonicMixingEnabled && track1.key && track2.key) {
    keyScore = calculateKeyScore(track1.key, track2.key)
    
    const transitionType = detectTransitionType(track1.key, track2.key)
    if (transitionType === 'clash' && settings.harmonicMixingStrict) {
      warnings.push(`Key clash: ${track1.key} → ${track2.key}`)
      keyScore *= 0.5
    }
  }
  
  if (settings.energyMatchingEnabled && track1.energy && track2.energy) {
    energyScore = calculateEnergyScore(
      track1.energy,
      track2.energy,
      settings.energyMatchingTolerance
    )
    
    const energyDiff = Math.abs(track1.energy - track2.energy)
    if (energyDiff > 0.3) {
      warnings.push(`Large energy jump: ${track1.energy.toFixed(2)} → ${track2.energy.toFixed(2)}`)
    }
  }
  
  // Calculate overall score
  let overallScore = (bpmScore + keyScore + energyScore) / 3
  
  // Start with base settings
  let startNext = settings.crossfadeStartNext
  let fadeIn = settings.crossfadeFadeIn
  let fadeOut = settings.crossfadeFadeOut
  
  // Apply BPM adjustments
  if (settings.smartCrossfadeEnabled && settings.smartCrossfadeAutoAdjust && track1.bpm && track2.bpm) {
    const bpmDiff = Math.abs(track1.bpm - track2.bpm)
    const adjustment = adjustCrossfadeDuration(1.0, bpmDiff)
    
    startNext *= adjustment
    fadeIn *= adjustment
    fadeOut *= adjustment
  }
  
  // Apply energy adjustments
  if (settings.energyMatchingEnabled && settings.energyMatchingSmoothTransitions && track1.energy && track2.energy) {
    const energyDiff = Math.abs(track1.energy - track2.energy)
    const adjustment = adjustForEnergyJump(1.0, energyDiff, true)
    
    startNext *= adjustment
    fadeIn *= adjustment
    fadeOut *= adjustment
  }
  
  // Apply harmonic boost
  if (settings.harmonicMixingEnabled && track1.key && track2.key) {
    const boost = settings.harmonicMixingBoost
    startNext = applyHarmonicBoost(startNext, keyScore, boost)
    fadeIn = applyHarmonicBoost(fadeIn, keyScore, boost)
    fadeOut = applyHarmonicBoost(fadeOut, keyScore, boost)
  }
  
  // Apply conservative mode
  if (settings.crossfadeConservative) {
    const conservative = applyConservativeMode(startNext, fadeIn, fadeOut)
    startNext = conservative.startNext
    fadeIn = conservative.fadeIn
    fadeOut = conservative.fadeOut
  }
  
  // Clamp values to reasonable ranges
  startNext = Math.max(1.0, Math.min(10.0, startNext))
  fadeIn = Math.max(0.5, Math.min(10.0, fadeIn))
  fadeOut = Math.max(0.5, Math.min(10.0, fadeOut))
  
  // Determine quality
  let quality: 'excellent' | 'good' | 'acceptable' | 'poor'
  if (overallScore >= 0.8) quality = 'excellent'
  else if (overallScore >= 0.6) quality = 'good'
  else if (overallScore >= 0.4) quality = 'acceptable'
  else quality = 'poor'
  
  return {
    bpmScore,
    keyScore,
    energyScore,
    overallScore,
    recommendedCrossfade: {
      startNext: Math.round(startNext * 10) / 10,
      fadeIn: Math.round(fadeIn * 10) / 10,
      fadeOut: Math.round(fadeOut * 10) / 10
    },
    quality,
    warnings
  }
}

/**
 * Generate Liquidsoap crossfade configuration
 * @deprecated Use generateLiquidsoapConfig from liquidsoap-config-generator instead
 * This function is kept for backward compatibility but generates 2.0.2-compatible config
 */
export function generateLiquidsoapCrossfade(
  startNext: number,
  fadeIn: number,
  fadeOut: number,
  normalize: boolean
): string {
  // Use new generator for Liquidsoap 2.0.2 compatibility
  return generateLiquidsoapConfig({
    enabled: true,
    fadeIn,
    fadeOut,
    normalize,
    preset: 'custom'
  })
}

/**
 * Batch analyze playlist transitions
 */
export function analyzePlaylistTransitions(
  tracks: Track[],
  settings: CrossfadeSettings
): TransitionAnalysis[] {
  const analyses: TransitionAnalysis[] = []
  
  for (let i = 0; i < tracks.length - 1; i++) {
    const analysis = analyzeTransition(tracks[i], tracks[i + 1], settings)
    analyses.push(analysis)
  }
  
  return analyses
}

/**
 * Calculate average transition quality for playlist
 */
export function calculatePlaylistQuality(
  analyses: TransitionAnalysis[]
): { average: number; distribution: Record<string, number> } {
  if (analyses.length === 0) return { average: 0, distribution: {} }
  
  const sum = analyses.reduce((acc, a) => acc + a.overallScore, 0)
  const average = sum / analyses.length
  
  const distribution = analyses.reduce((acc, a) => {
    acc[a.quality] = (acc[a.quality] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  return { average, distribution }
}

export default {
  calculateBPMScore,
  calculateEnergyScore,
  adjustCrossfadeDuration,
  adjustForEnergyJump,
  applyHarmonicBoost,
  applyConservativeMode,
  analyzeTransition,
  generateLiquidsoapCrossfade,
  analyzePlaylistTransitions,
  calculatePlaylistQuality
}
