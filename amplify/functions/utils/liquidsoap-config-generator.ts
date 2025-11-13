/**
 * Liquidsoap Configuration Generator
 * 
 * Generates Liquidsoap 2.0.2 compatible crossfade configuration
 * based on UI settings from StreamSettings page.
 * 
 * Compatible with: Liquidsoap 2.0.2 (EC2)
 * Target file: /opt/radio/crossfade-dynamic.liq
 */

export interface CrossfadeSettings {
  enabled: boolean
  fadeIn: number
  fadeOut: number
  normalize: boolean
  preset: string
}

/**
 * Generate Liquidsoap crossfade configuration
 * @param settings Crossfade settings from UI/DynamoDB
 * @returns Liquidsoap config string
 */
export function generateLiquidsoapConfig(settings: CrossfadeSettings): string {
  const timestamp = new Date().toISOString()
  const duration = Math.max(settings.fadeIn, settings.fadeOut) + 2
  
  // If crossfade is disabled, return minimal config
  if (!settings.enabled) {
    return `# Crossfade Configuration (UI-Controlled)
# Generated: ${timestamp}
# Status: DISABLED

# No crossfade applied - tracks will play sequentially
# Enable crossfade in StreamSettings to activate smooth transitions
`
  }
  
  // Generate full crossfade config
  return `# Crossfade Configuration (UI-Controlled)
# Generated: ${timestamp}
# Preset: ${settings.preset}
# Compatible with: Liquidsoap 2.0.2

# =============================================================================
# UI SETTINGS
# =============================================================================
# Fade In:    ${settings.fadeIn}s
# Fade Out:   ${settings.fadeOut}s
# Normalize:  ${settings.normalize ? 'Enabled' : 'Disabled'}
# Duration:   ${duration}s (calculated)
# =============================================================================

# Custom crossfade transition function
# This function is called for each track transition
# Parameters:
#   a = ending track (with metadata and source)
#   b = starting track (with metadata and source)
def ui_crossfade_transition(a, b) =
  # Fade durations from StreamSettings UI
  fade_in_duration = ${settings.fadeIn}
  fade_out_duration = ${settings.fadeOut}
  
  # Apply smooth sine-curve fades
  # Sine provides the most natural-sounding transition
  a = fade.out(duration=fade_out_duration, type="sin", a)
  b = fade.in(duration=fade_in_duration, type="sin", b)
  
  # Mix both sources without additional normalization
  # (Normalization is applied separately if enabled)
  add(normalize=false, [a, b])
end

# Apply crossfade to radio source
# Note: The 'radio' variable must be defined before this %include
# Duration should be long enough to contain both fades
radio = cross(
  duration=${duration}.0,
  ui_crossfade_transition,
  radio
)

${settings.normalize ? `# Normalize audio levels to consistent volume
# Target: -14 dBFS (broadcast standard)
radio = normalize(target=-14.0, radio)` : '# Normalization disabled per UI settings'}

# End of UI-generated crossfade configuration
# To modify these settings, update StreamSettings in the web UI
`
}

/**
 * Validate crossfade settings
 * @param settings Settings to validate
 * @returns Validation errors (empty array if valid)
 */
export function validateCrossfadeSettings(settings: CrossfadeSettings): string[] {
  const errors: string[] = []
  
  if (settings.fadeIn < 0 || settings.fadeIn > 10) {
    errors.push('Fade-in duration must be between 0 and 10 seconds')
  }
  
  if (settings.fadeOut < 0 || settings.fadeOut > 10) {
    errors.push('Fade-out duration must be between 0 and 10 seconds')
  }
  
  // Allow fadeIn=0 for instant "hit" transitions
  // Only error if both are 0 (which would be a hard cut with no crossfade at all)
  if (settings.fadeIn === 0 && settings.fadeOut === 0) {
    errors.push('At least fade-out should be greater than 0 for smooth transitions')
  }
  
  const validPresets = ['cut', 'djblend', 'techno', 'progressive', 'ambient', 'hardcore', 'custom']
  if (!validPresets.includes(settings.preset)) {
    errors.push(`Invalid preset: ${settings.preset}. Must be one of: ${validPresets.join(', ')}`)
  }
  
  return errors
}

/**
 * Get preset configuration
 * @param preset Preset name
 * @returns Crossfade settings for preset
 */
export function getPresetSettings(preset: string): Partial<CrossfadeSettings> {
  const presets: Record<string, Partial<CrossfadeSettings>> = {
    techno: {
      fadeIn: 2.0,
      fadeOut: 2.0,
      normalize: true
    },
    progressive: {
      fadeIn: 4.0,
      fadeOut: 4.0,
      normalize: true
    },
    ambient: {
      fadeIn: 6.0,
      fadeOut: 6.0,
      normalize: true
    },
    hardcore: {
      fadeIn: 1.0,
      fadeOut: 1.0,
      normalize: true
    },
    custom: {
      fadeIn: 3.0,
      fadeOut: 3.0,
      normalize: true
    }
  }
  
  return presets[preset] || presets.custom
}

/**
 * Generate fallback configuration (for errors)
 * @returns Safe default Liquidsoap config
 */
export function generateFallbackConfig(): string {
  return `# Crossfade Configuration (FALLBACK)
# Generated: ${new Date().toISOString()}
# Status: Using safe defaults due to error

# Simple crossfade with default settings
radio = crossfade(radio)
radio = normalize(radio)

# Contact system administrator if this persists
`
}
