from app import create_app
from app.slide_extraction import extract_pdf_slides, save_slides_to_database
from app.models import Slide

# Lecture ID of our test lecture
lecture_id = 5

# Create Flask application
app = create_app()

with app.app_context():

    # Get the PDF path from the database
    from app.models import Lecture

    lecture = Lecture.query.get(lecture_id)

    # Check if the lecture exists
    if lecture is None:
        print("Lecture not found.")

    elif not lecture.slides_pdf_path:
        print("No PDF file found for this lecture.")

    else:
        # Extract slides from the PDF
        slides = extract_pdf_slides(
            lecture.slides_pdf_path,
            lecture_id,
            app.config["UPLOAD_FOLDER"]
        )

        # Display extracted slides
        print("\nExtracted Slides:")

        for slide in slides:
            print(
                "Slide:", slide["slide_number"],
                "| Image:", slide["image_path"]
            )

        print("\nTotal slides extracted:", len(slides))

        # Save slides to the database
        save_slides_to_database(lecture_id, slides)
        
                # Verify that slides were saved in the database
        saved_slides = Slide.query.filter_by(
            lecture_id=lecture_id
        ).order_by(Slide.slide_number).all()

        print("\nSlides saved in database:")

        for slide in saved_slides:
            print(
                "Slide:", slide.slide_number,
                "| ID:", slide.slide_id,
                "| Image:", slide.image_path
            )

        print("\nTotal slides in database:", len(saved_slides))