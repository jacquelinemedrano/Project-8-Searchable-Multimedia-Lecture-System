import VideoUploader from './VideoUploader';
import UploadedLectures from './UploadedLectures';
import React, { useState } from 'react';

function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <main style={styles.appContainer}>
      <VideoUploader onUploadSuccess={handleUploadSuccess} />
      <UploadedLectures refreshKey={refreshKey} />
    </main>
  );
}

const styles = {
  appContainer: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    minHeight: '100vh',
    backgroundColor: 'darkgray',
    padding: '40px 20px',
    color: '#333',
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px',
  },
};

export default App;