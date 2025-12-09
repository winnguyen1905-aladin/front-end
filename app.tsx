import React from 'react';
import { StreamProvider } from '@context/StreamContext';
import { VideoConference } from '@pages/index';

const App: React.FC = () => {
  return (
      <StreamProvider>
        <VideoConference />
      </StreamProvider>
  );
};

export default App;
