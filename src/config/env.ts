// Environment configuration utility
export const env = {
  // App Info
  APP_NAME: import.meta.env.VITE_APP_NAME || 'Aladin Secure Chat',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
  
  // API Configuration
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
  SOCKET_URL: import.meta.env.VITE_SOCKET_URL || 'ws://localhost:8080',
  
  // Feature Flags
  IS_DEBUG: import.meta.env.VITE_ENABLE_DEBUG === 'true',
  IS_ANALYTICS_ENABLED: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  
  // Media Configuration
  MAX_FILE_SIZE: parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '10485760'),
  ALLOWED_FILE_TYPES: import.meta.env.VITE_ALLOWED_FILE_TYPES?.split(',') || ['image/jpeg', 'image/png'],
  
  // Development
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
  
  // Log Level
  LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL || 'info'
} as const;

// Helper functions
export const isDevelopment = () => env.IS_DEV;
export const isProduction = () => env.IS_PROD;
export const isDebugEnabled = () => env.IS_DEBUG;
