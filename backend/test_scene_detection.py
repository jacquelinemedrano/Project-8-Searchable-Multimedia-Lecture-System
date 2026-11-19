
from app.scene_detection import detect_video_scenes

# Replace this with the actual filename from your uploads folder
video_path = "uploads/0b5c3903-212a-4d96-9e44-0c0622b20c07.mp4"


# Detect scenes in the video
scenes = detect_video_scenes(video_path)

# Display the results
print("\nDetected Scenes:")

for scene in scenes:
    print(
        "Scene:", scene["scene_number"],
        "| Start:", round(scene["start_time"], 2),
        "| End:", round(scene["end_time"], 2)
    )

print("\nTotal scenes detected:", len(scenes))
