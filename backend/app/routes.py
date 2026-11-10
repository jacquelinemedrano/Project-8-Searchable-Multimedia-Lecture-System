import os
import uuid

from flask import Blueprint, jsonify
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