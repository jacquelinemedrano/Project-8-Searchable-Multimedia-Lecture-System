import React, { useEffect, useState } from 'react';

const API_BASE_URL = 'http://localhost:5000';

const formatTimestamp = (seconds) => {
  if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds < 0) {
    return '—';
  }
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${pad(minutes)}:${pad(secs)}`;
};

const SlidesTable = ({ lectureId }) => {
  const [slides, setSlides] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lectureId) return;

    let isCancelled = false;

    const fetchSlidesAndScenes = async () => {
      setLoading(true);
      setError('');
      setSlides([]);
      setScenes([]);

      try {
        const [slidesRes, scenesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/lectures/${lectureId}/slides`),
          fetch(`${API_BASE_URL}/api/lectures/${lectureId}/scenes`),
        ]);

        const slidesData = await slidesRes.json();
        if (!slidesRes.ok) {
          throw new Error(slidesData.error || 'Failed to load slides.');
        }

        let sceneList = [];
        if (scenesRes.ok) {
          const scenesData = await scenesRes.json();
          sceneList = Array.isArray(scenesData.scenes) ? scenesData.scenes : [];
        }

        if (!isCancelled) {
          setSlides(Array.isArray(slidesData.slides) ? slidesData.slides : []);
          setScenes(sceneList);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Error fetching extracted slides.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchSlidesAndScenes();

    return () => {
      isCancelled = true;
    };
  }, [lectureId]);

  if (!lectureId) return null;

  return (
    <div style={tableStyles.wrapper}>
      <h3 style={tableStyles.heading}>Extracted Slides</h3>

      {loading && <p style={tableStyles.infoText}>Loading extracted slides...</p>}

      {error && <p style={tableStyles.errorText}>{error}</p>}

      {!loading && !error && slides.length === 0 && (
        <p style={tableStyles.infoText}>
          No extracted slides found for this lecture.
        </p>
      )}

      {!loading && !error && slides.length > 0 && (
        <div style={tableStyles.scrollContainer}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Preview</th>
                <th style={tableStyles.th}>Timestamp</th>
                <th style={tableStyles.th}>Image</th>
              </tr>
            </thead>
            <tbody>
              {slides.map((slide, index) => {
                const matchedScene =
                  scenes[slide.slide_number - 1] ?? scenes[index] ?? null;
                const imageUrl = `${API_BASE_URL}/api/lectures/${lectureId}/slides/${slide.slide_number}/image`;

                const timestampLabel = matchedScene
                  ? `${formatTimestamp(matchedScene.start_time)} – ${formatTimestamp(matchedScene.end_time)}`
                  : '—';

                return (
                  <tr
                    key={slide.slide_id ?? slide.slide_number}
                    style={tableStyles.tr}
                  >
                    <td style={tableStyles.td}>
                      <img
                        src={imageUrl}
                        alt={`Slide ${slide.slide_number}`}
                        style={tableStyles.thumbnail}
                        loading="lazy"
                      />
                    </td>
                    <td style={tableStyles.td}>
                      <span style={tableStyles.timestamp}>
                        {timestampLabel}
                      </span>
                    </td>
                    <td style={tableStyles.td}>
                      <a
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={tableStyles.link}
                      >
                        Open PNG
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const tableStyles = {
  wrapper: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #bbb',
  },
  heading: {
    margin: '0 0 12px 0',
    fontSize: '1.05rem',
    color: '#222',
  },
  infoText: {
    fontSize: '0.9rem',
    color: '#444',
  },
  errorText: {
    fontSize: '0.9rem',
    color: '#b02a37',
    fontWeight: '500',
  },
  scrollContainer: {
    overflowX: 'auto',
    backgroundColor: '#fff',
    borderRadius: '6px',
    border: '1px solid #ccc',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.9rem',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    backgroundColor: '#f1f3f5',
    borderBottom: '1px solid #ccc',
    color: '#222',
    fontWeight: '600',
  },
  tr: {
    borderBottom: '1px solid #e9ecef',
  },
  td: {
    padding: '10px 12px',
    verticalAlign: 'middle',
    color: '#333',
  },
  thumbnail: {
    width: '160px',
    height: 'auto',
    borderRadius: '4px',
    border: '1px solid #ddd',
    display: 'block',
  },
  timestamp: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.88rem',
    color: '#222',
  },
  link: {
    color: '#0056b3',
    textDecoration: 'none',
    fontWeight: '500',
  },
};

export default SlidesTable;