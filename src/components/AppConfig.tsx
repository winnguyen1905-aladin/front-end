import React from 'react';
import { env, isDevelopment, isDebugEnabled } from '../config/env';

const AppConfig: React.FC = () => {
  // Example: Conditional rendering based on environment
  if (!isDevelopment()) {
    return null; // Don't show in production
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg text-sm max-w-sm">
      <h3 className="font-bold mb-2">🔧 Development Info</h3>
      
      <div className="space-y-1">
        <div><strong>App:</strong> {env.APP_NAME} v{env.APP_VERSION}</div>
        <div><strong>API:</strong> {env.API_URL}</div>
        <div><strong>Socket:</strong> {env.SOCKET_URL}</div>
        <div><strong>Debug:</strong> {isDebugEnabled() ? '✅' : '❌'}</div>
        <div><strong>Mode:</strong> {env.IS_DEV ? 'Development' : 'Production'}</div>
        <div><strong>Log Level:</strong> {env.LOG_LEVEL}</div>
      </div>

      {isDebugEnabled() && (
        <div className="mt-2 text-xs text-yellow-300">
          Debug mode is enabled
        </div>
      )}
    </div>
  );
};

export default AppConfig;
