# Quick Setup Guide - GitHub Actions CI/CD

## 🚀 Setup trong 5 phút

### Bước 1: Chuẩn bị môi trường

**Yêu cầu:**
- Docker đã cài đặt
- Node.js 18+ đã cài đặt
- Git đã cài đặt

**Kiểm tra:**
```bash
docker --version
node --version
git --version
```

### Bước 2: Setup Docker Network

```bash
docker network create aladin-network
```

### Bước 3: Setup GitHub Runner

#### Option A: Sử dụng Script tự động (Khuyến nghị)

```bash
# Clone repository
git clone https://github.com/winuguyen1905-aladin/front-end.git
cd front-end

# Chạy setup script
chmod +x .github/scripts/setup-runner.sh
./.github/scripts/setup-runner.sh
```

#### Option B: Setup thủ công

**Trên Linux/macOS:**

```bash
# 1. Tạo thư mục
mkdir ~/actions-runner-frontend && cd ~/actions-runner-frontend

# 2. Download runner
curl -o actions-runner-linux-x64-2.329.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.329.0/actions-runner-linux-x64-2.329.0.tar.gz

# 3. Extract
tar xzf ./actions-runner-linux-x64-2.329.0.tar.gz

# 4. Lấy token từ GitHub
# Vào: https://github.com/winuguyen1905-aladin/front-end/settings/actions/runners/new

# 5. Configure (thay YOUR_TOKEN bằng token thực tế)
./config.sh --url https://github.com/winuguyen1905-aladin/front-end --token YOUR_TOKEN

# 6. Run
./run.sh
```

**Trên Windows:**

```powershell
# 1. Tạo thư mục
New-Item -ItemType Directory -Path C:\actions-runner-frontend
cd C:\actions-runner-frontend

# 2. Download
Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.329.0/actions-runner-win-x64-2.329.0.zip -OutFile actions-runner.zip

# 3. Extract
Expand-Archive -Path actions-runner.zip -DestinationPath .

# 4. Configure (lấy token từ GitHub Settings → Actions → Runners)
.\config.cmd --url https://github.com/winuguyen1905-aladin/front-end --token YOUR_TOKEN

# 5. Run
.\run.cmd
```

### Bước 4: Verify Setup

1. **Check Runner Status:**
   - Vào: https://github.com/winuguyen1905-aladin/front-end/settings/actions/runners
   - Runner phải hiển thị trạng thái "Idle" (màu xanh)

2. **Check Docker Network:**
   ```bash
   docker network ls | grep aladin-network
   ```

3. **Test Workflow:**
   ```bash
   # Push một thay đổi nhỏ để trigger workflow
   git commit --allow-empty -m "test: trigger workflow"
   git push
   ```

4. **Monitor Workflow:**
   - Vào: https://github.com/winuguyen1905-aladin/front-end/actions
   - Xem workflow run

## 🔧 Configuration

### Thay đổi API URLs

Tạo file `.env.local` trong thư mục front-end:

```bash
# API Configuration
VITE_API_URL=http://localhost:8080
VITE_SOCKET_URL=ws://localhost:8080

# Application Settings
VITE_APP_NAME=Aladin Secure Chat
```

### Thay đổi Port Deployment

Edit file `.github/workflows/ci-cd.yml`:

```yaml
# Thay đổi port production (mặc định: 3000)
-p 3000:80  # → -p YOUR_PORT:80

# Thay đổi port staging (mặc định: 3001)
-p 3001:80  # → -p YOUR_PORT:80
```

### Thêm Environment Variables vào Deployment

Edit trong section `Run new container`:

```yaml
docker run -d \
  --name aladin-frontend \
  -p 3000:80 \
  -e VITE_API_URL=https://api.yourdomain.com \
  -e VITE_SOCKET_URL=wss://socket.yourdomain.com \
  ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
```

## 📊 Monitoring & Debugging

### Check Running Containers

```bash
docker ps
```

### Check Container Logs

```bash
# Production
docker logs aladin-frontend

# Staging
docker logs aladin-frontend-staging

# Follow logs
docker logs -f aladin-frontend
```

### Check Health

```bash
# Production
curl http://localhost:3000/health

# Staging
curl http://localhost:3001/health
```

### Access Container

```bash
docker exec -it aladin-frontend sh
```

### Check Runner Logs

```bash
# If running as service
journalctl -u actions.runner.* -f

# If running manually
# Logs hiển thị trong terminal nơi chạy ./run.sh
```

## 🐛 Common Issues

### Issue 1: Runner không kết nối

**Triệu chứng:** Runner hiển thị "Offline" trong GitHub

**Giải pháp:**
```bash
cd ~/actions-runner-frontend
./run.sh
# Xem error messages trong output
```

### Issue 2: Port đã được sử dụng

**Triệu chứng:** Container không start, error "port already allocated"

**Giải pháp:**
```bash
# Check port usage
netstat -tulpn | grep 3000

# Stop container đang dùng port
docker stop <container_id>

# Hoặc thay đổi port trong workflow
```

### Issue 3: Docker network not found

**Triệu chứng:** Error "network aladin-network not found"

**Giải pháp:**
```bash
docker network create aladin-network
```

### Issue 4: Build fails

**Triệu chứng:** Build step fails trong workflow

**Giải pháp:**
```bash
# Test build locally
npm ci
npm run build

# Check TypeScript errors
npx tsc --noEmit

# Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Issue 5: Permission denied

**Triệu chứng:** Docker commands fail với permission error

**Giải pháp:**
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login again
# Or restart docker service
sudo systemctl restart docker
```

## 🔄 Update Runner

Khi có version mới của GitHub Runner:

```bash
cd ~/actions-runner-frontend

# Remove runner
./config.sh remove

# Download new version
curl -o actions-runner-linux-x64-NEW_VERSION.tar.gz -L \
  https://github.com/actions/runner/releases/download/vNEW_VERSION/actions-runner-linux-x64-NEW_VERSION.tar.gz

# Extract
tar xzf ./actions-runner-linux-x64-NEW_VERSION.tar.gz

# Reconfigure
./config.sh --url https://github.com/winuguyen1905-aladin/front-end --token NEW_TOKEN

# Run
./run.sh
```

## 📚 Additional Resources

- [Complete Workflow Documentation](.github/workflows/README.md)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Self-hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [Docker Docs](https://docs.docker.com/)

## 💡 Best Practices

1. **Security:**
   - Chạy runner dưới user thường (không phải root)
   - Giới hạn permissions của runner
   - Update runner thường xuyên

2. **Performance:**
   - Monitor disk space trên runner machine
   - Clean up old Docker images định kỳ
   - Use SSD cho runner workspace

3. **Reliability:**
   - Run runner as service (auto-restart)
   - Setup monitoring alerts
   - Backup runner configuration

4. **Workflow:**
   - Test trên staging trước khi deploy production
   - Review code trong PRs
   - Monitor deployment logs

---

**Cần hỗ trợ?** Tạo issue hoặc check [workflow documentation](.github/workflows/README.md)

