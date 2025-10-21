import { createBrowserRouter, Navigate } from 'react-router-dom';
import { VideoConference } from '@pages/meeting/VideoConference';
import { Home } from '@pages/Home';
import { GlobalChatPage } from '@pages/chat/GlobalChatPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  // {
  //   path: '/chat',
  //   element: <ChatPage />,
  // },
  {
    path: '/global-chat',
    element: <GlobalChatPage currentUserName="" />,
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
