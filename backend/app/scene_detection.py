
# Import PySceneDetect tools
from scenedetect import open_video, SceneManager
from scenedetect.detectors import ContentDetector


# Detect scene changes in a lecture video
def detect_video_scenes(video_path):

    # Open the uploaded video
    video = open_video(video_path)

    # Create a scene manager
    scene_manager = SceneManager()

    # Add the content detector
    # It detects changes between consecutive video frames
    scene_manager.add_detector(
        ContentDetector(threshold=27.0)
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
