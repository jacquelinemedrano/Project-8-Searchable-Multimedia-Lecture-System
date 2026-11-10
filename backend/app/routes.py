import os
import uuid

from flask import Blueprint, jsonify, request, current_app
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
    if video is None or video.filename == "":
        return jsonify({
            "error": "No video file provided"
        }), 400
        