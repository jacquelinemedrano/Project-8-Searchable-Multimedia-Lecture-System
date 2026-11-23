import React, { useEffect, useMemo, useRef, useState } from 'react';

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

// Wrap every match of the search term in <mark> so it stands out
const highlight = (text, term) => {
  if (!term) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <mark key={i} style={panelStyles.mark}>{part}</mark>
    ) : (
      part
    )
  );
};

const TranscriptPanel = ({ lectureId }) => {
  const videoRef = useRef(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(0);

  // Load the full transcript once
  useEffect(() => {
    if (!lectureId) return;
    let isCancelled = false;

    const fetchTranscript = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE_URL}/api/lectures/${lectureId}/transcript`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load transcript.');
        if (!isCancelled) setSegments(Array.isArray(data.segments) ? data.segments : []);
      } catch (err) {
        if (!isCancelled) setError(err.message || 'Error fetching transcript.');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchTranscript();
    return () => {
      isCancelled = true;
    };
  }, [lectureId]);

  // Filter in the browser so results update as you type.
  // (The same search is also available from the backend at /api/lectures/<id>/search?q=)
  const term = searchTerm.trim();
  const visibleSegments = useMemo(() => {
    if (!term) return segments;
    const lower = term.toLowerCase();
    return segments.filter((s) => s.text.toLowerCase().includes(lower));
  }, [segments, term]);

  // Click a timestamp -> jump the video there and play
  const jumpTo = (seconds) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    video.play().catch(() => {});
  };

  if (!lectureId) return null;

  return (
    <div style={panelStyles.wrapper}>
      <h3 style={panelStyles.heading}>Lecture Transcript</h3>

      <video
        ref={videoRef}
        src={`${API_BASE_URL}/api/lectures/${lectureId}/video`}
        controls
        style={panelStyles.video}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
      />

      <input
        type="search"
        placeholder="Search the lecture (e.g. 'binary tree')"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={panelStyles.search}
      />

      {term && !loading && (
        <p style={panelStyles.infoText}>
          {visibleSegments.length} match{visibleSegments.length === 1 ? '' : 'es'} for "{term}"
        </p>
      )}

      {loading && <p style={panelStyles.infoText}>Loading transcript...</p>}
      {error && <p style={panelStyles.errorText}>{error}</p>}

      {!loading && !error && segments.length === 0 && (
        <p style={panelStyles.infoText}>No transcript available for this lecture.</p>
      )}

      {!loading && !error && segments.length > 0 && (
        <ul style={panelStyles.list}>
          {visibleSegments.map((segment) => {
            const isPlaying =
              currentTime >= segment.start_time && currentTime < segment.end_time;
            return (
              <li
                key={segment.segment_id ?? segment.start_time}
                style={{
                  ...panelStyles.row,
                  backgroundColor: isPlaying ? '#e7f1ff' : 'transparent',
                }}
              >
                <button
                  type="button"
                  onClick={() => jumpTo(segment.start_time)}
                  style={panelStyles.timeButton}
                  title="Jump to this moment"
                >
                  {formatTimestamp(segment.start_time)}
                </button>
                {segment.slide_number != null && (
                  <span style={panelStyles.slideTag}>Slide {segment.slide_number}</span>
                )}
                <span style={panelStyles.text}>{highlight(segment.text, term)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const panelStyles = {
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
  video: {
    width: '100%',
    maxHeight: '300px',
    borderRadius: '6px',
    backgroundColor: '#000',
    marginBottom: '12px',
  },
  search: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '0.95rem',
    borderRadius: '4px',
    border: '1px solid #ccc',
    boxSizing: 'border-box',
    marginBottom: '8px',
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
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    maxHeight: '360px',
    overflowY: 'auto',
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    borderRadius: '6px',
  },
  row: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
    padding: '8px 12px',
    borderBottom: '1px solid #e9ecef',
    fontSize: '0.9rem',
  },
  timeButton: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.85rem',
    color: '#0056b3',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'underline',
    flexShrink: 0,
  },
  slideTag: {
    fontSize: '0.75rem',
    color: '#555',
    backgroundColor: '#f1f3f5',
    borderRadius: '3px',
    padding: '1px 6px',
    flexShrink: 0,
  },
  text: {
    color: '#222',
  },
  mark: {
    backgroundColor: '#ffe066',
    padding: 0,
  },
};

export default TranscriptPanel;
