import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserRegistrationModal } from '../components/UserRegistrationModal';
import { UserStorage } from '../utils/userStorage';

export const Home: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already registered
    const isRegistered = UserStorage.isUserRegistered();
    
    if (!isRegistered) {
      setShowModal(true);
    } else {
      const storedUsername = UserStorage.getUsername();
      setUsername(storedUsername);
      UserStorage.updateLastOnline();
    }
  }, []);

  const handleRegister = (newUsername: string) => {
    UserStorage.saveUserInfo({
      name: newUsername,
      lastOnline: new Date().toISOString()
    });
    
    setUsername(newUsername);
    setShowModal(false);
    window.dispatchEvent(new Event('userInfoUpdated'));
  };

  return (
    <>
      <UserRegistrationModal 
        isOpen={showModal} 
        onRegister={handleRegister}
      />
      
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-8 md:p-12 text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Aladin Secure Chat
              </h1>
              {username && (
                <p className="text-gray-700 text-lg mb-4 font-medium">
                  Welcome back, <span className="text-blue-600">{username}</span>!
                </p>
              )}
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                Welcome to the secure messaging and video conferencing platform. 
                Connect with others through chat or video calls.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link 
                  to="/chat" 
                  className="inline-flex items-center justify-center bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Open Conversations 
                </Link>
                
                <Link 
                  to="/global-chat" 
                  className="inline-flex items-center justify-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Global Chat 🌍
                </Link>
                
                <Link 
                  to="/conference" 
                  className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Instant Conference Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
