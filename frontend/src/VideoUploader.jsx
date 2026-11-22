import React, { useEffect, useState } from 'react';
import SlidesTable from './SlidesTable';

const DETECTION_PRESETS = {
  regular: {
    label: 'Regular Detection (Threshold: 12)',
    threshold: 12,
  },
  sensitive: {
    label: 'Sensitive Detection (Threshold: 3)',
    threshold: 3,
  },
};

const VideoUploader = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [detectionMode, setDetectionMode] = useState('regular');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedLectureId, setUploadedLectureId] = useState(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setUploadedLectureId(null);
    setStatusMessage('');
    setIsError(false);
    setUploadProgress(0);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUpload = () => {
    if (!selectedFile) {
      setStatusMessage('Please select a video file first.');
      setIsError(true);
      return;
    }

    const activeThreshold = DETECTION_PRESETS[detectionMode]?.threshold ?? 12;

    setIsUploading(true);
    setUploadedLectureId(null);
    setStatusMessage('');
    setIsError(false);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('threshold', String(activeThreshold));

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
          const sceneNote = response.scene_detection_status
            ? ` | Scenes: ${response.scene_detection_status}`
            : '';
          const slideNote = response.slide_extraction_status
            ? ` | Slides: ${response.slide_extraction_status}`
            : '';

          setStatusMessage(
            `Success! Saved as "${response.title}"${sceneNote}${slideNote}`
          );
          setIsError(false);

          if (
            response.lecture_id &&
            response.slide_extraction_status === 'completed'
          ) {
            setUploadedLectureId(response.lecture_id);
          }
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

  return (
    <div style={styles.container}>
      <h2>Upload Lecture</h2>

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
        <label htmlFor="detection-mode-select" style={styles.label}>
          Scene Detection Mode:
        </label>
        <select
          id="detection-mode-select"
          value={detectionMode}
          onChange={(e) => setDetectionMode(e.target.value)}
          disabled={isUploading}
          style={styles.selectInput}
        >
          <option value="regular">
            Regular Detection (Threshold: 12)
          </option>
          <option value="sensitive">
            Sensitive Detection (Threshold: 3)
          </option>
        </select>
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

      {previewUrl && selectedFile && (
        <div style={styles.previewContainer}>
          <video src={previewUrl} controls style={styles.videoPlayer} />
          <p style={styles.fileInfo}>
            Selected: <strong>{selectedFile.name}</strong> (
            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        style={{
          ...styles.button,
          opacity: !selectedFile || isUploading ? 0.6 : 1,
          cursor: !selectedFile || isUploading ? 'not-allowed' : 'pointer',
        }}
      >
        {isUploading ? 'Uploading & Extracting...' : 'Upload Video'}
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

      {uploadedLectureId && <SlidesTable lectureId={uploadedLectureId} />}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '640px',
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
  textInput: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '0.95rem',
    borderRadius: '4px',
    border: '1px solid #ccc',
    boxSizing: 'border-box',
  },
  selectInput: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '0.95rem',
    borderRadius: '4px',
    border: '1px solid #ccc',
    backgroundColor: '#fff',
    color: '#222',
    boxSizing: 'border-box',
  },
  fileInput: {
    display: 'block',
    width: '100%',
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
    marginTop: '8px',
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