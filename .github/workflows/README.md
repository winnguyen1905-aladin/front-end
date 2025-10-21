# Frontend CI/CD Workflows

## 📋 Workflows

### 1. **ci-cd.yml** - Main Pipeline
- **Test**: Build & TypeScript check on every push/PR
- **Deploy**: Deploy to production on `main` branch push using Nginx

### 2. **code-quality.yml** - Code Quality
- Runs on pull requests
- Security audit & type checking

### 3. **cleanup.yml** - System Cleanup  
- Daily cleanup at 2 AM UTC
- Removes old deployments & logs

## 🚀 Quick Setup

### 1. Setup Runner

**Linux/Ubuntu:**
```bash
# Run setup script
chmod +x .github/scripts/setup-runner.sh
./.github/scripts/setup-runner.sh
```

**Manual setup:**
```bash
# 1. Create runner directory
mkdir ~/actions-runner-frontend && cd ~/actions-runner-frontend

# 2. Download & extract runner
curl -o actions-runner-linux-x64-2.329.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.329.0/actions-runner-linux-x64-2.329.0.tar.gz
tar xzf ./actions-runner-linux-x64-2.329.0.tar.gz

# 3. Get token from: https://github.com/winuguyen1905-aladin/front-end/settings/actions/runners/new

# 4. Configure
./config.sh --url https://github.com/winuguyen1905-aladin/front-end --token YOUR_TOKEN

# 5. Run as service
sudo ./svc.sh install && sudo ./svc.sh start

# Or run manually
./run.sh
```

### 2. Verify Setup

- **Runner Status**: https://github.com/winuguyen1905-aladin/front-end/settings/actions/runners
- **Frontend**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 🛠️ Development Workflow

```bash
# 1. Create feature branch
git checkout -b feature/your-feature

# 2. Make changes and push
git add . && git commit -m "feat: your changes"
git push origin feature/your-feature

# 3. Create PR → develop
# CI will run code-quality checks

# 4. Merge to main for production deployment
git checkout main && git merge develop
git push origin main
# CI will deploy to production
```

## 📊 Monitoring

### Check Deployment
```bash
# Frontend status
curl http://localhost:3000/health

# Nginx status  
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/error.log
```

### Using Makefile
```bash
make status      # Show deployment status
make info        # Show system info
make deploy      # Deploy locally
make test-local  # Test workflow
```

## 🔧 Configuration

### Change Port
Edit `.github/workflows/ci-cd.yml`:
```yaml
listen 3000;  # Change to your port
```

### Environment Variables
Add to nginx config in workflow:
```bash
# In deployment step
echo "window.ENV = { API_URL: 'https://api.domain.com' };" > /var/www/aladin-frontend/current/env.js
```

## 🐛 Troubleshooting

### Runner Issues
```bash
# Check runner logs
cd ~/actions-runner-frontend
./run.sh  # Run manually to see errors

# Restart service
sudo ./svc.sh stop && sudo ./svc.sh start
```

### Deployment Issues
```bash
# Check nginx config
sudo nginx -t

# Check deploy directory
ls -la /var/www/aladin-frontend/

# Check permissions
sudo chown -R www-data:www-data /var/www/aladin-frontend/
```

### Port in Use
```bash
# Check what's using port 3000
sudo netstat -tulpn | grep 3000

# Kill process if needed
sudo kill -9 <PID>
```

---

**Need help?** Create an issue or check logs with `make status`
