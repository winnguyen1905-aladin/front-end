import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export const Welcome: React.FC = () => {
  const navigate = useNavigate();

  const handleTryNow = () => {
    // Set new member flag to false when user clicks "Try Now"
    localStorage.setItem('newMember', 'false');
    navigate('/conference');
  };

  useEffect(() => {
    // Check if user is already familiar with the app
    const isNewMember = localStorage.getItem('newMember');
    if (isNewMember === 'false') {
      // Redirect existing users to home
      navigate('/');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0f23] via-[#1a1a2e] to-[#16213e] relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse-glow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse-glow" style={{animationDelay: '1.5s'}}></div>
        <div className="absolute top-3/4 left-1/2 w-48 h-48 bg-green-500/10 rounded-full blur-3xl animate-pulse-glow" style={{animationDelay: '3s'}}></div>
      </div>

      {/* Geometric Pattern Overlay */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[linear-gradient(30deg,transparent_48%,rgba(255,255,255,0.05)_49%,rgba(255,255,255,0.05)_51%,transparent_52%)] bg-[length:60px_60px]"></div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-4xl text-center animate-fade-in">
          {/* Main Title */}
          <div className="mb-8 animate-bounce-in">
            <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-green-400 bg-clip-text text-transparent mb-4 animate-gradient">
              Aladin
            </h1>
            <p className="text-2xl md:text-3xl text-gray-300 font-light tracking-wide">
              Video Conferencing Platform
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 animate-slide-up" style={{animationDelay: '0.5s'}}>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-105 animate-float">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">HD Video Calls</h3>
              <p className="text-gray-400">Crystal clear video communication with advanced encoding</p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-105 animate-float" style={{animationDelay: '0.2s'}}>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Secure & Private</h3>
              <p className="text-gray-400">End-to-end encryption ensures your conversations stay private</p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-105 animate-float" style={{animationDelay: '0.4s'}}>
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Lightning Fast</h3>
              <p className="text-gray-400">Optimized performance for seamless real-time communication</p>
            </div>
          </div>

          {/* Description */}
          <div className="mb-12 animate-slide-up" style={{animationDelay: '0.7s'}}>
            <p className="text-lg md:text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto mb-6">
              Experience the future of video conferencing with our cutting-edge platform. 
              Built with modern web technologies for superior performance and user experience.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-400">
              <span className="bg-white/10 px-3 py-1 rounded-full">WebRTC Technology</span>
              <span className="bg-white/10 px-3 py-1 rounded-full">Real-time Communication</span>
              <span className="bg-white/10 px-3 py-1 rounded-full">Cross-platform Compatible</span>
            </div>
          </div>

          {/* Call to Action */}
          <div className="animate-slide-up" style={{animationDelay: '1s'}}>
            <button
              onClick={handleTryNow}
              className="group relative px-12 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 rounded-full text-white font-semibold text-lg shadow-2xl hover:shadow-blue-500/25 transition-all duration-300 transform hover:scale-105 animate-pulse-glow"
            >
              <span className="relative z-10">Try Now - It's Free!</span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 rounded-full blur opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
            
            <p className="text-gray-400 mt-4 text-sm">
              No signup required • Instant access • Privacy first
            </p>
          </div>

          {/* Bottom Navigation */}
          <div className="mt-16 animate-fade-in" style={{animationDelay: '1.2s'}}>
            <Link 
              to="/" 
              className="text-gray-400 hover:text-white transition-colors duration-300 text-sm font-medium"
            >
              Already familiar? Go to main app →
            </Link>
          </div>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 right-20 w-2 h-2 bg-blue-400 rounded-full animate-pulse opacity-60"></div>
      <div className="absolute bottom-32 left-16 w-1 h-1 bg-purple-400 rounded-full animate-pulse opacity-40" style={{animationDelay: '1s'}}></div>
      <div className="absolute top-1/2 left-10 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse opacity-50" style={{animationDelay: '2s'}}></div>
    </div>
  );
};

export default Welcome;
