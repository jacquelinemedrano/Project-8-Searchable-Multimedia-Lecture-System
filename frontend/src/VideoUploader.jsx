import React, { useState } from 'react';

const VideoUploader = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setStatusMessage('');
    setIsError(false);
    setUploadProgress(0);

    // Create a local URL to preview the video in the browser
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUpload = () => {
    if (!selectedFile) {
      setStatusMessage('Please select a video file first.');
      setIsError(true);
      return;
    }

    setIsUploading(true);
    setStatusMessage('');
    setIsError(false);

    const formData = new FormData();
    // 'video' matches the key expected by Flask: request.files['video']
    formData.append('video', selectedFile);

    // Only append the title if the user typed something; otherwise, skip it
    if (videoTitle.trim() !== '') {
      formData.append('title', videoTitle.trim());
    }

    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    });

    // Handle completion
    xhr.addEventListener('load', () => {
      setIsUploading(false);
      if (xhr.status === 200 || xhr.status === 201 ) {
        const response = JSON.parse(xhr.responseText);
        setStatusMessage(`Success! Saved as ${response.title}`);
        setIsError(false);
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          setStatusMessage(errorResponse.error || 'Upload failed.');
        } catch {
          setStatusMessage('Server error occurred during upload.');
        }
        setIsError(true);
      }
    });

    // Handle network errors
    xhr.addEventListener('error', () => {
      setIsUploading(false);
      setStatusMessage('Network error. Ensure the Flask server is running on port 5000.');
      setIsError(true);
    });

    xhr.open('POST', 'http://localhost:5000/api/lectures/uploads');
    xhr.send(formData);
  };

  return (
    <div style={styles.container}>
      <h2>Upload</h2>
      
      {/* Optional Title Input */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>Video Title (Optional):</label>
        <input 
          type="text" 
          placeholder="Lecture Title" 
          value={videoTitle}
          onChange={(e) => setVideoTitle(e.target.value)}
          disabled={isUploading}
          style={styles.textInput}
        />
      </div>

      <div style={styles.inputGroup}>
        <label style={styles.label}>Select Video File:</label>
        <input 
          type="file" 
          accept="video/*" 
          onChange={handleFileChange} 
          disabled={isUploading}
          style={styles.fileInput}
        />
      </div>

      {previewUrl && (
        <div style={styles.previewContainer}>
          <video 
            src={previewUrl} 
            controls 
            style={styles.videoPlayer} 
          />
          <p style={styles.fileInfo}>
            Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        </div>
      )}

      <button 
        onClick={handleUpload} 
        disabled={!selectedFile || isUploading}
        style={{
          ...styles.button,
          opacity: (!selectedFile || isUploading) ? 0.6 : 1
        }}
      >
        {isUploading ? 'Uploading...' : 'Upload Video'}
      </button>

      {isUploading && (
        <div style={styles.progressContainer}>
          <div style={{ ...styles.progressBar, width: `${uploadProgress}%` }}>
            {uploadProgress}%
          </div>
        </div>
      )}

      {statusMessage && (
        <p style={{ 
          ...styles.status, 
          color: isError ? '#d9534f' : '#28a745' 
        }}>
          {statusMessage}
        </p>
      )}
    </div>
  );
};

// Basic inline styles for clean presentation
const styles = {
  container: {
    maxWidth: '500px',
    margin: '40px auto',
    padding: '24px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textAlign: 'left',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    backgroundColor: 'lightgrey'
  },
  inputGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '500',
    fontSize: '0.9rem',
    color: '#333'
  },
  textInput: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '0.95rem',
    borderRadius: '4px',
    border: '1px solid #ccc',
    boxSizing: 'border-box'
  },
  fileInput: {
    display: 'block',
    width: '100%'
  },
  previewContainer: {
    marginBottom: '20px',
    marginTop: '20px',
    textAlign: 'center'
  },
  videoPlayer: {
    width: '100%',
    maxHeight: '300px',
    borderRadius: '6px',
    backgroundColor: '#000'
  },
  fileInfo: {
    fontSize: '0.9rem',
    color: '#555',
    marginTop: '8px'
  },
  button: {
    width: '100%',
    padding: '10px 24px',
    fontSize: '1rem',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  progressContainer: {
    width: '100%',
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    marginTop: '20px',
    overflow: 'hidden'
  },
  progressBar: {
    height: '24px',
    backgroundColor: '#28a745',
    color: 'white',
    lineHeight: '24px',
    fontSize: '0.85rem',
    textAlign: 'center',
    transition: 'width 0.2s ease'
  },
  status: {
    marginTop: '16px',
    fontWeight: '500',
    textAlign: 'center'
  }
};

export default VideoUploader;