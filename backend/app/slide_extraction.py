# Import required libraries
import os
import fitz  # PyMuPDF


# Extract individual slides from a lecture PDF
def extract_pdf_slides(pdf_path, lecture_id, upload_folder):

    # Create a folder for this lecture's slide images
    slides_folder = os.path.join(
        upload_folder,
        f"lecture_{lecture_id}_slides"
    )

    os.makedirs(slides_folder, exist_ok=True)

    # Open the uploaded PDF
    pdf = fitz.open(pdf_path)

    # Create a list to store slide information
    slides = []

    # Go through each page in the PDF
    for page_number, page in enumerate(pdf, start=1):

        # Convert the PDF page into an image
        pixmap = page.get_pixmap(
            matrix=fitz.Matrix(2, 2),
            alpha=False
        )

        # Create the image filename
        image_filename = f"slide_{page_number}.png"

        # Get the full image path
        image_path = os.path.join(
            slides_folder,
            image_filename
        )

        # Save the page as an image
        pixmap.save(image_path)

        # Store the slide information
        slides.append({
            "slide_number": page_number,
            "image_path": image_path
        })

    # Close the PDF
    pdf.close()

    return slides