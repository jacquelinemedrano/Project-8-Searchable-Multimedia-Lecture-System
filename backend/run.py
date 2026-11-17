from app import create_app
from flask_cors import CORS

# Create Flask application
app = create_app()

#Allow CORS
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173"]}})

# Start server
if __name__ == "__main__":
    app.run(debug=True)