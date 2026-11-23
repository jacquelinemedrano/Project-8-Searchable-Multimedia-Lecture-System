# Speech recognition & transcription
# 1. FFmpeg pulls the audio track out of the uploaded video
# 2. Whisper (faster-whisper) turns that audio into text segments with timestamps
# 3. Each segment is paired with the slide that was on screen at that moment
import os
import shutil
import subprocess
import uuid

from .database import db
from .models import TranscriptSegment, Scene

# Whisper model size: tiny, base, small, medium, large-v3
# "base" is a good balance of speed and accuracy on a laptop CPU.
# Change it without editing code:  WHISPER_MODEL=small python run.py
DEFAULT_MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")

# Loading a Whisper model takes a few seconds, so we only load it once
_loaded_models = {}


class NoAudioError(Exception):
    """Raised when the uploaded video has no audio track to transcribe."""


# Check that FFmpeg is installed on this computer
def check_ffmpeg():
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise RuntimeError(
            "FFmpeg is not installed or not on PATH. "
            "Install it (e.g. 'brew install ffmpeg' or 'winget install ffmpeg')."
        )


# Use ffprobe to see whether the video has an audio track
def video_has_audio(video_path):
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-select_streams", "a",
            "-show_entries", "stream=index",
            "-of", "csv=p=0",
            video_path,
        ],
        capture_output=True,
        text=True,
    )
    return result.stdout.strip() != ""


# Extract the audio track from a video with FFmpeg
# Whisper expects 16 kHz, mono audio, so we convert to that here
def extract_audio(video_path, output_folder):
    check_ffmpeg()

    if not video_has_audio(video_path):
        raise NoAudioError(f"No audio track found in {video_path}")

    os.makedirs(output_folder, exist_ok=True)
    audio_path = os.path.join(output_folder, f"audio_{uuid.uuid4().hex}.wav")

    command = [
        "ffmpeg",
        "-y",                    # overwrite if the file already exists
        "-i", video_path,        # input video
        "-vn",                   # drop the video stream
        "-ac", "1",              # mono
        "-ar", "16000",          # 16 kHz sample rate
        "-c:a", "pcm_s16le",     # plain 16-bit WAV
        audio_path,
    ]

    result = subprocess.run(command, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg audio extraction failed: {result.stderr[-500:]}")

    return audio_path


# Load (or reuse) a Whisper model
def get_whisper_model(model_size=None):
    model_size = model_size or DEFAULT_MODEL_SIZE

    if model_size not in _loaded_models:
        # Imported here so the rest of the app still runs if Whisper isn't installed yet
        from faster_whisper import WhisperModel

        # int8 on CPU keeps memory low and runs fast on a normal laptop
        _loaded_models[model_size] = WhisperModel(
            model_size, device="cpu", compute_type="int8"
        )

    return _loaded_models[model_size]


# Transcribe an audio file into timestamped segments
def transcribe_audio(audio_path, model_size=None, language="en"):
    model = get_whisper_model(model_size)

    # vad_filter skips long silences so Whisper doesn't make up text for them
    segments, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=5,
        vad_filter=True,
    )

    transcript = []

    # segments is a generator: transcription actually happens while we loop
    for segment in segments:
        text = segment.text.strip()

        if text == "":
            continue

        transcript.append({
            "start_time": round(segment.start, 2),
            "end_time": round(segment.end, 2),
            "text": text,
        })

    return transcript


# Full pipeline: video -> audio -> timestamped transcript
def transcribe_video(video_path, work_folder, model_size=None, language="en"):
    audio_path = extract_audio(video_path, work_folder)

    try:
        return transcribe_audio(audio_path, model_size=model_size, language=language)
    finally:
        # The WAV file is only needed temporarily
        if os.path.exists(audio_path):
            os.remove(audio_path)


# Save transcript segments into the database
def save_transcript_to_database(lecture_id, segments):

    # Remove any old transcript for this lecture
    TranscriptSegment.query.filter_by(lecture_id=lecture_id).delete()

    for segment in segments:
        new_segment = TranscriptSegment()
        new_segment.lecture_id = lecture_id
        new_segment.start_time = segment["start_time"]
        new_segment.end_time = segment["end_time"]
        new_segment.text = segment["text"]
        db.session.add(new_segment)

    db.session.commit()


# Figure out which slide was on screen for a given moment in the video.
# Scenes are stored in order, and slide N is taken from scene N
# (see extract_slides_from_video), so the scene's position = slide number.
def find_slide_number(time_in_seconds, scenes):
    for slide_number, scene in enumerate(scenes, start=1):
        if scene["start_time"] <= time_in_seconds < scene["end_time"]:
            return slide_number

    # Past the last scene boundary: treat it as the last slide
    if scenes and time_in_seconds >= scenes[-1]["start_time"]:
        return len(scenes)

    return None


# Attach a slide number to every transcript segment.
# We use the middle of each segment, since a sentence can start
# just before a slide change and finish after it.
def pair_transcript_with_slides(segments, scenes):
    paired = []

    for segment in segments:
        midpoint = (segment["start_time"] + segment["end_time"]) / 2

        paired.append({
            **segment,
            "slide_number": find_slide_number(midpoint, scenes),
        })

    return paired


# Load a lecture's transcript from the database, paired with slides
def get_paired_transcript(lecture_id):
    segments = TranscriptSegment.query.filter_by(
        lecture_id=lecture_id
    ).order_by(TranscriptSegment.start_time).all()

    scenes = Scene.query.filter_by(
        lecture_id=lecture_id
    ).order_by(Scene.start_time).all()

    segment_list = [
        {
            "segment_id": s.segment_id,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "text": s.text,
        }
        for s in segments
    ]

    scene_list = [
        {"start_time": s.start_time, "end_time": s.end_time}
        for s in scenes
    ]

    return pair_transcript_with_slides(segment_list, scene_list)
