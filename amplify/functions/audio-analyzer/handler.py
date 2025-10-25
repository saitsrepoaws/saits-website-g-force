"""
AWS Lambda handler for audio analysis using librosa
Analyzes BPM and Key from audio files in S3
"""
import json
import os
import tempfile
import boto3
import aubio
import numpy as np
from pydub import AudioSegment
from typing import Dict, Optional, Tuple

# Initialize AWS clients
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# Musical key mapping (Pitch Class to Key) 
KEY_MAPPING = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

def lambda_handler(event, context):
    """
    Main Lambda handler
    Expected event: { trackId, s3Key, bucket }
    """
    try:
        print(f"🎵 Audio Analyzer Lambda (Python + Librosa) triggered")
        print(f"📦 Event: {json.dumps(event)}")
        
        track_id = event['trackId']
        s3_key = event['s3Key']
        bucket = event['bucket']
        
        # Download audio from S3
        print(f"📥 Downloading from S3: {bucket}/{s3_key}")
        temp_file = download_from_s3(bucket, s3_key)
        
        # Analyze audio
        print("🔍 Analyzing audio with aubio...")
        bpm, key, trim_start, trim_end = analyze_audio_aubio(temp_file)
        
        # Update DynamoDB
        if trim_start is not None and trim_end is not None:
            print(f"💾 Updating track {track_id} with BPM={bpm}, Key={key}, Trim={trim_start:.2f}s-{trim_end:.2f}s")
        else:
            print(f"💾 Updating track {track_id} with BPM={bpm}, Key={key}")
        update_track_metadata(track_id, bpm, key, trim_start, trim_end)
        
        # Cleanup
        os.unlink(temp_file)
        
        print(f"✅ Audio analysis complete: BPM={bpm}, Key={key}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'trackId': track_id,
                'analysis': {
                    'bpm': bpm,
                    'key': key,
                    'trimStart': trim_start,
                    'trimEnd': trim_end
                }
            })
        }
        
    except Exception as error:
        print(f"❌ Error: {str(error)}")
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(error)
            })
        }


def download_from_s3(bucket: str, key: str) -> str:
    """Download file from S3 to temporary location"""
    _, ext = os.path.splitext(key)
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    
    s3_client.download_file(bucket, key, temp_file.name)
    print(f"✅ Downloaded to {temp_file.name}")
    
    return temp_file.name


def analyze_audio_aubio(filepath: str) -> Tuple[int, Optional[str], Optional[float], Optional[float]]:
    """
    Analyze audio file using aubio (C-based, fast, no numba!)
    Returns: (bpm, key, trim_start, trim_end)
    """
    try:
        # Convert to WAV if needed (aubio works best with WAV)
        print(f"📂 Loading audio file...")
        wav_path = convert_to_wav(filepath)
        
        # BPM Detection
        print("🥁 Detecting BPM with aubio...")
        bpm = detect_bpm_aubio(wav_path)
        print(f"✅ BPM detected: {bpm}")
        
        # Key Detection
        print("🎹 Detecting musical key with aubio...")
        key = detect_key_aubio(wav_path)
        print(f"✅ Key detected: {key}")
        
        # Trim Detection (silence at start/end)
        print("✂️ Detecting trim points (silence removal)...")
        trim_start, trim_end = detect_trim_points(filepath)
        if trim_start is not None and trim_end is not None:
            print(f"✅ Trim points: Start={trim_start:.2f}s, End={trim_end:.2f}s")
        else:
            print("⚠️ Trim detection failed, using full duration")
        
        # Cleanup temp WAV if created
        if wav_path != filepath:
            os.unlink(wav_path)
        
        return bpm, key, trim_start, trim_end
        
    except Exception as e:
        print(f"❌ Aubio analysis failed: {e}")
        import traceback
        traceback.print_exc()
        return 0, None, None, None


def convert_to_wav(filepath: str) -> str:
    """Convert audio file to WAV format using pydub"""
    try:
        if filepath.endswith('.wav'):
            return filepath
            
        print(f"   Converting to WAV...")
        audio = AudioSegment.from_file(filepath)
        
        wav_path = filepath.rsplit('.', 1)[0] + '.wav'
        audio.export(wav_path, format='wav')
        print(f"   ✅ Converted to WAV")
        
        return wav_path
    except Exception as e:
        print(f"   ⚠️ WAV conversion failed: {e}, using original")
        return filepath


def detect_bpm_aubio(filepath: str) -> int:
    """
    Detect BPM using aubio tempo detection (C-based, fast!)
    """
    try:
        # Aubio tempo detector
        win_s = 512  # FFT size
        hop_s = win_s // 2  # Hop size
        
        source = aubio.source(filepath, 0, hop_s)
        samplerate = source.samplerate
        
        tempo_detector = aubio.tempo("default", win_s, hop_s, samplerate)
        
        # Process audio
        beats = []
        total_frames = 0
        
        while True:
            samples, read = source()
            is_beat = tempo_detector(samples)
            if is_beat:
                beats.append(tempo_detector.get_last_s())
            total_frames += read
            if read < hop_s:
                break
        
        # Get BPM
        bpm = int(round(tempo_detector.get_bpm()))
        
        # Sanity check
        if bpm < 60:
            bpm = bpm * 2
        elif bpm > 200:
            bpm = bpm // 2
            
        print(f"   Aubio tempo: {bpm} BPM ({len(beats)} beats detected)")
        return bpm if bpm > 0 else 120  # Default to 120 if detection fails
        
    except Exception as e:
        print(f"   ❌ BPM detection error: {e}")
        return 120  # Default BPM


