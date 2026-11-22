import pytest
from app import create_app


# Create a test Flask application
@pytest.fixture
def client():

    app = create_app()

    # Enable testing mode
    app.config["TESTING"] = True

    # Create a test client
    with app.test_client() as client:
        yield client


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