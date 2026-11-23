import React, { useEffect, useMemo, useState } from 'react';

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

const highlightText = (text, term) => {
  if (!term) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, idx) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <mark key={idx} style={tableStyles.mark}>
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const SlidesTable = ({ lectureId, videoRef, currentTime = 0 }) => {
  const [slides, setSlides] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [segments, setSegments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lectureId) return;

    let isCancelled = false;

    const fetchLectureMediaData = async () => {
      setLoading(true);
      setError('');
      setSlides([]);
      setScenes([]);
      setSegments([]);

      try {
        const [slidesRes, scenesRes, transcriptRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/lectures/${lectureId}/slides`),
          fetch(`${API_BASE_URL}/api/lectures/${lectureId}/scenes`),
          fetch(`${API_BASE_URL}/api/lectures/${lectureId}/transcript`),
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

        let segmentList = [];
        if (transcriptRes.ok) {
          const transcriptData = await transcriptRes.json();
          segmentList = Array.isArray(transcriptData.segments)
            ? transcriptData.segments
            : [];
        }

        if (!isCancelled) {
          setSlides(Array.isArray(slidesData.slides) ? slidesData.slides : []);
          setScenes(sceneList);
          setSegments(segmentList);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Error fetching lecture slides and transcript.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchLectureMediaData();

    return () => {
      isCancelled = true;
    };
  }, [lectureId]);

  const jumpToTimestamp = (seconds) => {
    if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds < 0) {
      return;
    }

    const videoEl = videoRef?.current || document.querySelector('video');
    if (!videoEl) return;

    videoEl.currentTime = seconds;
    videoEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    videoEl.play?.().catch(() => {});
  };

  const trimmedSearch = searchTerm.trim();

  // Pair each slide/scene with its transcript segments
  const rows = useMemo(() => {
    return slides.map((slide, index) => {
      const matchedScene =
        scenes[slide.slide_number - 1] ?? scenes[index] ?? null;

      // Primary match: backend-paired slide_number; fallback: scene start/end window
      const slideSegments = segments.filter((seg) => {
        if (seg.slide_number != null) {
          return seg.slide_number === slide.slide_number;
        }
        if (
          matchedScene &&
          typeof matchedScene.start_time === 'number' &&
          typeof matchedScene.end_time === 'number'
        ) {
          const midpoint = (seg.start_time + seg.end_time) / 2;
          return (
            midpoint >= matchedScene.start_time &&
            midpoint < matchedScene.end_time
          );
        }
        return false;
      });

      const filteredSegments = trimmedSearch
        ? slideSegments.filter((seg) =>
            seg.text.toLowerCase().includes(trimmedSearch.toLowerCase())
          )
        : slideSegments;

      return {
        slide,
        index,
        matchedScene,
        slideSegments,
        filteredSegments,
      };
    });
  }, [slides, scenes, segments, trimmedSearch]);

  const visibleRows = useMemo(() => {
    if (!trimmedSearch) return rows;
    return rows.filter((row) => row.filteredSegments.length > 0);
  }, [rows, trimmedSearch]);

  if (!lectureId) return null;

  return (
    <div style={tableStyles.wrapper}>
      <div style={tableStyles.headerBar}>
        <h3 style={tableStyles.heading}>Scenes, Slides & Paired Transcript</h3>
        {segments.length > 0 && (
          <input
            type="search"
            placeholder="Filter transcript across scenes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={tableStyles.searchInput}
          />
        )}
      </div>

      {loading && (
        <p style={tableStyles.infoText}>Loading slides and transcript...</p>
      )}

      {error && <p style={tableStyles.errorText}>{error}</p>}

      {!loading && !error && slides.length === 0 && (
        <p style={tableStyles.infoText}>
          No extracted slides found for this lecture.
        </p>
      )}

      {!loading && !error && slides.length > 0 && visibleRows.length === 0 && (
        <p style={tableStyles.infoText}>
          No transcript matches for &ldquo;{trimmedSearch}&rdquo;.
        </p>
      )}

      {!loading && !error && visibleRows.length > 0 && (
        <div style={tableStyles.scrollContainer}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Slide & Scene</th>
                <th style={tableStyles.th}>Paired Transcript</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ slide, matchedScene, filteredSegments }) => {
                const imageUrl = `${API_BASE_URL}/api/lectures/${lectureId}/slides/${slide.slide_number}/image`;
                const hasStartTime =
                  typeof matchedScene?.start_time === 'number' &&
                  !Number.isNaN(matchedScene.start_time) &&
                  matchedScene.start_time >= 0;

                const sceneRangeLabel = matchedScene
                  ? `${formatTimestamp(matchedScene.start_time)} – ${formatTimestamp(matchedScene.end_time)}`
                  : '—';

                return (
                  <tr
                    key={slide.slide_id ?? slide.slide_number}
                    style={tableStyles.tr}
                  >
                    <td style={tableStyles.sceneCell}>
                      <div style={tableStyles.slideMeta}>
                        <strong>Slide {slide.slide_number}</strong>
                        {hasStartTime ? (
                          <button
                            type="button"
                            onClick={() =>
                              jumpToTimestamp(matchedScene.start_time)
                            }
                            title="Jump video to start of scene"
                            style={tableStyles.sceneTimeButton}
                          >
                            {sceneRangeLabel}
                          </button>
                        ) : (
                          <span style={tableStyles.timestamp}>
                            {sceneRangeLabel}
                          </span>
                        )}
                      </div>

                      <img
                        src={imageUrl}
                        alt={`Slide ${slide.slide_number}`}
                        style={tableStyles.thumbnail}
                        loading="lazy"
                      />

                      <a
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={tableStyles.link}
                      >
                        Open PNG
                      </a>
                    </td>

                    <td style={tableStyles.transcriptCell}>
                      {filteredSegments.length === 0 ? (
                        <span style={tableStyles.emptyTranscript}>
                          No transcript spoken during this scene.
                        </span>
                      ) : (
                        <ul style={tableStyles.segmentList}>
                          {filteredSegments.map((segment) => {
                            const isPlaying =
                              currentTime >= segment.start_time &&
                              currentTime < segment.end_time;

                            return (
                              <li
                                key={
                                  segment.segment_id ??
                                  `${segment.start_time}-${segment.end_time}`
                                }
                                style={{
                                  ...tableStyles.segmentItem,
                                  backgroundColor: isPlaying
                                    ? '#e7f1ff'
                                    : 'transparent',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    jumpToTimestamp(segment.start_time)
                                  }
                                  title="Jump video to this transcript segment"
                                  style={tableStyles.timeButton}
                                >
                                  {formatTimestamp(segment.start_time)}
                                </button>
                                <span style={tableStyles.segmentText}>
                                  {highlightText(segment.text, trimmedSearch)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
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
  headerBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '12px',
  },
  heading: {
    margin: 0,
    fontSize: '1.05rem',
    color: '#222',
  },
  searchInput: {
    padding: '7px 11px',
    fontSize: '0.9rem',
    borderRadius: '4px',
    border: '1px solid #ccc',
    minWidth: '220px',
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
  sceneCell: {
    width: '200px',
    padding: '12px',
    verticalAlign: 'top',
    borderRight: '1px solid #e9ecef',
    color: '#333',
  },
  transcriptCell: {
    padding: '10px 12px',
    verticalAlign: 'top',
    color: '#333',
  },
  slideMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '6px',
    marginBottom: '8px',
  },
  thumbnail: {
    width: '160px',
    height: 'auto',
    borderRadius: '4px',
    border: '1px solid #ddd',
    display: 'block',
    marginBottom: '8px',
  },
  timestamp: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.82rem',
    color: '#444',
  },
  sceneTimeButton: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.8rem',
    color: '#0056b3',
    backgroundColor: '#eef5ff',
    border: '1px solid #b6d4fe',
    borderRadius: '4px',
    padding: '2px 6px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  link: {
    color: '#0056b3',
    textDecoration: 'none',
    fontWeight: '500',
    fontSize: '0.85rem',
  },
  emptyTranscript: {
    fontSize: '0.85rem',
    color: '#666',
    fontStyle: 'italic',
  },
  segmentList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  segmentItem: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    padding: '4px 6px',
    borderRadius: '4px',
  },
  timeButton: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.82rem',
    color: '#0056b3',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'underline',
    flexShrink: 0,
  },
  segmentText: {
    color: '#222',
    lineHeight: 1.4,
  },
  mark: {
    backgroundColor: '#ffe066',
    padding: 0,
  },
};

export default SlidesTable;