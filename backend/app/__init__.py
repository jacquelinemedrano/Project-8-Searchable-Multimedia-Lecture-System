import os
from flask import Flask
from .database import db

def create_app():

    # Create Flask application
    app = Flask(__name__)
    
    backend_folder = os.path.abspath(  #get backend folder pathway
        os.path.join(app.root_path)
    )
    
    #setup the upload folder
    app.config["UPLOAD_FOLDER"] = os.path.join(backend_folder, "uploads")

    #ensure the folder has a upload size limit, set to 500 MB
    app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024
    
    #double check if the upload folder exsits
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    
    # Configure SQLite database
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///lectures.db"

    # Disable unnecessary modification tracking
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

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