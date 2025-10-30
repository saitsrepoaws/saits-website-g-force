# SeekBar Component

Audio playback seekbar with drag, hover preview, and visual feedback.

## Usage

```tsx
import SeekBar from '@/components/SeekBar'

function MyPlayer() {
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  return (
    <SeekBar
      currentTime={currentTime}
      duration={duration}
      onSeek={handleSeek}
      className="mb-4"
    />
  )
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `currentTime` | `number` | ✅ | Current playback position in seconds |
| `duration` | `number` | ✅ | Total track duration in seconds |
| `onSeek` | `(time: number) => void` | ✅ | Callback when user seeks to new position |
| `className` | `string` | ❌ | Additional CSS classes |

## Features

### ✅ Drag to Seek
- Click and drag the seekbar to scrub through audio
- Smooth visual feedback during drag
- Thumb scales up when dragging

### ✅ Hover Preview
- Hover over seekbar to see timestamp preview
- Tooltip shows time at hover position
- Only visible when not dragging

### ✅ Visual Feedback
- Progress bar (gradient blue → purple)
- White thumb indicator
- Thumb grows and glows during drag
- Smooth transitions

### ✅ Time Display
- Current time (left)
- Total duration (right)
- Keyboard shortcuts hint (center)
- Format: `M:SS`

### ✅ Keyboard Shortcuts Hint
```
⌨️ ←/→: ±5s | Shift+←/→: ±30s
```
*Note: Keyboard handling is done by parent component*

## State Management

**Internal State:**
- `isDragging`: Boolean - tracks if user is currently dragging
- `hoverTime`: Number | null - timestamp at hover position
- `hoverPosition`: Number | null - pixel position of hover

**External State (props):**
- `currentTime`: Managed by parent
- `duration`: Managed by parent

## Styling

Uses TailwindCSS with:
- Gradient progress bar (`from-blue-400 to-purple-400`)
- Glass morphism backdrop effects
- Smooth transitions
- Responsive hover states
- Custom thumb indicator

## Event Handlers

### `handleSeek(e)`
- Calculates time from click position
- Calls `onSeek` callback with new time

### `handleSeekMouseDown(e)`
- Sets `isDragging` to true
- Initiates seek

### `handleSeekMouseMove(e)`
- Updates hover preview position
- If dragging, updates seek position

### `handleSeekMouseUp()`
- Clears `isDragging` state

### `handleSeekMouseLeave()`
- Clears hover preview state

## Accessibility

- ✅ Visual feedback for all interactions
- ✅ Cursor pointer on interactive area
- ✅ Clear time indicators
- ⚠️ **TODO:** Add ARIA labels
- ⚠️ **TODO:** Add keyboard navigation support

## Performance

- Minimal re-renders (self-contained state)
- CSS transitions (hardware accelerated)
- No expensive calculations
- Efficient event handlers

## Example: Advanced Usage

```tsx
// With custom styling
<SeekBar
  currentTime={currentTime}
  duration={duration}
  onSeek={handleSeek}
  className="mb-8 px-4"
/>

// In a multi-player setup
{players.map((player) => (
  <SeekBar
    key={player.id}
    currentTime={player.currentTime}
    duration={player.duration}
    onSeek={(time) => handlePlayerSeek(player.id, time)}
  />
))}
```

## Browser Compatibility

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ⚠️ Requires CSS transforms support
- ⚠️ Requires CSS gradients support

## Related Components

- **Players.tsx** - Main consumer
- **PlayerControls** - Companion control component (TODO)
- **TrackDisplay** - Shows current track info (TODO)

## Testing Checklist

- [ ] Click anywhere on bar → seeks to position
- [ ] Drag thumb → smooth seeking
- [ ] Hover → shows time preview tooltip
- [ ] Mouse leave → hides preview
- [ ] Progress bar updates during playback
- [ ] Time labels format correctly (M:SS)
- [ ] Works with 0 duration
- [ ] Works with very long tracks (>1 hour)

## Known Issues

None currently.

## Future Enhancements

- [ ] Add waveform visualization overlay
- [ ] Add buffered regions indicator
- [ ] Add chapter markers support
- [ ] Touch/mobile gesture support
- [ ] ARIA labels for accessibility
- [ ] Keyboard focus and navigation

## Dependencies

- React 18+
- TailwindCSS 3+
- TypeScript 5+

## Size

- **Lines:** 115
- **Bundle:** ~2KB (minified)
- **No external deps** (besides React)
