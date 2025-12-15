import React from 'react';
import { StreamProvider } from '@context/StreamContext';
import router from '@/routes';
import { RouterProvider } from 'react-router-dom';

const App: React.FC = () => {
  return (
      <StreamProvider>
        <RouterProvider router={router} />
      </StreamProvider>
  );
};

export default App;
