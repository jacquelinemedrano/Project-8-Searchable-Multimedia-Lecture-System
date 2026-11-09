from flask import Blueprint, jsonify

# Create a blueprint for our routes
main = Blueprint("main", __name__)

# Test route
@main.route("/api/health", methods=["GET"]) # should be "/api/health" , changed it for testing
def health_check():

    return jsonify({
        "message": "Lecture System Backend is Running!"
    })