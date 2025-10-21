# 🔒 Environment Variables Management for CI/CD

## 📋 Overview

Quản lý environment variables an toàn cho GitHub Actions deployment.

## ⚠️ Security Rules

### **NEVER:**
- ❌ Commit `.env` files to git
- ❌ Put secrets in workflow files
- ❌ Expose sensitive data in logs
- ❌ Use plaintext secrets

### **ALWAYS:**
- ✅ Use GitHub Secrets for sensitive data
- ✅ Keep `.env` in `.gitignore`
- ✅ Use fallback values for non-sensitive data
- ✅ Validate environment before deployment

---

## 🎯 Deployment Strategies

### **Option 1: GitHub Secrets → Dynamic .env (Recommended)**

**Pros:**
- ✅ Centralized secret management
- ✅ Easy to update (via GitHub UI)
- ✅ No manual server config
- ✅ Consistent across deployments
- ✅ Audit trail in GitHub

**Cons:**
- ⚠️ Need to set up secrets in GitHub
- ⚠️ All secrets in one place

**How it works:**
1. Store secrets in GitHub Repository Settings
2. Workflow creates `.env` during deployment
3. Build uses the generated `.env`
4. `.env` stays on server for runtime

**Implementation:** Already configured in `.github/workflows/ci-cd.yml`

---

### **Option 2: Pre-existing .env on Server**

**Pros:**
- ✅ Simple - no workflow changes
- ✅ Server admin controls environment
- ✅ Secrets never leave server

**Cons:**
- ⚠️ Manual setup on each server
- ⚠️ Hard to track changes
- ⚠️ Inconsistent across servers
- ⚠️ Need server access to update

**How it works:**
1. Manually create `.env` on server once
2. Workflow doesn't touch `.env`
3. Deployment reuses existing `.env`

**Implementation:**
```yaml
# In workflow - skip .env creation step
# Just build and deploy
```

---

### **Option 3: Environment Variables in PM2**

**Pros:**
- ✅ PM2 ecosystem.config.js manages env
- ✅ Per-environment configuration
- ✅ No separate `.env` file

**Cons:**
- ⚠️ Harder to update
- ⚠️ Mixed with deployment config

**How it works:**
1. Define env in `ecosystem.config.js`
2. PM2 injects variables at runtime

---

## 🚀 Recommended Setup (Option 1)

### **Step 1: Add Secrets to GitHub**

1. Go to GitHub repo: `https://github.com/winuguyen1905-aladin/front-end`
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add these secrets:

| Secret Name | Example Value | Description |
|-------------|---------------|-------------|
| `VITE_API_URL` | `http://your-server:port` | Backend API URL |
| `VITE_SOCKET_URL` | `ws://your-server:port` | WebSocket URL |

**Note:** Only add SENSITIVE values. Non-sensitive values use defaults in workflow.

### **Step 2: Workflow Creates .env**

Already configured in `.github/workflows/ci-cd.yml`:

```yaml
- name: Create .env from GitHub Secrets
  run: |
    # Validate secrets exist (fails if not set)
    if [ -z "${{ secrets.VITE_API_URL }}" ]; then
      echo "❌ ERROR: VITE_API_URL not set!"
      exit 1
    fi
    
    cat > .env << EOF
    VITE_API_URL=${{ secrets.VITE_API_URL }}
    VITE_SOCKET_URL=${{ secrets.VITE_SOCKET_URL }}
    # ... other variables
    EOF
```

**Security:**
- Secrets are required (no fallbacks)
- Workflow fails if secrets not configured
- No sensitive data exposed in code

### **Step 3: Build Uses .env**

Vite automatically reads `.env` during build:
```bash
npm run build  # Reads .env and injects into build
```

### **Step 4: Runtime (PM2)**

PM2 serves the built files (variables already baked in).

---

## 🔧 Alternative: Manual .env on Server

If you prefer to manage `.env` manually on server:

### **Setup Once:**

```bash
# SSH to server
ssh user@your-server

# Navigate to project
cd ~/front-end  # or wherever runner checks out code

# Create .env manually (replace with your actual values)
cat > .env << 'EOF'
VITE_API_URL=http://your-server:port
VITE_SOCKET_URL=ws://your-server:port
VITE_APP_NAME=Aladin Secure Chat
VITE_APP_VERSION=1.0.0
VITE_ENABLE_DEBUG=false
VITE_ENABLE_ANALYTICS=true
VITE_MAX_FILE_SIZE=5242880
VITE_ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif
VITE_LOG_LEVEL=error
EOF

# Set permissions
chmod 600 .env
```

### **Remove .env creation from workflow:**

