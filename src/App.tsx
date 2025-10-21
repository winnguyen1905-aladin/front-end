import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './page/auth/LoginPage';
import ChatPage from './page/chat/ChatPage';
import Home from './page/Home';
import { UserStorage } from './utils/userStorage';

interface StoredUser {
  username: string;
  lastLogin: string;
}

function App() {
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user on app start using UserStorage
    const userInfo = UserStorage.getUserInfo();
    console.log('📱 App.tsx - Checking stored user info:', userInfo);
    if (userInfo) {
      setCurrentUser({
        username: userInfo.name,
        lastLogin: userInfo.lastOnline
      });
      console.log('✅ App.tsx - Current user set:', userInfo.name);
    } else {
      console.log('⚠️ App.tsx - No stored user info found');
    }
    setIsLoading(false);

    // Listen for storage chan  ges (e.g., when user registers on Home page)
    const handleStorageChange = () => {
      console.log('🔄 App.tsx - Storage changed, reloading user info...');
      const updatedUserInfo = UserStorage.getUserInfo();
      if (updatedUserInfo) {
        setCurrentUser({
          username: updatedUserInfo.name,
          lastLogin: updatedUserInfo.lastOnline
        });
        console.log('✅ App.tsx - User updated:', updatedUserInfo.name);
      } else {
        setCurrentUser(null);
        console.log('⚠️ App.tsx - User cleared');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // Custom event for same-window changes
    window.addEventListener('userInfoUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userInfoUpdated', handleStorageChange);
    };
  }, []);

  const handleLogin = (username: string) => {
    const userData: StoredUser = {
      username: username.trim(),
      lastLogin: new Date().toISOString()
    };
    
    // Save to new UserStorage format
    UserStorage.saveUserInfo({
      name: username.trim(),
      lastOnline: new Date().toISOString()
    });
    
    setCurrentUser(userData);
    
    // Dispatch custom event for same-window updates
    window.dispatchEvent(new Event('userInfoUpdated'));
  };

  const handleLogout = () => {
    UserStorage.clearUserInfo();
    setCurrentUser(null);
    
    // Dispatch custom event for same-window updates
    window.dispatchEvent(new Event('userInfoUpdated'));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Home route - always accessible */}
            <Route 
              path="/" 
              element={<Home />} 
            />
            
            {/* Login route */}
            <Route 
              path="/login" 
              element={
                currentUser ? (
                  <Navigate to="/chat" replace />
                ) : (
                  <LoginPage onLogin={handleLogin} />
                )
              } 
            />
            
            {/* Chat route - protected */}
            <Route 
              path="/chat" 
              element={
                currentUser ? (
                  <>
                    {console.log('🚀 App.tsx - Rendering ChatPage with username:', currentUser.username)}
                    <ChatPage 
                      currentUserName={currentUser.username}
                      onLogout={handleLogout}
                    />
                  </>
                ) : (
                  <>
                    {console.log('⛔ App.tsx - No currentUser, redirecting to login')}
                    <Navigate to="/login" replace />
                  </>
                )
              } 
            />
            
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
