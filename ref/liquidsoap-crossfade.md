# Liquidsoap Crossfade Documentation

**Source**: https://www.liquidsoap.info/doc-dev/crossfade.html

---

# Crossfade

## Out of the box

Out of the box Liquidsoap provides a default crossfade operator out of the box. It is a simple operator that does the work and does it well!

```liquidsoap
crossfade
```

Over the years, we have realized that crossfading is a very sensitive topic and that people care a lot about specific details and how well it is done.

Since release **2.2.5**, liquidsoap integrates an automated mechanism to compute crossfade transitions that was contributed by our users.

If you have the `ffmpeg` bindings enabled, all you should need to do to enable this feature is adding the following to your script:

```liquidsoap
enable_autocue_metadata()
```

This uses the default, internal implementation. If you want more control over the automated crossfade parameters, you can check out the external [autocue](https://github.com/Moonbase59/autocue) implementation and its associated documentation.

---

## Custom crossfades

You can also define your own crossfade transitions if you want to be more specific about them! The base `cross` operator accepts a scripted transition function that, according to the average volume level (in dB) computed on the end of the ending track and the beginning of the new one, returns the transition that is desired.

You can find its documentation in the [language reference](https://www.liquidsoap.info/doc-dev/reference.html).

Here's an example:

```liquidsoap
# Smart transition for crossfade
# @category Source / Fade
# @param ~fade_in Fade-in duration, if any.
# @param ~fade_out Fade-out duration, if any.
# @param ~high Value, in dB, for loud sound level.
# @param ~medium Value, in dB, for medium sound level.
# @param ~margin Margin to detect sources that have too different sound level for crossing.
# @param ~default Smart crossfade: transition used when no rule applies (default: sequence).
# @param a Ending track
# @param b Starting track
def cross.smart(
  ~id=null,
  ~fade_in=3.,
  ~fade_out=3.,
  ~default=(fun (a, b) -> (sequence([a, b]) : source)),
  ~high=-15.,
  ~medium=-32.,
  ~margin=4.,
  a,
  b
) =
  id = string.id.default(default="crossfade", id)
  
  def log(~level=3, x) =
    log(label=id, level=level, x)
  end
  
  let fade.out = fun (s) -> fade.out(type="sin", duration=fade_out, s)
  let fade.in = fun (s) -> fade.in(type="sin", duration=fade_in, s)
  add = fun (a, b) -> add(normalize=false, [b, a])
  
  # This is for the type system..
  ignore(a.metadata["foo"])
  ignore(b.metadata["foo"])
  
  if
    # If A and B are not too loud and close, fully cross-fade them.
    a.db_level <= medium
    and b.db_level <= medium
    and abs(a.db_level - b.db_level) <= margin
  then
    log("Old <= medium, new <= medium and |old-new| <= margin.")
    log("Old and new source are not too loud and close.")
    log("Transition: crossed, fade-in, fade-out.")
    add(fade.out(a.source), fade.in(b.source))
    
  elsif
    # If B is significantly louder than A, only fade-out A.
    # We don't want to fade almost silent things, ask for >medium.
    b.db_level >= a.db_level + margin
    and a.db_level >= medium
    and b.db_level <= high
  then
    log("new >= old + margin, old >= medium and new <= high.")
    log("New source is significantly louder than old one.")
    log("Transition: crossed, fade-out.")
    add(fade.out(a.source), b.source)
    
  elsif
    # Opposite as the previous one.
    a.db_level >= b.db_level + margin
    and b.db_level >= medium
    and a.db_level <= high
  then
    log("old >= new + margin, new >= medium and old <= high")
    log("Old source is significantly louder than new one.")
    log("Transition: crossed, fade-in.")
    add(a.source, fade.in(b.source))
    
  elsif
    # Do not fade if it's already very low.
    b.db_level >= a.db_level + margin
    and a.db_level <= medium
    and b.db_level <= high
  then
    log("new >= old + margin, old <= medium and new <= high.")
    log("Do not fade if it's already very low.")
    log("Transition: crossed, no fade.")
    add(a.source, b.source)
    
  # What to do with a loud end and a quiet beginning ?
  # A good idea is to use a jingle to separate the two tracks,
  # but that's another story.
  else
    # Otherwise, A and B are just too loud to overlap nicely, or the
    # difference between them is too large and overlapping would completely
    # mask one of them.
    log("No transition: using default.")
    default(a.source, b.source)
  end
end
```

---

## Key Concepts

### Simple Crossfade
The basic `crossfade` operator is the simplest way to add crossfading to your stream.

### Smart Crossfade (cross.smart)
The smart crossfade function makes intelligent decisions based on:

**Parameters:**
- `fade_in` - Fade-in duration (default: 3.0s)
- `fade_out` - Fade-out duration (default: 3.0s)
- `high` - dB threshold for loud sound level (default: -15 dB)
- `medium` - dB threshold for medium sound level (default: -32 dB)
- `margin` - dB margin to detect sources with different levels (default: 4 dB)

**Transition Logic:**

1. **Both tracks quiet and similar** (`a.db_level <= medium` AND `b.db_level <= medium` AND `abs(a-b) <= margin`)
   - → Full crossfade with fade-in and fade-out

2. **New track louder** (`b.db_level >= a.db_level + margin`)
   - → Fade-out old track only

3. **Old track louder** (`a.db_level >= b.db_level + margin`)
   - → Fade-in new track only

4. **Old track very quiet** (`a.db_level <= medium`)
   - → No fade, just overlap

5. **Tracks too loud or different**
   - → Use default transition (sequence)

### Autocue Integration (2.2.5+)
```liquidsoap
enable_autocue_metadata()
```

Automatically computes optimal crossfade points using FFmpeg analysis.

---

## Notes from EC2 Testing

**Liquidsoap Version on EC2**: 2.0.2

**Issue**: The newer parameter syntax doesn't work:
```liquidsoap
# ❌ Doesn't work in 2.0.2:
radio = crossfade(start_next=3.0, fade_in=2.0, fade_out=2.0, radio)
```

**Error**: 
```
Error 6: Cannot apply that parameter because the function
has no argument labeled "start_next"!
```

**Solution for 2.0.2**: Use simple crossfade or cross operator with custom function.

```liquidsoap
# ✅ Works in 2.0.2:
radio = crossfade(radio)

# Or use cross.smart with the function above
```

---

## Implementation Status

- ✅ Lambda analysis generates crossfade config
- ✅ S3 storage for config
- ✅ Smart analysis (BPM, Key, Energy)
- ❌ EC2 Liquidsoap integration (version mismatch)
- ⏳ Dynamic config reload (planned)

**Recommendation**: Upgrade EC2 Liquidsoap to 2.2.5+ for full autocue support.
