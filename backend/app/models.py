from .database import db
from datetime import datetime, timezone


# Stores uploaded lecture information
class Lecture(db.Model):

    __tablename__ = "lectures"

    lecture_id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    video_path = db.Column(db.String(500))
    slides_pdf_path = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    def __init__(self, title, video_path=None, slides_pdf_path=None):

        self.title = title
        self.video_path = video_path
        self.slides_pdf_path = slides_pdf_path
        self.created_at = datetime.now(timezone.utc)


# Stores transcript text and timestamps
class TranscriptSegment(db.Model):

    __tablename__ = "transcript_segments"

    segment_id = db.Column(db.Integer, primary_key=True)
    lecture_id = db.Column(
        db.Integer,
        db.ForeignKey("lectures.lecture_id"),
        nullable=False
    )

    start_time = db.Column(db.Float, nullable=False)
    end_time = db.Column(db.Float, nullable=False)
    text = db.Column(db.Text, nullable=False)


# Stores extracted lecture slides
class Slide(db.Model):

    __tablename__ = "slides"

    slide_id = db.Column(db.Integer, primary_key=True)
    lecture_id = db.Column(
        db.Integer,
        db.ForeignKey("lectures.lecture_id"),
        nullable=False
    )

    slide_number = db.Column(db.Integer, nullable=False)
    image_path = db.Column(db.String(500))


# Stores detected video scenes
class Scene(db.Model):

    __tablename__ = "scenes"

    scene_id = db.Column(db.Integer, primary_key=True)
    lecture_id = db.Column(
        db.Integer,
        db.ForeignKey("lectures.lecture_id"),
        nullable=False
    )

    start_time = db.Column(db.Float, nullable=False)
    end_time = db.Column(db.Float, nullable=False)

    # A scene may not have a matching slide
    slide_id = db.Column(
        db.Integer,
        db.ForeignKey("slides.slide_id"),
        nullable=True
    )