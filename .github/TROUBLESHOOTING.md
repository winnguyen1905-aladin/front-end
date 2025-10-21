# 🐛 Troubleshooting Guide - Common CI/CD Issues

## ✅ Issues Already Fixed

### **Issue #1: package-lock.json out of sync**

**Error:**
```
npm ci can only install packages when your package.json and package-lock.json are in sync
Missing: serve@14.2.5 from lock file
```

**Cause:** Added `serve` dependency to `package.json` without updating `package-lock.json`

**Solution:**
```bash
npm install
git add package-lock.json
git commit -m "fix: update package-lock.json"
git push
```

---

### **Issue #2: ES Module conflict**

**Error:**
```
ReferenceError: module is not defined in ES module scope
This file is being treated as an ES module because it has a '.js' extension 
and 'package.json' contains "type": "module"
```

**Cause:** `ecosystem.config.js` uses CommonJS (`module.exports`) but project is ES module

**Solution:**
```bash
# Rename to .cjs extension
git mv ecosystem.config.js ecosystem.config.cjs

# Update all references
# - package.json scripts
# - .github/workflows/ci-cd.yml
# - Makefile

git commit -m "fix: rename to .cjs for CommonJS compatibility"
git push
```

---

### **Issue #3: serve command syntax error**

**Error:**
```
Error: getaddrinfo ENOTFOUND -l
Error: getaddrinfo ENOTFOUND -p
```

**Cause:** PM2 parsing args as string instead of array, causing serve to misinterpret flags

**Solution:**
```javascript
// Before ❌
script: 'serve',
args: '-s dist -l 3000'  // String - PM2 parses incorrectly

// After ✅
script: './node_modules/.bin/serve',
args: ['-s', 'dist', '-l', '3000']  // Array - PM2 parses correctly
```

---

### **Issue #4: Missing GitHub Secrets**

**Error:**
```
❌ ERROR: VITE_API_URL secret not set!
Please add it in GitHub Settings → Secrets
```

**Cause:** Required secrets not configured in GitHub repository

**Solution:**
1. Go to: `https://github.com/YOUR_REPO/settings/secrets/actions`
2. Add secrets:
   - `VITE_API_URL`
   - `VITE_SOCKET_URL`
3. Re-run workflow

**Guide:** See `.github/SECRETS_SETUP.md`

---

## 🔍 Common Issues

### **Workflow waiting indefinitely**

**Symptoms:**
```
Waiting for a runner to pick up this job...
```

**Cause:** No self-hosted runner configured or runner offline

**Solution:**
1. Check runner status: `Settings → Actions → Runners`
2. Setup runner if needed: See `.github/scripts/setup-runner.sh`
3. Or temporarily use GitHub-hosted runner:
   ```yaml
   runs-on: ubuntu-latest  # Instead of self-hosted
   ```

---

### **PM2 process keeps restarting**

**Symptoms:**
```
aladin-frontend-prod  errored  15
```

**Debug:**
```bash
# Check logs
pm2 logs aladin-frontend-prod --lines 100

# Check if dist exists
ls -la dist/

# Verify serve command
./node_modules/.bin/serve -s dist -l 3000

# Check ecosystem config syntax
pm2 start ecosystem.config.cjs --only aladin-frontend-prod
```

**Common Causes:**
- dist folder missing → Run `npm run build`
- serve not installed → Run `npm install`
- Wrong port/args → Check ecosystem.config.cjs
- Permission issues → Check file permissions

---

### **Build fails with type errors**

**Symptoms:**
```
error TS2304: Cannot find name 'XXX'
```

**Solution:**
```bash
# Clear TypeScript cache
rm -rf node_modules/.vite
rm -rf dist

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

---

### **Health check fails**

**Symptoms:**
```
❌ Frontend not accessible!
curl: (7) Failed to connect to localhost port 3000
```

**Debug:**
```bash
# Check if PM2 process is running
pm2 status

# Check if port is listening
netstat -tulpn | grep 3000

# Check PM2 logs
pm2 logs aladin-frontend-prod

# Test serve manually
./node_modules/.bin/serve -s dist -l 3000
```

**Common Causes:**
- PM2 process crashed → Check logs
- Port already in use → Change port or kill process
- Firewall blocking → Check firewall rules
- dist folder empty → Rebuild application

---

### **Environment variables not loaded**

**Symptoms:**
```
API calls fail, app shows "undefined" for configs
```

**Debug:**
```bash
# Check .env file was created
cat .env

# Check build artifacts include env vars
grep -r "VITE_API_URL" dist/assets/*.js

# Verify secrets in GitHub
# Settings → Secrets (cannot view values, only names)
```

**Solution:**
1. Verify GitHub Secrets are set
2. Re-run workflow to regenerate .env
3. Rebuild: `npm run build`

---

## 🛠️ Debug Commands

### **Local Testing:**
```bash
# Test build
npm run build

# Test serve manually
npx serve -s dist -l 3000

# Test PM2 config
pm2 start ecosystem.config.cjs --only aladin-frontend-prod

# Check PM2 status
pm2 status
pm2 logs aladin-frontend-prod
pm2 describe aladin-frontend-prod
```

### **On Server (via SSH or runner):**
```bash
# Check runner status
cd ~/actions-runner-frontend
./run.sh  # Run manually to see errors

# Check PM2
pm2 list
pm2 logs aladin-frontend-prod --lines 50

# Check deployment
ls -la ~/actions-runner-frontend/_work/front-end/front-end/
ls -la ~/actions-runner-frontend/_work/front-end/front-end/dist/

# Check port
netstat -tulpn | grep 3000
curl http://localhost:3000/
```

---

## 🔧 Quick Fixes

### **Reset PM2:**
```bash
pm2 delete all
pm2 kill
pm2 start ecosystem.config.cjs
```

### **Clean Rebuild:**
```bash
rm -rf dist node_modules
npm install
npm run build
pm2 restart aladin-frontend-prod
```

### **Force Redeploy:**
```bash
git commit --allow-empty -m "chore: force redeploy"
git push
```

---

## 📚 Related Documentation

- **PM2 Deployment**: `PM2_DEPLOYMENT.md`
- **Secrets Setup**: `.github/SECRETS_SETUP.md`
- **Environment Management**: `.github/ENV_MANAGEMENT.md`
- **Runner Setup**: `.github/RUNNER_STATUS.md`

---

## 🆘 Still Having Issues?

### **Collect Debug Info:**
```bash
# System info
node --version
npm --version
pm2 --version

# PM2 info
pm2 status
pm2 logs aladin-frontend-prod --lines 100 --nostream

# File system
ls -la dist/
cat ecosystem.config.cjs

# Network
netstat -tulpn | grep 3000
curl -v http://localhost:3000/
```

### **Create Issue:**
Include:
- Error messages
- PM2 logs
- System info
- Steps to reproduce

---

**Most common solution:** Check PM2 logs with `pm2 logs aladin-frontend-prod`