def detect_key_aubio(filepath: str) -> Optional[str]:
    """
    Detect musical key using aubio notes detector
    """
    try:
        # Aubio notes detector
        win_s = 4096
        hop_s = win_s // 4
        
        source = aubio.source(filepath, 0, hop_s)
        samplerate = source.samplerate
        
        notes_detector = aubio.notes("default", win_s, hop_s, samplerate)
        
        # Collect notes
        pitch_classes = [0] * 12
        
        while True:
            samples, read = source()
            note = notes_detector(samples)
            if note[0] != 0:  # If note detected
                midi_note = int(note[0])
                pitch_class = midi_note % 12
                pitch_classes[pitch_class] += 1
            if read < hop_s:
                break
        
        # Find dominant pitch class
        if sum(pitch_classes) == 0:
            return None
            
        key_index = pitch_classes.index(max(pitch_classes))
        key_note = KEY_MAPPING[key_index]
        
        # Simple major/minor heuristic
        # Check if 3rd and 5th are strong (major) or flat 3rd (minor)
        third_major = (key_index + 4) % 12
        third_minor = (key_index + 3) % 12
        
        if pitch_classes[third_major] > pitch_classes[third_minor]:
            scale = "major"
        else:
            scale = "minor"
        
        key = f"{key_note} {scale}"
        print(f"   Aubio key analysis: {key}")
        
        return key
        
    except Exception as e:
        print(f"   ❌ Key detection error: {e}")
        return None


def detect_trim_points(filepath: str, threshold_db: float = -40.0, min_silence_ms: int = 500) -> Tuple[Optional[float], Optional[float]]:
    """
    Detect trim points (start/end) based on dB level gate detection
    
    Args:
        filepath: Path to audio file
        threshold_db: dB threshold below which is considered silence (default: -40 dB)
        min_silence_ms: Minimum silence duration in milliseconds (default: 500ms)
    
    Returns:
        (trim_start, trim_end) in seconds, or (None, None) if detection fails
    """
    try:
        # Load audio with pydub
        audio = AudioSegment.from_file(filepath)
        
        # Get duration in seconds
        duration_s = len(audio) / 1000.0
        
        # Split into chunks for analysis (100ms chunks)
        chunk_length_ms = 100
        chunks = [audio[i:i+chunk_length_ms] for i in range(0, len(audio), chunk_length_ms)]
        
        # Find first non-silent chunk (trim start)
        trim_start = None
        for i, chunk in enumerate(chunks):
            if chunk.dBFS > threshold_db:
                # Found audio above threshold
                # Go back a bit to include attack
                trim_start = max(0, (i * chunk_length_ms - min_silence_ms)) / 1000.0
                break
        
        # Find last non-silent chunk (trim end)
        trim_end = None
        for i, chunk in enumerate(reversed(chunks)):
            if chunk.dBFS > threshold_db:
                # Found audio above threshold
                # Go forward a bit to include release
                reverse_idx = len(chunks) - i - 1
                trim_end = min(duration_s, ((reverse_idx + 1) * chunk_length_ms + min_silence_ms)) / 1000.0
                break
        
        # Validation
        if trim_start is None:
            trim_start = 0.0
        if trim_end is None:
            trim_end = duration_s
            
        # Ensure trim_end > trim_start
        if trim_end <= trim_start:
            print(f"   ⚠️ Invalid trim points detected, using full duration")
            return 0.0, duration_s
        
        trim_duration = trim_end - trim_start
        print(f"   ✂️ Silence detected: {trim_start:.2f}s intro, {(duration_s - trim_end):.2f}s outro")
        print(f"   🎵 Actual audio duration: {trim_duration:.2f}s (from {duration_s:.2f}s total)")
        
        return trim_start, trim_end
        
    except Exception as e:
        print(f"   ❌ Trim detection error: {e}")
        return None, None


def update_track_metadata(track_id: str, bpm: int, key: Optional[str], trim_start: Optional[float] = None, trim_end: Optional[float] = None):
    """Update track in DynamoDB with analysis results"""
    table_name = os.environ.get('TRACK_TABLE_NAME')
    if not table_name:
        raise Exception('TRACK_TABLE_NAME not configured')
    
    table = dynamodb.Table(table_name)
    
    # Build update expression dynamically
    update_parts = ['bpm = :bpm', '#key = :key']
    attr_names = {'#key': 'key'}
    attr_values = {':bpm': bpm, ':key': key}
    
    # Add trim points if available
    if trim_start is not None:
        update_parts.append('trimStart = :trimStart')
        attr_values[':trimStart'] = trim_start
    
    if trim_end is not None:
        update_parts.append('trimEnd = :trimEnd')
        attr_values[':trimEnd'] = trim_end
    
    update_expression = 'SET ' + ', '.join(update_parts)
    
    # Don't set updatedAt manually - let Amplify/AppSync handle it automatically
    table.update_item(
        Key={'id': track_id},
        UpdateExpression=update_expression,
        ExpressionAttributeNames=attr_names,
        ExpressionAttributeValues=attr_values
    )
    
    print(f"✅ Track {track_id} updated in DynamoDB")
