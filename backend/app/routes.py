import os
import uuid
import shutil

from flask import Blueprint, jsonify, request, current_app, send_file
from werkzeug.utils import secure_filename

from .database import db
from .models import Lecture, Scene, Slide, TranscriptSegment
from .scene_detection import (
    detect_video_scenes,
    save_scenes_to_database,
    extract_slides_from_video,
    save_video_slides_to_database,
)
from .slide_extraction import extract_pdf_slides, save_slides_to_database

# Create a blueprint for our routes
main = Blueprint("main", __name__)

# Test route
@main.route("/api/health", methods=["GET"]) # should be "/api/health" , changed it for testing
def health_check():

    return jsonify({
        "message": "Lecture System Backend is Running!"
    })


    
#upload lecture videos and slides
@main.route("/api/lectures/uploads", methods=["POST"])
def upload_lecture():
    video = request.files.get("video")

    if video is None or video.filename is None or video.filename == "":
        return jsonify({
            "error": "No video file provided"
        }), 400

    allowed_videos = {"mp4", "mov", "avi", "mkv", "webm"}
    video_filename = secure_filename(video.filename)
    video_extension = video_filename.rsplit(".", 1)[-1].lower() if "." in video_filename else ""

    if video_extension not in allowed_videos:
        return jsonify({
            "error": "Unsupported video file type."
        }), 400

    unique_video_name = str(uuid.uuid4()) + "." + video_extension
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    video_path = os.path.join(upload_folder, unique_video_name)
    video.save(video_path)

    title = request.form.get("title", "").strip()
    if title == "":
        title = os.path.splitext(video_filename)[0]

    new_lecture = Lecture(
        title=title,
        video_path=video_path,
        slides_pdf_path=None
    )

    try:
        db.session.add(new_lecture)
        db.session.commit()
    except Exception:
        db.session.rollback()
        if os.path.exists(video_path):
            os.remove(video_path)
        return jsonify({
            "error": "Could not save the lecture."
        }), 500

    scenes = []
    try:
        scenes = detect_video_scenes(video_path)
        save_scenes_to_database(new_lecture.lecture_id, scenes)
        scene_detection_status = "completed"
    except Exception:
        current_app.logger.exception("Scene detection failed")
        scene_detection_status = "failed"

    try:
        slides = extract_slides_from_video(
            video_path=video_path,
            lecture_id=new_lecture.lecture_id,
            upload_folder=upload_folder,
            scenes=scenes if scene_detection_status == "completed" else None,
        )
        save_video_slides_to_database(new_lecture.lecture_id, slides)
        slide_extraction_status = "completed"
    except Exception:
        current_app.logger.exception("Video slide extraction failed")
        slide_extraction_status = "failed"

    return jsonify({
        "message": "Lecture uploaded successfully!",
        "lecture_id": new_lecture.lecture_id,
        "title": new_lecture.title,
        "scene_detection_status": scene_detection_status,
        "slide_extraction_status": slide_extraction_status
    }), 201 
    
    
    
#get all lectures from the database
@main.route("/api/lectures", methods=["GET"])
def get_lectures():
   lectures = Lecture.query.all()
   
   #create list for storing lecture information in dictionary format
   lecture_list = [] 
   for lecture in lectures:
       lecture_list.append({
           "lecture_id": lecture.lecture_id,
           "title": lecture.title,
           "video_path": lecture.video_path, #might not need this
           "slides_pdf_path": lecture.slides_pdf_path,
           "created_at": lecture.created_at.isoformat()
           if lecture.created_at else None
       })
       #return lectures as JSON response
   return jsonify(lecture_list), 200



#get a single lecture by its ID from the database
@main.route("/api/lectures/<int:lecture_id>", methods=["GET"])
def get_lecture(lecture_id):
    
    # Query the database for the lecture with the given ID
    lecture = Lecture.query.get(lecture_id)
    if not lecture:
        return jsonify({
            "error": "Lecture not found."
        }), 404

    # Return the lecture information as a JSON response
    return jsonify({ 
        "lecture_id": lecture.lecture_id,
        "title": lecture.title,
        "video_path": lecture.video_path,
        "slides_pdf_path": lecture.slides_pdf_path,
        "created_at": lecture.created_at.isoformat() if lecture.created_at else None
    }), 200
    


# Get all detected scenes for a lecture
@main.route("/api/lectures/<int:lecture_id>/scenes", methods=["GET"])
def get_lecture_scenes(lecture_id):

    # Check if the lecture exists
    lecture = Lecture.query.get(lecture_id)

    if not lecture:
        return jsonify({
            "error": "Lecture not found."
        }), 404

    # Get all scenes associated with this lecture
    scenes = Scene.query.filter_by(
        lecture_id=lecture_id
    ).order_by(Scene.start_time).all()

    # Create a list to store scene information
    scene_list = []

    # Go through each detected scene
    for scene in scenes:
        scene_list.append({
            "scene_id": scene.scene_id,
            "start_time": scene.start_time,
            "end_time": scene.end_time
        })

    # Return the scenes as JSON
    return jsonify({
        "lecture_id": lecture_id,
        "scenes": scene_list
    }), 200
    
   
   
   
   # Get all extracted slides for a lecture
