# GitHub Actions Workflows

Tài liệu này mô tả các workflows tự động hóa cho Aladin Front-end Repository.

## 📋 Danh sách Workflows

### 1. **CI/CD Pipeline** (`ci-cd.yml`)
Workflow chính cho việc build, test và deploy ứng dụng.

**Trigger:**
- Push vào branches: `main`, `develop`
- Pull requests vào `main`, `develop`
- Manual trigger

**Jobs:**
1. **Build and Test**: Kiểm tra code, build ứng dụng
2. **Build Docker**: Tạo Docker image và push lên GitHub Container Registry
3. **Deploy Production**: Deploy lên production (branch `main`)
4. **Deploy Staging**: Deploy lên staging (branch `develop`)
5. **Notify**: Thông báo kết quả deployment

**Yêu cầu:**
- Self-hosted runner đã được cấu hình
- Docker network `aladin-network` đã tồn tại
- Permissions: `contents: read`, `packages: write`

### 2. **Code Quality Checks** (`code-quality.yml`)
Kiểm tra chất lượng code và security.

**Trigger:**
- Pull requests vào `main`, `develop`
- Manual trigger

**Kiểm tra:**
- Security vulnerabilities (npm audit)
- TypeScript types
- Outdated packages
- Bundle sizes
- Dependency tree

### 3. **Cleanup** (`cleanup.yml`)
Dọn dẹp tự động Docker images và artifacts cũ.

**Trigger:**
- Scheduled: Hàng ngày lúc 2:00 AM UTC
- Manual trigger

**Thực hiện:**
- Xóa Docker images cũ hơn 7 ngày
- Xóa dangling images
- Clean npm cache
- Hiển thị Docker disk usage

## 🚀 Setup Instructions

### Bước 1: Tạo Docker Network
```bash
docker network create aladin-network
```

### Bước 2: Configure Self-hosted Runner

#### Trên máy Linux/macOS:
```bash
# Tạo folder cho runner
mkdir actions-runner-frontend && cd actions-runner-frontend

# Download runner (version có thể khác)
curl -o actions-runner-linux-x64-2.329.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.329.0/actions-runner-linux-x64-2.329.0.tar.gz

# Extract
tar xzf ./actions-runner-linux-x64-2.329.0.tar.gz

# Configure với token từ GitHub
./config.sh --url https://github.com/winuguyen1905-aladin/front-end --token YOUR_TOKEN

# Chạy runner
./run.sh

# Hoặc cài đặt như service
sudo ./svc.sh install
sudo ./svc.sh start
```

#### Trên Windows:
```powershell
# Tạo folder
New-Item -ItemType Directory -Path C:\actions-runner-frontend
cd C:\actions-runner-frontend

# Download runner
Invoke-WebRequest -Uri https://github.com/actions/runner/releases/download/v2.329.0/actions-runner-win-x64-2.329.0.zip -OutFile actions-runner-win-x64-2.329.0.zip

# Extract
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory("$PWD/actions-runner-win-x64-2.329.0.zip", "$PWD")

# Configure
.\config.cmd --url https://github.com/winuguyen1905-aladin/front-end --token YOUR_TOKEN

# Run
.\run.cmd

# Hoặc cài đặt như service
.\svc.sh install
.\svc.sh start
```

### Bước 3: Lấy Token để Configure Runner

1. Vào repository GitHub: `https://github.com/winuguyen1905-aladin/front-end`
2. Settings → Actions → Runners → New self-hosted runner
3. Copy token hiển thị
4. Sử dụng token trong lệnh `config.sh` hoặc `config.cmd`

### Bước 4: Verify Runner
- Vào Settings → Actions → Runners
- Kiểm tra runner status là "Idle" (màu xanh)

## 🔧 Customization

### Thay đổi Ports
Mặc định:
- Production: port `3000`
- Staging: port `3001`

Để thay đổi, edit file `.github/workflows/ci-cd.yml`:
```yaml
-p YOUR_PORT:80
```

### Thay đổi Container Names
```yaml
--name your-custom-name
```

### Thêm Environment Variables
```yaml
-e NODE_ENV=production \
-e API_URL=https://api.your-domain.com \
-e SOCKET_URL=wss://socket.your-domain.com \
```

### Thay đổi Docker Network
```yaml
--network your-network-name
```

## 📦 Docker Images

Images được push lên: `ghcr.io/winuguyen1905-aladin/front-end`

**Tags:**
- `latest`: Latest build từ main branch
- `develop`: Latest build từ develop branch
- `main-<sha>`: Specific commit từ main
- `develop-<sha>`: Specific commit từ develop

### Pull Docker Image
```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull image
docker pull ghcr.io/winuguyen1905-aladin/front-end:latest
```

## 🌍 Deployment URLs

Cập nhật các URLs này trong workflow:

```yaml
environment:
  name: production
  url: https://your-domain.com  # ← Thay đổi URL này
```

## 🔐 Secrets & Variables

Workflow sử dụng các secrets sau:

| Secret | Mô tả | Bắt buộc |
|--------|-------|----------|
| `GITHUB_TOKEN` | Tự động tạo bởi GitHub | ✅ |

Để thêm custom secrets:
1. Settings → Secrets and variables → Actions
2. New repository secret
3. Sử dụng trong workflow: `${{ secrets.YOUR_SECRET }}`

## 📊 Monitoring

### Xem Workflow Runs
- Vào tab "Actions" trong repository
- Click vào workflow run để xem chi tiết

### Check Docker Containers
```bash
# List running containers
docker ps

# Check logs
docker logs aladin-frontend
docker logs aladin-frontend-staging

# Check health
curl http://localhost:3000/health
curl http://localhost:3001/health
```

### Check Docker Images
```bash
docker images | grep aladin-frontend
```

## 🐛 Troubleshooting

### Runner không kết nối
```bash
# Restart runner service
sudo ./svc.sh stop
sudo ./svc.sh start

# Hoặc chạy trực tiếp để xem logs
./run.sh
```

### Container không start
```bash
# Check logs
docker logs aladin-frontend

# Check if port is already in use
netstat -tulpn | grep 3000

# Remove and recreate
docker stop aladin-frontend
docker rm aladin-frontend
# Workflow sẽ tự tạo lại
```

### Build fails
- Kiểm tra Node.js version (phải là 18)
- Clear npm cache: `npm cache clean --force`
- Xóa `node_modules` và `package-lock.json`, sau đó `npm install` lại

### Docker network not found
```bash
docker network create aladin-network
```

## 📝 Best Practices

1. **Branch Strategy:**
   - `main`: Production-ready code
   - `develop`: Development code
   - Feature branches: `feature/xxx`

2. **Commit Messages:**
   - Clear, descriptive messages
   - Prefix: `feat:`, `fix:`, `docs:`, `refactor:`

3. **Pull Requests:**
   - Code quality checks phải pass
   - Review code trước khi merge
   - Squash commits khi merge

4. **Deployment:**
   - Test trên staging trước
   - Deploy production trong business hours
   - Monitor logs sau deployment

## 🔄 Update Workflows

Khi cập nhật workflows:
1. Tạo branch mới
2. Test thay đổi trên branch đó
3. Create PR và review
4. Merge vào main

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Self-hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [Docker Documentation](https://docs.docker.com/)
- [Vite Documentation](https://vitejs.dev/)

## 💡 Tips

- Sử dụng `workflow_dispatch` để trigger workflows manually
- Monitor disk space trên runner machine
- Backup runner configuration
- Update runner version thường xuyên
- Use caching để tăng tốc builds

---

**Cần hỗ trợ?** Tạo issue trong repository hoặc contact team.

