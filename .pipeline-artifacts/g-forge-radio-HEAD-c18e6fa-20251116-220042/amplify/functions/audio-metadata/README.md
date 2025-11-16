# Audio Metadata Lambda

## Purpose
Extracts basic metadata from audio files uploaded to S3 using ffprobe.

## Trigger
Automatically triggered when audio files are uploaded to `s3://bucket/public/audio/`

## What it extracts
- **File Info**: duration, fileSize, format, bitrate, sampleRate, channels, codec
- **ID3 Tags**: artist, title, album, year, genre
- **Technical**: MD5 checksum, analysis timestamp

## Dependencies
- ffprobe (included in AWS Lambda runtime)
- @aws-sdk/client-s3

## Event Format
```json
{
  "Records": [{
    "s3": {
      "bucket": { "name": "bucket-name" },
      "object": { "key": "public/audio/track.mp3" }
    }
  }]
}
```

## Output Format
```json
{
  "trackId": "uuid",
  "metadata": {
    "duration": 360,
    "fileSize": 12458496,
    "format": "mp3",
    "bitrate": 320000,
    "sampleRate": 44100,
    "channels": 2,
    "codec": "mp3",
    "artist": "Hollen",
    "title": "Vintage Time",
    "album": "Prospect Records",
    "year": 2023,
    "genre": "Techno",
    "checksum": "md5:abc123...",
    "analyzedAt": "2025-01-22T18:45:05Z"
  },
  "status": "success"
}
```

## Next Steps
This Lambda is the first in a chain. Future Lambdas will:
- Lambda 2: Audio Features (BPM, key, energy)
- Lambda 3: Cue Points & Structure
- Lambda 4: Waveform Generation
- Lambda 5: AI Classification
- Lambda 6: DJ Compatibility
- Lambda 7: Cover Art & Enrichment

## Testing
Upload an audio file to S3:
```bash
aws s3 cp test.mp3 s3://bucket/public/audio/test.mp3
```

Check CloudWatch Logs for Lambda execution.
