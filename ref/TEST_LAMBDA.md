# Test Lambda 1: Audio Metadata Extraction

## ✅ Lambda is gedeployed!

De Lambda is nu live en wordt automatisch getriggerd wanneer je een audio file upload naar S3.

## 🧪 Hoe te testen:

### Optie 1: Via de Libery UI (Makkelijkst)
1. **Hard refresh** de browser (Cmd+Shift+R)
2. Ga naar **Libery** pagina
3. Klik **"+ Add Tracks"**
4. Selecteer een MP3 file
5. Klik **"Upload X Track(s)"**
6. Wacht tot upload compleet is

**Wat gebeurt er:**
- File wordt geüpload naar `s3://bucket/public/audio/xxx.mp3`
- Lambda wordt automatisch getriggerd
- Lambda download file, extract metadata met ffprobe
- Lambda logt output naar CloudWatch

### Optie 2: Check CloudWatch Logs
1. Ga naar AWS Console
2. CloudWatch → Log Groups
3. Zoek: `/aws/lambda/audio-metadata-...`
4. Bekijk laatste log stream

**Wat je zou moeten zien:**
```
Event: { "Records": [{ "s3": { "object": { "key": "public/audio/xxx.mp3" }}}]}
Downloading public/audio/xxx.mp3 from bucket amplify-...
Downloaded to /tmp/xxx.mp3
Extracting metadata from /tmp/xxx.mp3
Extracted metadata: {
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
}
```

### Optie 3: Test met AWS CLI (Advanced)
```bash
# Upload een test file
aws s3 cp test.mp3 s3://YOUR-BUCKET-NAME/public/audio/test.mp3

# Check Lambda logs
aws logs tail /aws/lambda/audio-metadata-... --follow
```

## 📊 Verwachte Output

De Lambda extract deze metadata:

### File Info
- ✅ Duration (seconds)
- ✅ File size (bytes)
- ✅ Format (mp3, flac, wav)
- ✅ Bitrate (kbps)
- ✅ Sample rate (Hz)
- ✅ Channels (1=mono, 2=stereo)
- ✅ Codec

### ID3 Tags
- ✅ Artist
- ✅ Title
- ✅ Album
- ✅ Year
- ✅ Genre

### Technical
- ✅ MD5 Checksum
- ✅ Analysis timestamp

## 🐛 Troubleshooting

### Lambda niet getriggerd?
- Check of file in `public/audio/` folder staat
- Check S3 event notifications in AWS Console
- Check Lambda permissions

### Geen metadata?
- Check of ffprobe beschikbaar is in Lambda runtime
- Check CloudWatch logs voor errors
- Verify file is valid audio format

### Permission errors?
- Lambda heeft S3 read permissions nodig
- Check IAM role van Lambda

## ✅ Success Criteria

Lambda werkt als:
1. ✅ File upload triggert Lambda
2. ✅ Lambda download file van S3
3. ✅ ffprobe extract metadata
4. ✅ Output bevat duration, bitrate, artist, title
5. ✅ Geen errors in CloudWatch logs

## 🚀 Volgende Stappen

Als Lambda 1 werkt, kunnen we bouwen:
- **Lambda 2**: BPM & Key Detection
- **Lambda 3**: Cue Points & Hot Cues
- **Lambda 4**: Waveform Generation
- **Lambda 7**: Cover Art & Enrichment

---

**Test het nu en laat me weten wat je ziet!** 🎵
