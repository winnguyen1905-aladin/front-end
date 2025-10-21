# Aladin Secure Chat - Front-end

[![CI/CD Pipeline](https://github.com/winuguyen1905-aladin/front-end/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/winuguyen1905-aladin/front-end/actions/workflows/ci-cd.yml)
[![Code Quality](https://github.com/winuguyen1905-aladin/front-end/actions/workflows/code-quality.yml/badge.svg)](https://github.com/winuguyen1905-aladin/front-end/actions/workflows/code-quality.yml)

Modern, secure chat application built with React, TypeScript, and Vite.

## 🚀 Features

- **Real-time Messaging**: Socket.io integration for instant communication
- **Video Calls**: MediaSoup client for high-quality video conferencing
- **Modern UI**: Built with React 18 and Tailwind CSS
- **Type-safe**: Full TypeScript support
- **Optimized Build**: Vite for lightning-fast development and optimized production builds
- **Docker Ready**: Multi-stage Docker builds with Nginx
- **CI/CD**: Automated testing and deployment with GitHub Actions

## 📋 Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Docker**: 20.x or higher (for containerized deployment)

## 🛠️ Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Access at http://localhost:5173
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Deployment

```bash
# Using Make (recommended)
make setup              # Initial setup
make deploy-local       # Build and deploy locally

# Or using Docker directly
docker network create aladin-network
docker build -t aladin-frontend .
docker run -d --name aladin-frontend -p 3000:80 --network aladin-network aladin-frontend
```

### Using Docker Compose

```bash
# Start with docker-compose
make docker-compose-up

# Or manually
docker network create aladin-network
docker-compose -f docker-compose.dev.yml up --build
```

## 📦 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run build:prod   # Build for production (production mode)
npm run preview      # Preview production build
npm run clean        # Clean build artifacts
```

## 🐳 Docker Commands

Using the provided Makefile:

```bash
make help              # Show all available commands
make dev               # Run development server
make build             # Build application
make docker-build      # Build Docker image
make docker-run        # Run Docker container
make docker-stop       # Stop Docker container
make test-local        # Test complete workflow locally
make status            # Show Docker status
make cleanup           # Cleanup Docker resources
```

## 🔧 Environment Variables

Create a `.env.local` file in the root directory:

```bash
# API Configuration
VITE_API_URL=http://localhost:8080
VITE_SOCKET_URL=ws://localhost:8080

# Application Settings
VITE_APP_NAME=Aladin Secure Chat
VITE_APP_VERSION=1.0.0
```

## 🚢 CI/CD Pipeline

This project uses GitHub Actions for automated CI/CD. The pipeline includes:

1. **Build & Test**: Automated testing on every push and PR
2. **Docker Build**: Build and push Docker images to GitHub Container Registry
3. **Deploy**: Automatic deployment to staging/production
4. **Code Quality**: Security audits and code quality checks
5. **Cleanup**: Automated cleanup of old artifacts

### Setup CI/CD

For detailed CI/CD setup instructions, see:
- [Quick Setup Guide](.github/SETUP_GUIDE.md)
- [Complete Workflow Documentation](.github/workflows/README.md)

**Quick setup:**

```bash
# Run automated setup script
chmod +x .github/scripts/setup-runner.sh
./.github/scripts/setup-runner.sh
```

### Test Workflow Locally

```bash
# Test complete workflow locally
chmod +x .github/scripts/test-workflow.sh
./.github/scripts/test-workflow.sh

# Or using Make
make ci-test
```

## 📚 Project Structure

```
front-end/
├── src/
│   ├── components/          # React components
│   ├── context/            # React contexts
│   ├── hook/               # Custom hooks
│   ├── page/               # Page components
│   ├── routes/             # Route configuration
│   ├── socket/             # Socket.io integration
│   └── utils/              # Utility functions
├── public/                 # Static assets
├── .github/
│   ├── workflows/          # GitHub Actions workflows
│   ├── scripts/            # Setup and utility scripts
│   └── SETUP_GUIDE.md      # CI/CD setup guide
├── dist/                   # Build output (generated)
├── Dockerfile              # Docker configuration
├── docker-compose.dev.yml  # Docker Compose for development
├── nginx.conf              # Nginx configuration
├── Makefile                # Make commands
└── package.json            # Dependencies and scripts
```

## 🏗️ Tech Stack

- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 4
- **Real-time**: Socket.io Client
- **Video**: MediaSoup Client
- **Routing**: React Router DOM
- **Web Server**: Nginx (in production)

## 🔒 Security

- Security headers configured in Nginx
- XSS protection enabled
- Content type sniffing prevention
- Frame options for clickjacking protection
- Regular dependency audits via GitHub Actions

## 📊 Monitoring

### Check Application Health

```bash
# Production
curl http://localhost:3000/health

# Staging
curl http://localhost:3001/health
```

### View Logs

```bash
# Docker container logs
docker logs aladin-frontend

# Follow logs
docker logs -f aladin-frontend
```

### Docker Status

```bash
# Using Make
make status

# Or manually
docker ps | grep aladin-frontend
docker stats aladin-frontend --no-stream
```

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Change port in Makefile or docker run command
   # Default ports: 3000 (production), 3001 (staging)
   ```

2. **Build fails**
   ```bash
   # Clear cache and rebuild
   npm cache clean --force
   rm -rf node_modules dist
   npm install
   npm run build
   ```

3. **Docker network not found**
   ```bash
   docker network create aladin-network
   ```

For more troubleshooting tips, see [Setup Guide](.github/SETUP_GUIDE.md#-common-issues).

## 🤝 Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Ensure tests pass and code is formatted
4. Create a Pull Request to `develop`
5. Wait for CI checks to pass
6. Request review

## 📝 License

This project is part of Aladin Secure Chat application.

## 🔗 Related Projects

- [Back-end Repository](https://github.com/winuguyen1905-aladin/back-end)

## 📖 Documentation

- [CI/CD Setup Guide](.github/SETUP_GUIDE.md)
- [Workflow Documentation](.github/workflows/README.md)
- [Docker Documentation](https://docs.docker.com/)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)

## 🎯 Deployment

### Production Deployment

Push to `main` branch triggers automatic deployment to production:

```bash
git checkout main
git merge develop
git push origin main
```

### Staging Deployment

Push to `develop` branch triggers automatic deployment to staging:

```bash
git checkout develop
git push origin develop
```

### Manual Deployment

```bash
# Using Docker
make deploy-local

# Or using docker-compose
make docker-compose-up
```

## 💡 Tips

- Use `make help` to see all available commands
- Test locally with `make test-local` before pushing
- Monitor GitHub Actions tab for CI/CD status
- Check container logs regularly: `docker logs -f aladin-frontend`
- Keep dependencies updated: `npm outdated`

---

**Need help?** Check the [Setup Guide](.github/SETUP_GUIDE.md) or create an issue.
