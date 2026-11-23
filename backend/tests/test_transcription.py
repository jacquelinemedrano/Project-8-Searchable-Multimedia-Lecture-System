import io
import shutil
import subprocess
import wave
from types import SimpleNamespace

import pytest

from app import create_app
from app.database import db
from app.models import Lecture, Scene, TranscriptSegment
from app import transcription
from app.transcription import (
    NoAudioError,
    extract_audio,
    transcribe_audio,
    find_slide_number,
    pair_transcript_with_slides,
    save_transcript_to_database,
)

ffmpeg_installed = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None
needs_ffmpeg = pytest.mark.skipif(not ffmpeg_installed, reason="FFmpeg not installed")


# ---------- fixtures ----------

@pytest.fixture
def app(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
        "UPLOAD_FOLDER": str(tmp_path / "uploads"),
    })

    with app.app_context():
        db.drop_all()
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


# Make a short test video with FFmpeg (a tone + a blue screen)
def make_test_video(path, with_audio=True, seconds=3):
    command = ["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c=blue:s=320x240:d={seconds}"]

    if with_audio:
        command += ["-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}", "-shortest"]

    command += ["-pix_fmt", "yuv420p", str(path)]
    subprocess.run(command, capture_output=True, check=True)
    return str(path)


# Add a lecture with 3 scenes (= 3 slides) and a few transcript lines
def add_sample_lecture():
    lecture = Lecture(title="Sample", video_path="/test/video.mp4")
    db.session.add(lecture)
    db.session.commit()

    for start, end in [(0.0, 10.0), (10.0, 20.0), (20.0, 30.0)]:
        scene = Scene()
        scene.lecture_id = lecture.lecture_id
        scene.start_time = start
        scene.end_time = end
        db.session.add(scene)

    db.session.commit()

    save_transcript_to_database(lecture.lecture_id, [
        {"start_time": 1.0, "end_time": 4.0, "text": "Today we cover binary trees."},
        {"start_time": 12.0, "end_time": 15.0, "text": "A heap is a special tree."},
        {"start_time": 22.0, "end_time": 26.0, "text": "Binary search runs in log n time."},
    ])

    return lecture.lecture_id


# ---------- FFmpeg audio extraction ----------

@needs_ffmpeg
def test_extract_audio_makes_16k_mono_wav(tmp_path):
    video = make_test_video(tmp_path / "lecture.mp4", with_audio=True)

    audio_path = extract_audio(video, str(tmp_path / "work"))

    with wave.open(audio_path) as wav:
        assert wav.getframerate() == 16000
        assert wav.getnchannels() == 1
        duration = wav.getnframes() / wav.getframerate()
        assert 2.5 < duration < 3.5


@needs_ffmpeg
def test_extract_audio_with_no_audio_track(tmp_path):
    video = make_test_video(tmp_path / "silent.mp4", with_audio=False)

    with pytest.raises(NoAudioError):
        extract_audio(video, str(tmp_path / "work"))


# ---------- Whisper transcription (model is faked so tests run offline) ----------

def test_transcribe_audio_formats_segments(monkeypatch):
    fake_segments = [
        SimpleNamespace(start=0.0, end=2.345, text="  Hello class.  "),
        SimpleNamespace(start=2.345, end=3.0, text="   "),  # empty -> skipped
        SimpleNamespace(start=3.0, end=6.789, text=" Let's begin."),
    ]
    fake_model = SimpleNamespace(transcribe=lambda *a, **k: (iter(fake_segments), None))
    monkeypatch.setattr(transcription, "get_whisper_model", lambda model_size=None: fake_model)

    result = transcribe_audio("fake.wav")

    assert result == [
        {"start_time": 0.0, "end_time": 2.35, "text": "Hello class."},
        {"start_time": 3.0, "end_time": 6.79, "text": "Let's begin."},
    ]


# ---------- pairing transcript with slides ----------

def test_find_slide_number():
    scenes = [
        {"start_time": 0.0, "end_time": 10.0},
        {"start_time": 10.0, "end_time": 20.0},
    ]

    assert find_slide_number(5.0, scenes) == 1
    assert find_slide_number(10.0, scenes) == 2
    assert find_slide_number(25.0, scenes) == 2   # after the last boundary
    assert find_slide_number(5.0, []) is None     # no scenes detected


def test_pair_uses_segment_midpoint():
    scenes = [
        {"start_time": 0.0, "end_time": 10.0},
        {"start_time": 10.0, "end_time": 20.0},
    ]
    # starts on slide 1 but is mostly said over slide 2
    segments = [{"start_time": 9.0, "end_time": 14.0, "text": "crossing"}]

    assert pair_transcript_with_slides(segments, scenes)[0]["slide_number"] == 2


# ---------- API endpoints ----------

def test_get_transcript(client, app):
    with app.app_context():
        lecture_id = add_sample_lecture()

    response = client.get(f"/api/lectures/{lecture_id}/transcript")

    assert response.status_code == 200
    data = response.get_json()
    assert data["segment_count"] == 3
    assert [s["slide_number"] for s in data["segments"]] == [1, 2, 3]
    assert data["segments"][0]["text"] == "Today we cover binary trees."


def test_transcript_not_found(client):
    assert client.get("/api/lectures/999999/transcript").status_code == 404


def test_search_is_case_insensitive(client, app):
    with app.app_context():
        lecture_id = add_sample_lecture()

    response = client.get(f"/api/lectures/{lecture_id}/search?q=BINARY")

    assert response.status_code == 200
    data = response.get_json()
    assert data["match_count"] == 2
    assert [m["start_time"] for m in data["matches"]] == [1.0, 22.0]
    assert [m["slide_number"] for m in data["matches"]] == [1, 3]


def test_search_no_matches(client, app):
    with app.app_context():
        lecture_id = add_sample_lecture()

    data = client.get(f"/api/lectures/{lecture_id}/search?q=quantum").get_json()

    assert data["match_count"] == 0
    assert data["matches"] == []


def test_search_requires_query(client, app):
    with app.app_context():
        lecture_id = add_sample_lecture()

    assert client.get(f"/api/lectures/{lecture_id}/search?q=").status_code == 400


def test_search_lecture_not_found(client):
    assert client.get("/api/lectures/999999/search?q=tree").status_code == 404


def test_saving_transcript_replaces_old_one(app):
    with app.app_context():
        lecture_id = add_sample_lecture()

        save_transcript_to_database(lecture_id, [
            {"start_time": 0.0, "end_time": 1.0, "text": "New transcript."}
        ])

        assert TranscriptSegment.query.filter_by(lecture_id=lecture_id).count() == 1


# ---------- upload route reports transcription status ----------

@needs_ffmpeg
def test_upload_silent_video_reports_no_audio(client, tmp_path, monkeypatch):
    monkeypatch.setattr("app.routes.detect_video_scenes", lambda video_path, threshold=12.0: [])
    monkeypatch.setattr("app.routes.extract_slides_from_video", lambda **kwargs: [])

    video = make_test_video(tmp_path / "silent.mp4", with_audio=False)

    with open(video, "rb") as f:
        response = client.post(
            "/api/lectures/uploads",
            data={"video": (io.BytesIO(f.read()), "silent.mp4")},
            content_type="multipart/form-data",
        )

    assert response.status_code == 201
    assert response.get_json()["transcription_status"] == "no_audio"
