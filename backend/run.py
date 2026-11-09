from app import create_app

# Create Flask application
app = create_app()

# Start server
if __name__ == "__main__":
    app.run(debug=True)