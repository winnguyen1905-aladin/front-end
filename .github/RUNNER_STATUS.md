# 🏃 Runner Configuration Status

## ⚠️ Current Status: TEMPORARY SETUP

### **What's Running:**
- ✅ **Build & Test**: Using GitHub-hosted runner (`ubuntu-latest`)
- ❌ **Deploy**: DISABLED (requires self-hosted runner)

### **Why This Setup:**
Workflow was waiting indefinitely because no self-hosted runner was configured. Temporary fix allows testing the build process immediately.

---

## 🔧 Current Configuration

### **ci-cd.yml Changes:**

```yaml
# Test job - TEMPORARY
test:
  runs-on: ubuntu-latest  # GitHub-hosted (free, but limited)
  
# Deploy job - DISABLED
deploy:
  if: false  # Deployment disabled until runner setup
```

---

## 📊 Capabilities

### **✅ What Works Now:**
- Build application (`npm run build`)
- TypeScript compilation
- Test build artifacts
- Verify package.json sync

### **❌ What Doesn't Work:**
- Deploy to server (PM2)
- Access to production server
- Install PM2 globally
- Server-side operations

---

## 🚀 Enable Full Deployment (Recommended)

### **Step 1: Setup Self-hosted Runner**

#### **On Linux/Ubuntu Server:**

```bash
# 1. Create runner directory
mkdir ~/actions-runner-frontend && cd ~/actions-runner-frontend

# 2. Download runner
curl -o actions-runner-linux-x64-2.329.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.329.0/actions-runner-linux-x64-2.329.0.tar.gz

# 3. Extract
tar xzf ./actions-runner-linux-x64-2.329.0.tar.gz

# 4. Get token from GitHub:
# https://github.com/winnguyen1905-aladin/front-end/settings/actions/runners/new

# 5. Configure (replace YOUR_TOKEN)
./config.sh --url https://github.com/winnguyen1905-aladin/front-end --token YOUR_TOKEN

# 6. Install as service (runs on boot)
sudo ./svc.sh install
sudo ./svc.sh start

# Or run manually (for testing)
./run.sh
```

#### **Verify Runner:**
Check: https://github.com/winnguyen1905-aladin/front-end/settings/actions/runners

Should see:
```
✅ [runner-name] - Idle (green dot)
```

### **Step 2: Re-enable Deployment**

After runner is online, update `.github/workflows/ci-cd.yml`:

```yaml
# Change line 16:
runs-on: self-hosted  # Back to self-hosted

# Change line 67:
if: |  # Re-enable deployment
  github.event_name == 'push' && 
  github.ref == 'refs/heads/main' &&
  needs.test.result == 'success'
```

### **Step 3: Push Changes**

```bash
git add .github/workflows/ci-cd.yml
git commit -m "feat: enable self-hosted runner and deployment"
git push
```

---

## 🎯 Quick Commands

### **Check Workflow Status:**
```
https://github.com/winnguyen1905-aladin/front-end/actions
```

### **Check Runner Status:**
```
https://github.com/winnguyen1905-aladin/front-end/settings/actions/runners
```

### **Test Build Locally:**
```bash
npm install
npm run build
npm run pm2:prod  # Test PM2 deployment locally
```

---

## 📋 Comparison

| Feature | GitHub-hosted | Self-hosted |
|---------|---------------|-------------|
| **Speed** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Build** | ✅ Works | ✅ Works |
| **Deploy** | ❌ Cannot | ✅ Can deploy |
| **PM2** | ❌ No access | ✅ Full access |
| **Server** | ❌ No access | ✅ Direct access |
| **Cost** | Free (limited) | Server cost only |
| **Setup** | None needed | One-time setup |

---

## 🔍 Current Workflow Behavior

### **When you push to `main`:**

```
1. ✅ Checkout code
2. ✅ Setup Node.js
3. ✅ Install dependencies (npm ci)
4. ✅ Create .env from GitHub Secrets
5. ✅ Build application
6. ✅ Verify build artifacts
7. ❌ Deploy (SKIPPED - disabled)
```

### **After Self-hosted Runner Setup:**

```
1. ✅ Checkout code
2. ✅ Setup Node.js
3. ✅ Install dependencies
4. ✅ Create .env from secrets
5. ✅ Build application
6. ✅ Verify build
7. ✅ Install PM2
8. ✅ Deploy with PM2
9. ✅ Health check
```

---

## 🛡️ Security Note

Even with GitHub-hosted runner, your secrets are safe:
- ✅ `VITE_API_URL` and `VITE_SOCKET_URL` are still required
- ✅ Secrets are injected during build
- ✅ No sensitive data exposed in logs
- ✅ Built artifacts include baked-in environment variables

---

## 📝 To-Do

- [ ] Setup self-hosted runner on server
- [ ] Verify runner is online and idle
- [ ] Re-enable deployment in ci-cd.yml
- [ ] Test full CI/CD pipeline
- [ ] Remove this temporary configuration

---

## 📚 Documentation

- **Runner Setup**: `.github/scripts/setup-runner.sh`
- **Secrets Setup**: `.github/SECRETS_SETUP.md`
- **PM2 Deployment**: `ecosystem.config.js`
- **Environment Management**: `.github/ENV_MANAGEMENT.md`

---

## ✅ Current Status Summary

**Workflow:** ✅ Running (build only)
**Deployment:** ⏸️ Paused (waiting for runner)
**Next Step:** Setup self-hosted runner

**Check build status:**
```
https://github.com/winnguyen1905-aladin/front-end/actions
```

Latest commit should show **passing** build with GitHub-hosted runner!