```yaml
# Remove or comment out this step in ci-cd.yml:
# - name: Create .env from GitHub Secrets
#   run: ...
```

**Pros:** Simple, server-controlled
**Cons:** Manual management, hard to track

---

## 📊 Comparison

| Feature | GitHub Secrets | Manual .env | PM2 Config |
|---------|----------------|-------------|------------|
| **Security** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Ease of Update** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Automation** | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐ |
| **Consistency** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Audit Trail** | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐ |

**Recommendation:** Use GitHub Secrets (Option 1)

---

## 🔍 Verification

### **Check .env after deployment:**

```bash
# On server (via SSH or runner logs)
cat .env

# Verify variables are set
grep VITE_API_URL .env
```

### **Check build artifacts:**

```bash
# Variables should be baked into JS
grep -r "VITE_API_URL" dist/assets/*.js
```

### **Test at runtime:**

```bash
# Access frontend
curl http://localhost:3000/

# Check browser console
# window.__VITE_ENV__ or similar
```

---

## 🛡️ Security Best Practices

### **1. Sensitive vs Non-sensitive**

**Sensitive (Use Secrets):**
- API keys
- Database passwords
- OAuth tokens
- Private URLs (if any)

**Non-sensitive (Use defaults in workflow):**
- App name
- Version number
- Public feature flags
- File size limits

### **2. Secret Rotation**

```bash
# Update secrets in GitHub when needed
# Redeploy to apply changes
git commit --allow-empty -m "trigger: update environment"
git push
```

### **3. Different Environments**

**Production:**
```yaml
VITE_API_URL=${{ secrets.PROD_API_URL }}
```

**Staging:**
```yaml
VITE_API_URL=${{ secrets.STAGING_API_URL }}
```

### **4. Validation**

Add validation in workflow:

```yaml
- name: Validate environment
  run: |
    if [ -z "${{ secrets.VITE_API_URL }}" ]; then
      echo "⚠️ VITE_API_URL not set, using default"
    fi
    
    # Check .env was created
    if [ ! -f .env ]; then
      echo "❌ .env file not created!"
      exit 1
    fi
    
    echo "✅ Environment validated"
```

---

## 📝 Current Configuration

### **What's Already Set Up:**

✅ `.gitignore` - `.env` files ignored
✅ Workflow creates `.env` from secrets
✅ Fallback values for all variables
✅ `.env` not committed to git

### **What You Need to Do:**

1. **Add GitHub Secrets** (if using Option 1):
   - Go to repo Settings → Secrets
   - Add `VITE_API_URL` and `VITE_SOCKET_URL`

2. **Or create .env manually on server** (if using Option 2):
   - SSH to server
   - Create `.env` in project directory
   - Remove .env creation step from workflow

### **Current Workflow Behavior:**

```
1. Checkout code (no .env)
2. Create .env from secrets ← Dynamic creation
3. npm ci (install deps)
4. npm run build (uses .env)
5. Deploy with PM2
```

**Result:** `.env` exists on server after deployment

---

## 🔄 Update Process

### **Using GitHub Secrets (Option 1):**

```bash
# 1. Update secret in GitHub UI
#    Settings → Secrets → Edit secret

# 2. Trigger redeployment
git commit --allow-empty -m "chore: update environment variables"
git push origin main

# 3. CI/CD will:
#    - Create new .env with updated secrets
#    - Build with new values
#    - Deploy
```

### **Using Manual .env (Option 2):**

```bash
# 1. SSH to server
ssh user@server

# 2. Edit .env
nano ~/front-end/.env

# 3. Restart PM2
pm2 restart aladin-frontend-prod
```

---

## 🎯 Recommendation for Your Setup

**Use GitHub Secrets (Already configured!)**

### **Why:**
1. ✅ Server không cần manual setup
2. ✅ Dễ update qua GitHub UI
3. ✅ Consistent mọi lần deploy
4. ✅ Secure - secrets không expose
5. ✅ Same pattern có thể dùng cho backend

### **Action Items:**

```bash
# 1. Add secrets to GitHub (one-time)
Visit: https://github.com/winuguyen1905-aladin/front-end/settings/secrets/actions

Add:
- VITE_API_URL = http://14.225.192.43:8090
- VITE_SOCKET_URL = ws://14.225.192.43:8090

# 2. Push code (workflow already configured)
git push origin main

# 3. Workflow will automatically:
- Create .env from secrets
- Build application
- Deploy with PM2
```

**Done! Hoàn toàn tự động và an toàn! 🎉**

---

## 📚 References

- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [PM2 Environment Management](https://pm2.keymetrics.io/docs/usage/environment/)

---

**Need help?** Check workflow logs in GitHub Actions tab.
