import pytest
from app import create_app
from app.database import db
from app.models import Lecture, Scene, Slide, TranscriptSegment
import io
import os


# Create a separate test application
@pytest.fixture
def app(tmp_path):

    # Create temporary locations for the test database and uploads
    test_database = tmp_path / "test.db"
    test_uploads = tmp_path / "uploads"

    # Configure the test application
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{test_database}",
        "UPLOAD_FOLDER": str(test_uploads)
    })

    # Create tables for testing
    with app.app_context():
        db.drop_all()
        db.create_all()

        yield app

        # Clean up after testing
        db.session.remove()
        db.drop_all()


# Create a test client
@pytest.fixture
def client(app):
    return app.test_client()


# Test the health endpoint
def test_health(client):

    response = client.get("/api/health")

    assert response.status_code == 200


# Test retrieving all lectures
def test_get_lectures(client):

    response = client.get("/api/lectures")

    assert response.status_code == 200


# Test retrieving a lecture that does not exist
def test_lecture_not_found(client):

    response = client.get("/api/lectures/999999")

    assert response.status_code == 404


# Test retrieving scenes for a nonexistent lecture
def test_scenes_not_found(client):

    response = client.get("/api/lectures/999999/scenes")

    assert response.status_code == 404


# Test retrieving slides for a nonexistent lecture
def test_slides_not_found(client):

    response = client.get("/api/lectures/999999/slides")

    assert response.status_code == 404
    
    
# Test retrieving a lecture that exists
def test_get_single_lecture(client, app):

    # Create a sample lecture
    with app.app_context():
        lecture = Lecture(
            title="Test Lecture",
            video_path="/test/video.mp4",
            slides_pdf_path="/test/slides.pdf"
        )

        # Save lecture to the test database
        db.session.add(lecture)
        db.session.commit()

        # Get the lecture ID
        lecture_id = lecture.lecture_id

    # Send GET request to retrieve the lecture
    response = client.get(f"/api/lectures/{lecture_id}")

    # Check the response
    assert response.status_code == 200

    data = response.get_json()

    assert data["lecture_id"] == lecture_id
    assert data["title"] == "Test Lecture"
    assert data["video_path"] == "/test/video.mp4"
    assert data["slides_pdf_path"] == "/test/slides.pdf"
    assert data["created_at"] is not None


# Test retrieving multiple lectures
def test_get_all_lectures(client, app):

    # Create sample lectures
    with app.app_context():

        lecture1 = Lecture(
            title="Computer Science Lecture",
            video_path="/test/video1.mp4"
        )

        lecture2 = Lecture(
            title="Math Lecture",
            video_path="/test/video2.mp4"
        )

        # Save both lectures to the test database
        db.session.add(lecture1)
        db.session.add(lecture2)
        db.session.commit()

    # Request all lectures
    response = client.get("/api/lectures")

    # Check the response
    assert response.status_code == 200

    data = response.get_json()

    # Check that two lectures were returned
    assert len(data) == 2

    # Check the lecture information
    titles = [lecture["title"] for lecture in data]

    assert "Computer Science Lecture" in titles
    assert "Math Lecture" in titles



# Test deleting a lecture that does not exist
def test_delete_lecture_not_found(client):

    response = client.delete("/api/lectures/999999")

    assert response.status_code == 404
    assert response.get_json()["error"] == "Lecture not found."


# Test deleting a lecture and all associated data
def test_delete_lecture(client, app):

    # Create a sample lecture and associated records
    with app.app_context():

        lecture = Lecture(
            title="Lecture to Delete",
            video_path="/test/video.mp4",
            slides_pdf_path="/test/slides.pdf"
        )

        db.session.add(lecture)
        db.session.commit()

        lecture_id = lecture.lecture_id

        # Create a scene associated with the lecture
        scene = Scene()
        scene.lecture_id = lecture_id
        scene.start_time = 0.0
        scene.end_time = 10.0

        # Create a slide associated with the lecture
        slide = Slide()
        slide.lecture_id = lecture_id
        slide.slide_number = 1
        slide.image_path = "/test/slide_1.png"

        # Create a transcript segment associated with the lecture
        segment = TranscriptSegment()
        segment.lecture_id = lecture_id
        segment.start_time = 0.0
        segment.end_time = 5.0
        segment.text = "This is a test transcript."

        # Save associated records
        db.session.add(scene)
        db.session.add(slide)
        db.session.add(segment)
        db.session.commit()

    # Send DELETE request
    response = client.delete(f"/api/lectures/{lecture_id}")

    assert response.status_code == 200

    data = response.get_json()
    assert data["lecture_id"] == lecture_id

    # Verify that all records were deleted
    with app.app_context():

        assert db.session.get(Lecture, lecture_id) is None

        assert Scene.query.filter_by(
            lecture_id=lecture_id
        ).count() == 0

        assert Slide.query.filter_by(
            lecture_id=lecture_id
        ).count() == 0

        assert TranscriptSegment.query.filter_by(
            lecture_id=lecture_id
        ).count() == 0


# Test uploading a video successfully
def test_upload_video(client, app, monkeypatch):

    # Mock scene detection, slide extraction, and transcription
    # so we don't need a real video
    monkeypatch.setattr(
        "app.routes.detect_video_scenes",
        lambda video_path, threshold=12.0: []
    )

    monkeypatch.setattr(
        "app.routes.save_scenes_to_database",
        lambda lecture_id, scenes: None
    )

    monkeypatch.setattr(
        "app.routes.extract_slides_from_video",
        lambda **kwargs: []
    )

    monkeypatch.setattr(
        "app.routes.transcribe_video",
        lambda video_path, work_folder: [
            {"start_time": 0.0, "end_time": 2.5, "text": "Welcome to the lecture."}
        ]
    )

    # Create a sample video file
    video_file = io.BytesIO(b"fake video content")

    # Upload the video
    response = client.post(
        "/api/lectures/uploads",
        data={
            "title": "Test Upload",
            "video": (video_file, "test_video.mp4")
        },
        content_type="multipart/form-data"
    )

    # Check the response
    assert response.status_code == 201

    data = response.get_json()

    assert data["title"] == "Test Upload"
    assert data["scene_detection_status"] == "completed"
    assert data["slide_extraction_status"] == "completed"
    assert data["transcription_status"] == "completed"
    assert data["transcript_segment_count"] == 1

    # Check that the lecture was saved
    with app.app_context():

        lecture = db.session.get(Lecture, data["lecture_id"])

        assert lecture is not None
        assert lecture.title == "Test Upload"

        # Check that the uploaded video exists
        assert lecture.video_path is not None
        assert os.path.exists(lecture.video_path)



# Test uploading without providing a video
def test_upload_without_video(client):

    response = client.post(
        "/api/lectures/uploads",
        data={},
        content_type="multipart/form-data"
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "No video file provided"



# Test uploading an unsupported video format
def test_upload_unsupported_video(client):

    response = client.post(
        "/api/lectures/uploads",
        data={
            "video": (io.BytesIO(b"fake file"), "lecture.txt")
        },
        content_type="multipart/form-data"
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "Unsupported video file type."
