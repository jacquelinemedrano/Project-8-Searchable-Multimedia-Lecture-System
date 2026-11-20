import React, { useEffect, useState } from 'react';

const VideoUploader = () => {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const resetFeedback = () => {
    setStatusMessage('');
    setIsError(false);
    setUploadProgress(0);
  };

  const handleVideoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedVideo(file);
    resetFeedback();

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handlePdfChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    resetFeedback();

    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      event.target.value = '';
      setSelectedPdf(null);
      setStatusMessage('Please select a valid PDF file for slides.');
      setIsError(true);
      return;
    }

    setSelectedPdf(file);

    if (!selectedVideo) {
      setStatusMessage(
        'PDF selected — you must also select a video file before uploading.'
      );
      setIsError(true);
    }
  };

  const handleClearPdf = () => {
    setSelectedPdf(null);
    const pdfInput = document.getElementById('slides-pdf-input');
    if (pdfInput) {
      pdfInput.value = '';
    }
    if (
      statusMessage ===
      'PDF selected — you must also select a video file before uploading.'
    ) {
      setStatusMessage('');
      setIsError(false);
    }
  };

  const handleUpload = () => {
    if (!selectedVideo) {
      setStatusMessage(
        selectedPdf
          ? 'A video file is required whenever uploading a PDF.'
          : 'Please select a video file first.'
      );
      setIsError(true);
      return;
    }

    setIsUploading(true);
    setStatusMessage('');
    setIsError(false);
    setUploadProgress(0);

    const formData = new FormData();
    // Matches request.files.get("video") in Flask
    formData.append('video', selectedVideo);

    // Matches request.files.get("slides") in Flask
    if (selectedPdf) {
      formData.append('slides', selectedPdf);
    }

    if (videoTitle.trim() !== '') {
      formData.append('title', videoTitle.trim());
    }

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      setIsUploading(false);
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const response = JSON.parse(xhr.responseText);
          const slideNote =
            response.slide_extraction_status &&
            response.slide_extraction_status !== 'not_applicable'
              ? ` | Slides: ${response.slide_extraction_status}`
              : '';
          const sceneNote = response.scene_detection_status
            ? ` | Scenes: ${response.scene_detection_status}`
            : '';

          setStatusMessage(
            `Success! Saved as "${response.title}"${sceneNote}${slideNote}`
          );
          setIsError(false);
        } catch {
          setStatusMessage('Lecture uploaded successfully!');
          setIsError(false);
        }
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

    xhr.addEventListener('error', () => {
      setIsUploading(false);
      setStatusMessage(
        'Network error. Ensure the Flask server is running on port 5000.'
      );
      setIsError(true);
    });

    xhr.open('POST', 'http://localhost:5000/api/lectures/uploads');
    xhr.send(formData);
  };

  // Video is always required; a PDF is optional, so video must be present
  const canSubmit = Boolean(selectedVideo) && !isUploading;

  return (
    <div style={styles.container}>
      <h2>Upload Lecture</h2>

      {/* Optional Title Input */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>Lecture Title (Optional):</label>
        <input
          type="text"
          placeholder="Lecture Title"
          value={videoTitle}
          onChange={(e) => setVideoTitle(e.target.value)}
          disabled={isUploading}
          style={styles.textInput}
        />
      </div>

      {/* Required Video Input */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>
          Select Video File <span style={styles.required}>*</span>:
        </label>
        <input
          type="file"
          accept="video/*"
          onChange={handleVideoChange}
          disabled={isUploading}
          style={styles.fileInput}
        />
      </div>

      {/* Optional Slides PDF Input (requires a video file) */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>
          Select Slides PDF (Optional — requires a video):
        </label>
        <input
          id="slides-pdf-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={handlePdfChange}
          disabled={isUploading}
          style={styles.fileInput}
        />
        {selectedPdf && (
          <div style={styles.pdfBadgeRow}>
            <span style={styles.fileInfo}>
              PDF: <strong>{selectedPdf.name}</strong> (
              {(selectedPdf.size / (1024 * 1024)).toFixed(2)} MB)
            </span>
            <button
              type="button"
              onClick={handleClearPdf}
              disabled={isUploading}
              style={styles.clearButton}
            >
              Remove PDF
            </button>
          </div>
        )}
      </div>

      {previewUrl && selectedVideo && (
        <div style={styles.previewContainer}>
          <video src={previewUrl} controls style={styles.videoPlayer} />
          <p style={styles.fileInfo}>
            Video: <strong>{selectedVideo.name}</strong> (
            {(selectedVideo.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!canSubmit}
        style={{
          ...styles.button,
          opacity: canSubmit ? 1 : 0.6,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        {isUploading
          ? 'Uploading...'
          : selectedPdf
            ? 'Upload Video & Slides'
            : 'Upload Video'}
      </button>

      {isUploading && (
        <div style={styles.progressContainer}>
          <div style={{ ...styles.progressBar, width: `${uploadProgress}%` }}>
            {uploadProgress}%
          </div>
        </div>
      )}

      {statusMessage && (
        <p
          style={{
            ...styles.status,
            color: isError ? '#b02a37' : '#1e7e34',
          }}
        >
          {statusMessage}
        </p>
      )}
    </div>
  );
};

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
    backgroundColor: 'lightgrey',
  },
  inputGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '500',
    fontSize: '0.9rem',
    color: '#333',
  },
  required: {
    color: '#b02a37',
  },
  textInput: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '0.95rem',
    borderRadius: '4px',
    border: '1px solid #ccc',
    boxSizing: 'border-box',
  },
  fileInput: {
    display: 'block',
    width: '100%',
  },
  pdfBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginTop: '6px',
  },
  clearButton: {
    padding: '4px 10px',
    fontSize: '0.8rem',
    backgroundColor: '#fff',
    color: '#333',
    border: '1px solid #aaa',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  previewContainer: {
    marginBottom: '20px',
    marginTop: '20px',
    textAlign: 'center',
  },
  videoPlayer: {
    width: '100%',
    maxHeight: '300px',
    borderRadius: '6px',
    backgroundColor: '#000',
  },
  fileInfo: {
    fontSize: '0.9rem',
    color: '#444',
    margin: '6px 0 0 0',
  },
  button: {
    width: '100%',
    padding: '10px 24px',
    fontSize: '1rem',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
  },
  progressContainer: {
    width: '100%',
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    marginTop: '20px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '24px',
    backgroundColor: '#28a745',
    color: 'white',
    lineHeight: '24px',
    fontSize: '0.85rem',
    textAlign: 'center',
    transition: 'width 0.2s ease',
  },
  status: {
    marginTop: '16px',
    fontWeight: '500',
    textAlign: 'center',
  },
};

export default VideoUploader;