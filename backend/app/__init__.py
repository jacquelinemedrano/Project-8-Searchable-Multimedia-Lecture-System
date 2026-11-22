
import os
from flask import Flask
from .database import db

def create_app(test_config=None):

    # Create Flask application
    app = Flask(__name__)

    backend_folder = os.path.abspath(
        os.path.join(app.root_path, "..")
    )

    # Default application settings
    app.config["UPLOAD_FOLDER"] = os.path.join(backend_folder, "uploads")
    app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///lectures.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Override settings when creating a test application
    if test_config:
        app.config.update(test_config)

    # Make sure the upload folder exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    print("UPLOAD FOLDER:", app.config["UPLOAD_FOLDER"])

    # Connect database to Flask
    db.init_app(app)

    # Import models so SQLAlchemy knows which tables to create
    from . import models

    # Create database tables
    with app.app_context():
        db.create_all()

    # Import and register routes
    from .routes import main
    app.register_blueprint(main)

    return app
