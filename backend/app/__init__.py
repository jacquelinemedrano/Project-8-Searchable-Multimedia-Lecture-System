from flask import Flask
from .database import db

def create_app():

    # Create Flask application
    app = Flask(__name__)

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