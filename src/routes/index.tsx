import { createBrowserRouter, Navigate } from 'react-router-dom';
import { StreamProvider } from '@context/StreamContext';
import { Home, VideoConferencePage } from '@/page';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },  
  {
    path: '/conference',
    element:  <StreamProvider>
      <VideoConferencePage />
    </StreamProvider>,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default router;
