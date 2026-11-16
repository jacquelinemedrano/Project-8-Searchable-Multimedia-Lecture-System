import React from 'react';
import VideoUploader from './VideoUploader';

function App() {
  return (
    <div style={styles.appContainer}>
      <header style={styles.header}>
        <p>Right now, this just uploads things to the backend.</p>
      </header>
      <main>
        <VideoUploader />
      </main>
    </div>
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