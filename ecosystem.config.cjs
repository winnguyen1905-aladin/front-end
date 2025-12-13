  module.exports = {
  apps: [
    {
      // Development mode - Vite dev server
      name: 'aladin-frontend-dev',
      script: 'npm',
      args: 'run dev',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 5173,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
    },
    {
      // Production mode - Serve built static files
      name: 'aladin-frontend-prod',
      script: 'npm',
      args: 'run start',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-prod-error.log',
      out_file: './logs/pm2-prod-out.log',
      log_file: './logs/pm2-prod-combined.log',
      time: true,
    },
  ],
};

