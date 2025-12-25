import { createBrowserRouter, Navigate } from 'react-router-dom';
import { StreamProvider } from '@context/StreamContext';
import { TranscriptPage, VideoConferencePage } from '@/page';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/conference" replace />,
  },
  {
    path: '/conference',
    element: <StreamProvider>
      <VideoConferencePage />
    </StreamProvider>,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
  {
    path: '/transcript',
    element: <TranscriptPage />
  },
]);

export default router;
