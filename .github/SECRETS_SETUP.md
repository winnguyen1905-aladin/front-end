# 🔐 GitHub Secrets Setup Guide

## ⚠️ Required Secrets

The CI/CD workflow **requires** these secrets to be configured:

| Secret Name | Description | Example (DO NOT use actual values here) |
|-------------|-------------|------------------------------------------|
| `VITE_API_URL` | Backend API URL | `http://your-server:port` |
| `VITE_SOCKET_URL` | WebSocket Server URL | `ws://your-server:port` |

## 📋 Setup Instructions

### Step 1: Access Repository Secrets

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**

**Direct link format:**
```
https://github.com/YOUR_USERNAME/front-end/settings/secrets/actions
```

### Step 2: Add Required Secrets

#### Secret 1: VITE_API_URL

```
Name: VITE_API_URL
Value: http://YOUR_SERVER_IP:PORT
```

**Example:**
- Production: `http://14.225.192.43:8090`
- Staging: `http://staging.yourdomain.com:8090`
- Local: `http://localhost:8090`

#### Secret 2: VITE_SOCKET_URL

```
Name: VITE_SOCKET_URL
Value: ws://YOUR_SERVER_IP:PORT
```

**Example:**
- Production: `ws://14.225.192.43:8090`
- Staging: `ws://staging.yourdomain.com:8090`
- Local: `ws://localhost:8090`

### Step 3: Verify Setup

After adding secrets:

1. Go to **Actions** tab
2. Trigger a workflow (push to main or manual trigger)
3. Check workflow logs for:
   ```
   ✅ .env file created from GitHub Secrets
   ```

## 🔍 Validation

The workflow will **fail** if secrets are not set:

```bash
❌ ERROR: VITE_API_URL secret not set!
Please add it in GitHub Settings → Secrets
```

This is intentional to prevent deployments with missing configuration.

## 🔄 Update Secrets

To change secret values:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click on the secret name
3. Click **"Update secret"**
4. Enter new value
5. **Save**
6. Trigger new deployment (push code or manual trigger)

## 🌍 Environment-Specific Secrets

### Option 1: Use Environments (Recommended)

For different environments (production, staging):

1. **Settings** → **Environments**
2. Create environments: `production`, `staging`
3. Add secrets to each environment

**In workflow:**
```yaml
environment:
  name: production  # or staging
```

### Option 2: Different Secret Names

Use different secret names for each environment:

```
PROD_VITE_API_URL
STAGING_VITE_API_URL
DEV_VITE_API_URL
```

**In workflow:**
```yaml
VITE_API_URL=${{ secrets.PROD_VITE_API_URL }}
```

## 🔒 Security Best Practices

### ✅ DO:
- Use GitHub Secrets for all sensitive values
- Rotate secrets periodically
- Use different secrets for prod/staging
- Keep secret values private

### ❌ DON'T:
- Commit `.env` files with real values
- Put secrets in workflow files
- Share secrets in issues/PRs
- Use production secrets for testing

## 🐛 Troubleshooting

### Issue: Workflow fails with "secret not set"

**Solution:**
1. Check secret name spelling (case-sensitive!)
2. Verify secret is added to correct repository
3. Check if using environments - secret must be in that environment

### Issue: Variables not updating

**Solution:**
1. Update the secret value
2. Trigger new deployment:
   ```bash
   git commit --allow-empty -m "chore: trigger deployment"
   git push
   ```

### Issue: Can't see secret values

**Solution:**
This is normal - GitHub never shows secret values after creation.
You can only update or delete them.

## 📊 Current Configuration

### Workflow Behavior:

```yaml
# 1. Validate secrets exist
if [ -z "${{ secrets.VITE_API_URL }}" ]; then
  echo "❌ ERROR: VITE_API_URL secret not set!"
  exit 1
fi

# 2. Create .env from secrets
cat > .env << EOF
VITE_API_URL=${{ secrets.VITE_API_URL }}
VITE_SOCKET_URL=${{ secrets.VITE_SOCKET_URL }}
EOF

# 3. Build with .env
npm run build
```

### What Gets Deployed:

- ✅ `.env` created from secrets
- ✅ Build artifacts include environment values
- ❌ Secrets never exposed in logs or code
- ❌ No hardcoded sensitive values

## 🎯 Verification Checklist

After setup, verify:

- [ ] VITE_API_URL secret added
- [ ] VITE_SOCKET_URL secret added
- [ ] Workflow runs successfully
- [ ] Application connects to correct backend
- [ ] No sensitive data in repository code
- [ ] `.env` files in `.gitignore`

## 📝 Quick Reference

```bash
# Add secret via GitHub UI
Settings → Secrets → New secret

# Trigger deployment after updating
git commit --allow-empty -m "chore: update environment"
git push

# Check workflow logs
Actions → Latest run → Build and Test → Create .env from GitHub Secrets
```

## 🔗 Links

- [GitHub Encrypted Secrets Docs](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

## ✨ Summary

**Required Setup:**
1. Add `VITE_API_URL` secret
2. Add `VITE_SOCKET_URL` secret
3. Push code to trigger deployment

**Security:**
- ✅ No sensitive data in repository
- ✅ Secrets managed by GitHub
- ✅ Workflow validates secrets exist
- ✅ Automatic .env generation

**Done!** Your CI/CD is secure and automated! 🎉
