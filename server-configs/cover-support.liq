#!/usr/bin/liquidsoap

# COVER ART SUPPORT - Simple version
# For now, just log that cover support is ready
# Will be enhanced when M3U has proper metadata

def add_cover_metadata(m) =
  # For now, just pass through
  # TODO: Read /var/radio/covers-map.json when available
  m
end

# Apply to radio
radio = map_metadata(add_cover_metadata, radio)

print("✅ Cover art support loaded (basic)")
