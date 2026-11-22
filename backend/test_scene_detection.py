from app import create_app
from app.scene_detection import detect_video_scenes, save_scenes_to_database
import os
from app.models import Scene

# Path to the test video
video_path = "uploads/0b5c3903-212a-4d96-9e44-0c0622b20c07.mp4"

# ID of the uploaded lecture
lecture_id = 4

# Create Flask application
app = create_app()

# Run the test inside Flask's application context
with app.app_context():

    # Detect scenes in the video
    scenes = detect_video_scenes(video_path)
    
    # Retrieve saved scenes from the database
    saved_scenes = Scene.query.filter_by(
        lecture_id=lecture_id
    ).order_by(Scene.start_time).all()


    # Save detected scenes into SQLite
    save_scenes_to_database(lecture_id, scenes)

    # Display detected scenes
    print("\nDetected Scenes:")

    for scene in scenes:
        print(
            "Scene:", scene["scene_number"],
            "| Start:", round(scene["start_time"], 2),
            "| End:", round(scene["end_time"], 2)
        )

    print("\nTotal scenes detected:", len(scenes))