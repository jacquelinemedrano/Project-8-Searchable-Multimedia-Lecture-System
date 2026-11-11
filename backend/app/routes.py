import os
import uuid

from flask import Blueprint, jsonify, request, current_app, send_file
from werkzeug.utils import secure_filename

from .database import db
from .models import Lecture

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
    
    #first get the uploaded lecture videos
    video = request.files.get("video")
    
    #check if video is present
    if video is None or video.filename is None or video.filename == "":
        return jsonify({
            "error": "No video file provided"
        }), 400
     # Check the video file extension
    allowed_videos = {"mp4", "mov", "avi", "mkv", "webm"}

    video_filename = secure_filename(video.filename)
    video_extension = video_filename.rsplit(".", 1)[-1].lower() if "." in video_filename else ""

    if video_extension not in allowed_videos:
        return jsonify({
            "error": "Unsupported video file type."
        }), 400

    # Create a unique filename so uploads do not overwrite each other
    unique_video_name = str(uuid.uuid4()) + "." + video_extension

    # Get the upload folder
    upload_folder = current_app.config["UPLOAD_FOLDER"]

    # Save the video
    video_path = os.path.join(upload_folder, unique_video_name)
    video.save(video_path)

    # Get the lecture title from the form
    title = request.form.get("title", "").strip()

    if title == "":
        title = os.path.splitext(video_filename)[0]

    # Check whether optional PDF slides were uploaded
    slides_pdf = request.files.get("slides")

    slides_pdf_path = None

    if slides_pdf and slides_pdf.filename != "":

        pdf_name = slides_pdf.filename

        if pdf_name is None:
            os.remove(video_path)

            return jsonify({
                "error": "No slides file provided."
            }), 400

        pdf_filename = secure_filename(pdf_name)

        if not pdf_filename.lower().endswith(".pdf"):
            os.remove(video_path)

            return jsonify({
                "error": "Slides must be uploaded as a PDF."
            }), 400

        unique_pdf_name = str(uuid.uuid4()) + ".pdf"

        slides_pdf_path = os.path.join(
            upload_folder,
            unique_pdf_name
        )

        slides_pdf.save(slides_pdf_path)

    # Create a new lecture database record
    new_lecture = Lecture(
        title=title,
        video_path=video_path,
        slides_pdf_path=slides_pdf_path
    )

    # Save the lecture record
    try:
        db.session.add(new_lecture)
        db.session.commit()

    except Exception:
        db.session.rollback()

        # Remove saved files if the database operation fails
        if os.path.exists(video_path):
            os.remove(video_path)

        if slides_pdf_path and os.path.exists(slides_pdf_path):
            os.remove(slides_pdf_path)

        return jsonify({
            "error": "Could not save the lecture."
        }), 500

    # Send a response back to the frontend
    return jsonify({
        "message": "Lecture uploaded successfully!",
        "lecture_id": new_lecture.lecture_id,
        "title": new_lecture.title
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
    