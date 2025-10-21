import React, { useState, useEffect } from 'react';

interface LoginPageProps {
  onLogin: (username: string) => void;
}

interface StoredUser {
  username: string;
  lastLogin: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [storedUser, setStoredUser] = useState<StoredUser | null>(null);
  const [showNewUserForm, setShowNewUserForm] = useState(false);

  useEffect(() => {
    // Check for stored user on component mount
    const stored = localStorage.getItem('chatUser');
    if (stored) {
      try {
        const userData: StoredUser = JSON.parse(stored);
        setStoredUser(userData);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('chatUser');
      }
    }
  }, []);

  const handleLogin = async (usernameToUse: string) => {
    if (!usernameToUse.trim()) return;

    setIsLoading(true);
    
    try {
      // Simulate validation (you can add real validation here)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Save user to localStorage
      const userData: StoredUser = {
        username: usernameToUse.trim(),
        lastLogin: new Date().toISOString()
      };
      
      localStorage.setItem('chatUser', JSON.stringify(userData));
      
      // Call parent callback to proceed with connection
      onLogin(usernameToUse.trim());
      
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewUser = () => {
    setShowNewUserForm(true);
    setStoredUser(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('chatUser');
    setStoredUser(null);
    setShowNewUserForm(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      handleLogin(username);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Welcome to Secure Chat
          </h1>
          <p className="text-gray-600">
            Connect with friends securely
          </p>
        </div>

        {/* Returning User */}
        {storedUser && !showNewUserForm && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                {storedUser.username.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-xl font-semibold text-gray-800">
                Welcome back, {storedUser.username}!
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Last login: {new Date(storedUser.lastLogin).toLocaleDateString()}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleLogin(storedUser.username)}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Connecting...
                  </span>
                ) : (
                  'Continue as ' + storedUser.username
                )}
              </button>

              <button
                onClick={handleNewUser}
                className="w-full text-blue-600 py-2 px-4 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Use different account
              </button>

              <button
                onClick={handleLogout}
                className="w-full text-red-600 py-2 px-4 rounded-lg hover:bg-red-50 transition-colors text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        )}

        {/* New User Form */}
        {(!storedUser || showNewUserForm) && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-2xl font-bold mx-auto mb-4">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800">
                {showNewUserForm ? 'Switch Account' : 'Create Account'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Choose a username to get started
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your username"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your username will be visible to other users
                </p>
              </div>

              <button
                onClick={() => handleLogin(username)}
                disabled={!username.trim() || isLoading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  'Start Chatting'
                )}
              </button>

              {showNewUserForm && (
                <button
                  onClick={() => {
                    setShowNewUserForm(false);
                    setUsername('');
                  }}
                  className="w-full text-gray-600 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            Your data is stored locally and encrypted in transit
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

