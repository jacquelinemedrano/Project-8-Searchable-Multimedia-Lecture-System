import React, { useCallback, useEffect, useState } from 'react';
import SlidesTable from './SlidesTable';

const API_BASE_URL = 'http://localhost:5000';

const formatCreatedAt = (isoString) => {
  if (!isoString) return '—';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return isoString;
  return parsed.toLocaleString();
};

const UploadedLectures = ({ refreshKey = 0 }) => {
  const [lectures, setLectures] = useState([]);
  const [selectedLectureId, setSelectedLectureId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const fetchLectures = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/lectures`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load uploaded lectures.');
      }

      const list = Array.isArray(data) ? data : [];
      setLectures(list);

      setSelectedLectureId((prevSelected) => {
        if (prevSelected && list.some((lec) => lec.lecture_id === prevSelected)) {
          return prevSelected;
        }
        return list.length > 0 ? list[0].lecture_id : null;
      });
    } catch (err) {
      setError(err.message || 'Error fetching lectures.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLectures();
  }, [fetchLectures, refreshKey]);

  const handleDeleteLecture = async (lectureId, event) => {
    event.stopPropagation();
    setDeletingId(lectureId);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/lectures/${lectureId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete lecture.');
      }

      setLectures((prev) => prev.filter((lec) => lec.lecture_id !== lectureId));
      setSelectedLectureId((prev) => (prev === lectureId ? null : prev));
    } catch (err) {
      setError(err.message || 'Error deleting lecture.');
    } finally {
      setDeletingId(null);
    }
  };

  const selectedLecture =
    lectures.find((lec) => lec.lecture_id === selectedLectureId) || null;

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h2 style={styles.heading}>Uploaded Lectures</h2>
        <button
          type="button"
          onClick={fetchLectures}
          disabled={loading}
          style={styles.refreshButton}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <p style={styles.errorText}>{error}</p>}

      {!loading && lectures.length === 0 && (
        <p style={styles.infoText}>No lectures have been uploaded yet.</p>
      )}

      {lectures.length > 0 && (
        <div style={styles.listWrapper}>
          {lectures.map((lecture) => {
            const isSelected = lecture.lecture_id === selectedLectureId;

            return (
              <div
                key={lecture.lecture_id}
                onClick={() => setSelectedLectureId(lecture.lecture_id)}
                style={{
                  ...styles.lectureCard,
                  ...(isSelected ? styles.selectedCard : {}),
                }}
              >
                <div style={styles.lectureMeta}>
                  <strong style={styles.lectureTitle}>
                    {lecture.title || `Lecture #${lecture.lecture_id}`}
                  </strong>
                  <span style={styles.lectureSubtext}>
                    Uploaded: {formatCreatedAt(lecture.created_at)}
                  </span>
                </div>

                <div style={styles.cardActions}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLectureId(lecture.lecture_id);
                    }}
                    style={styles.viewButton}
                  >
                    {isSelected ? 'Viewing' : 'View Slides'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteLecture(lecture.lecture_id, e)}
                    disabled={deletingId === lecture.lecture_id}
                    style={styles.deleteButton}
                  >
                    {deletingId === lecture.lecture_id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedLecture && (
        <div style={styles.detailPanel}>
          <h3 style={styles.detailHeading}>
            {selectedLecture.title || `Lecture #${selectedLecture.lecture_id}`}
          </h3>

          <video
            key={selectedLecture.lecture_id}
            src={`${API_BASE_URL}/api/lectures/${selectedLecture.lecture_id}/video`}
            controls
            style={styles.videoPlayer}
          />

          <SlidesTable lectureId={selectedLecture.lecture_id} />
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '720px',
    margin: '40px auto',
    padding: '24px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textAlign: 'left',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    backgroundColor: 'lightgrey',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  heading: {
    margin: 0,
    fontSize: '1.3rem',
    color: '#222',
  },
  refreshButton: {
    padding: '6px 14px',
    fontSize: '0.88rem',
    backgroundColor: '#fff',
    color: '#222',
    border: '1px solid #aaa',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  infoText: {
    fontSize: '0.92rem',
    color: '#444',
  },
  errorText: {
    fontSize: '0.92rem',
    color: '#b02a37',
    fontWeight: '500',
  },
  listWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  lectureCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 14px',
    backgroundColor: '#fff',
    borderRadius: '6px',
    border: '1px solid #ccc',
    cursor: 'pointer',
  },
  selectedCard: {
    border: '2px solid #007bff',
  },
  lectureMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  lectureTitle: {
    fontSize: '1rem',
    color: '#222',
  },
  lectureSubtext: {
    fontSize: '0.82rem',
    color: '#555',
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  viewButton: {
    padding: '6px 12px',
    fontSize: '0.85rem',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  deleteButton: {
    padding: '6px 12px',
    fontSize: '0.85rem',
    backgroundColor: '#fff',
    color: '#b02a37',
    border: '1px solid #b02a37',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  detailPanel: {
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #bbb',
  },
  detailHeading: {
    margin: '0 0 12px 0',
    fontSize: '1.1rem',
    color: '#222',
  },
  videoPlayer: {
    width: '100%',
    maxHeight: '340px',
    borderRadius: '6px',
    backgroundColor: '#000',
  },
};

export default UploadedLectures;