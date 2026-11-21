
# Import PySceneDetect tools
import os
import cv2
from flask import current_app
from scenedetect import open_video, SceneManager
from scenedetect.detectors import ContentDetector
from .database import db
from .models import Scene, Slide

# Detect scene changes in a lecture video
def detect_video_scenes(video_path):

    # Open the uploaded video
    video = open_video(video_path)

    # Create a scene manager
    scene_manager = SceneManager()

    # Add the content detector
    # It detects changes between consecutive video frames
    scene_manager.add_detector(
        ContentDetector(threshold=15.0, min_scene_len=25)
    )

    # Analyze the video and detect scene changes
    scene_manager.detect_scenes(video=video)

    # Get the detected scenes
    scene_list = scene_manager.get_scene_list()

    # Create a list to store scene information
    scenes = []

    # Go through each detected scene
    for scene_number, (start_time, end_time) in enumerate(
        scene_list, start=1
    ):

        # Store the scene number and timestamps
        scenes.append({
            "scene_number": scene_number,
            "start_time": start_time.get_seconds(),
            "end_time": end_time.get_seconds()
        })

    # Return all detected scenes
    return scenes


# Save detected scenes into the database
def save_scenes_to_database(lecture_id, scenes):

    # Remove previously detected scenes for this lecture
    Scene.query.filter_by(lecture_id=lecture_id).delete()

    # Go through each detected scene
    for scene in scenes:

        # Create a new Scene database record
        new_scene = Scene()

        # Assign the scene information
        new_scene.lecture_id = lecture_id
        new_scene.start_time = scene["start_time"]
        new_scene.end_time = scene["end_time"]
        
        

        # Add the scene to the database
        db.session.add(new_scene)

    # Save all scenes
    db.session.commit()

    print("Scenes successfully saved!")

def extract_slides_from_video(video_path, lecture_id, upload_folder, scenes=None):
    if scenes is None:
        scenes = detect_video_scenes(video_path)

    slides_folder = os.path.join(
        upload_folder,
        f"lecture_{lecture_id}_slides"
    )
    os.makedirs(slides_folder, exist_ok=True)

    current_app.logger.info("Extracting slides for lecture %s: %d scenes", lecture_id, len(scenes))

    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video file for slide extraction: {video_path}")

    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    slides = []

    try:
        for slide_number, scene in enumerate(scenes, start=1):
            start_sec = float(scene.get("start_time", 0.0))
            end_sec = float(scene.get("end_time", start_sec))

            # Sample slightly past the scene start (or midpoint) to avoid transition fades
            if end_sec > start_sec:
                sample_sec = start_sec + min(0.5, (end_sec - start_sec) * 0.25)
            else:
                sample_sec = start_sec

            frame_index = int(round(sample_sec * fps))
            if total_frames > 0:
                frame_index = max(0, min(frame_index, total_frames - 1))
            else:
                frame_index = max(0, frame_index)

            capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            success, frame = capture.read()

            if not success or frame is None:
                continue

            image_filename = f"slide_{slide_number}.png"
            image_path = os.path.join(slides_folder, image_filename)

            if cv2.imwrite(image_path, frame):
                slides.append({
                    "slide_number": slide_number,
                    "image_path": image_path,
                })
    finally:
        capture.release()

    return slides


def save_video_slides_to_database(lecture_id, slides):
    Slide.query.filter_by(lecture_id=lecture_id).delete()

    for slide in slides:
        new_slide = Slide()
        new_slide.lecture_id = lecture_id
        new_slide.slide_number = slide["slide_number"]
        new_slide.image_path = slide["image_path"]
        db.session.add(new_slide)

    db.session.commit()