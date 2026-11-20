import React, { useEffect, useState } from 'react';

const API_BASE_URL = 'http://localhost:5000';

const SlidesTable = ({ lectureId }) => {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lectureId) return;

    let isCancelled = false;

    const fetchSlides = async () => {
      setLoading(true);
      setError('');
      setSlides([]);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/lectures/${lectureId}/slides`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load slides.');
        }

        if (!isCancelled) {
          setSlides(Array.isArray(data.slides) ? data.slides : []);
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

    fetchSlides();

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
                <th style={tableStyles.th}>Image</th>
              </tr>
            </thead>
            <tbody>
              {slides.map((slide) => {
                const imageUrl = `${API_BASE_URL}/api/lectures/${lectureId}/slides/${slide.slide_number}/image`;

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
  link: {
    color: '#0056b3',
    textDecoration: 'none',
    fontWeight: '500',
  },
};

export default SlidesTable;