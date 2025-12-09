import { createBrowserRouter, Navigate } from 'react-router-dom';
import { VideoConference } from '@pages/meeting/VideoConference';
import { Home } from '@pages/Home';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },  
  {
    path: '/conference',
    element: <VideoConference />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default router;