@main.route("/api/lectures/<int:lecture_id>/slides", methods=["GET"])
def get_lecture_slides(lecture_id):

    # Check if the lecture exists
    lecture = Lecture.query.get(lecture_id)

    if not lecture:
        return jsonify({
            "error": "Lecture not found."
        }), 404

    # Get all slides associated with this lecture
    slides = Slide.query.filter_by(
        lecture_id=lecture_id
    ).order_by(Slide.slide_number).all()

    # Create a list to store slide information
    slide_list = []

    # Go through each slide
    for slide in slides:
        slide_list.append({
            "slide_id": slide.slide_id,
            "slide_number": slide.slide_number,
            "image_path": slide.image_path
        })

    # Return the slides as JSON
    return jsonify({
        "lecture_id": lecture_id,
        "slides": slide_list
    }), 200
    
    
    
    
    
    # Get an individual slide image
@main.route(
    "/api/lectures/<int:lecture_id>/slides/<int:slide_number>/image",
    methods=["GET"]
)
def get_slide_image(lecture_id, slide_number):

    # Check if the lecture exists
    lecture = Lecture.query.get(lecture_id)

    if not lecture:
        return jsonify({
            "error": "Lecture not found."
        }), 404

    # Find the requested slide
    slide = Slide.query.filter_by(
        lecture_id=lecture_id,
        slide_number=slide_number
    ).first()

    if not slide:
        return jsonify({
            "error": "Slide not found."
        }), 404

    # Check if the image file exists
    if not os.path.exists(slide.image_path):
        return jsonify({
            "error": "Slide image file not found."
        }), 404

    # Return the actual slide image
    return send_file(
        slide.image_path,
        mimetype="image/png"
    )
    
    
    
    
@main.route("/api/lectures/<int:lecture_id>/video", methods=["GET"])
def get_lecture_video(lecture_id):
    lecture = db.session.get(Lecture, lecture_id)
        
        # Query the database for the lecture with the given ID
        # If the lecture does not exist, return a 404 error response
    if lecture is None:
        return jsonify({
            "error": "Lecture not found."
         }), 404

        # If the lecture does not have a video or the video file does not exist, return a 404 error response
    if not lecture.video_path or not os.path.exists(lecture.video_path):
        return jsonify({
            "error": "Video not found."
        }), 404

    # Send the video file as a response to the frontend
    return send_file(lecture.video_path)

   # Delete a lecture and all its associated data
@main.route("/api/lectures/<int:lecture_id>", methods=["DELETE"])
def delete_lecture(lecture_id):

    # Find the lecture
    lecture = Lecture.query.get(lecture_id)

    if not lecture:
        return jsonify({
            "error": "Lecture not found."
        }), 404

    # Store file paths before deleting the lecture
    video_path = lecture.video_path
    pdf_path = lecture.slides_pdf_path

    # Get the folder containing extracted slide images
    slides_folder = os.path.join(
        current_app.config["UPLOAD_FOLDER"],
        f"lecture_{lecture_id}_slides"
    )

    try:
        # Delete associated scene records
        Scene.query.filter_by(
            lecture_id=lecture_id
        ).delete()

        # Delete associated slide records
        Slide.query.filter_by(
            lecture_id=lecture_id
        ).delete()

        # Delete associated transcript records
        TranscriptSegment.query.filter_by(
            lecture_id=lecture_id
        ).delete()

        # Delete the lecture record
        db.session.delete(lecture)

        # Save database changes
        db.session.commit()

    except Exception:
        db.session.rollback()

        current_app.logger.exception("Lecture deletion failed")

        return jsonify({
            "error": "Could not delete the lecture."
        }), 500

    # Remove the video file
    try:
        if video_path and os.path.exists(video_path):
            os.remove(video_path)

        # Remove the original PDF
        if pdf_path and os.path.exists(pdf_path):
            os.remove(pdf_path)

        # Remove the extracted slide images folder
        if os.path.exists(slides_folder):
            shutil.rmtree(slides_folder)

    except OSError:
        current_app.logger.exception(
            "Lecture files could not be completely removed"
        )

        return jsonify({
            "message": "Lecture deleted from database, but some files could not be removed.",
            "lecture_id": lecture_id
        }), 200

    return jsonify({
        "message": "Lecture and associated data deleted successfully!",
        "lecture_id": lecture_id
    }), 200