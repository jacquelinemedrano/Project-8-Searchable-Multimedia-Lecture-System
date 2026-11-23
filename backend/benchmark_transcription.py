# Time FFmpeg + Whisper on a lecture video for the presentation's speed numbers.
#
# Usage (from the backend folder):
#   python benchmark_transcription.py path/to/lecture.mp4
#   python benchmark_transcription.py path/to/lecture.mp4 tiny base small
#
# "Real-time factor" = processing time / video length.
# 0.25x means a 20-minute lecture takes about 5 minutes to transcribe.
import json
import os
import sys
import tempfile
import time
import wave

from app.transcription import extract_audio, transcribe_audio


def main():
    if len(sys.argv) < 2:
        print(__doc__ or "Usage: python benchmark_transcription.py VIDEO [model sizes...]")
        sys.exit(1)

    video_path = sys.argv[1]
    model_sizes = sys.argv[2:] or ["tiny", "base"]

    with tempfile.TemporaryDirectory() as work:
        start = time.perf_counter()
        audio_path = extract_audio(video_path, work)
        ffmpeg_seconds = time.perf_counter() - start

        with wave.open(audio_path) as wav:
            audio_length = wav.getnframes() / wav.getframerate()

        print(f"Audio length:      {audio_length:.1f} s")
        print(f"FFmpeg extraction: {ffmpeg_seconds:.2f} s\n")

        for size in model_sizes:
            start = time.perf_counter()
            segments = transcribe_audio(audio_path, model_size=size)
            seconds = time.perf_counter() - start

            print(f"Whisper {size:<8} {seconds:6.1f} s  "
                  f"({seconds / audio_length:.2f}x real time, {len(segments)} segments)")

            # Save the transcript so you can check accuracy by reading it
            out_file = f"transcript_{size}.json"
            with open(out_file, "w") as f:
                json.dump(segments, f, indent=2)
            print(f"  saved {os.path.abspath(out_file)}")


if __name__ == "__main__":
    main()
