import React from 'react';
import { StreamProvider } from '@context/StreamContext';
import { VideoConferencePage } from '@/page';

const App: React.FC = () => {
  return (
      <StreamProvider>
        <VideoConferencePage />
      </StreamProvider>
  );
};

export default App;
