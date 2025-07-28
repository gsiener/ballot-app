# Cloudflare API Token Setup for GitHub Actions

Based on 2025 documentation, here's how to properly configure your Cloudflare API token for GitHub Actions deployment.

## Current Issues Identified

1. **Deprecated pages-action**: Your workflow was using the deprecated `cloudflare/pages-action@v1`
2. **Missing token permissions**: API token likely missing required user permissions
3. **No test execution**: Tests weren't running before deployment

## ✅ Fixed in Updated Workflow

The workflow has been updated to:
- Use `cloudflare/wrangler-action@v3` for both Workers and Pages
- Run tests before deployment
- Only deploy on main branch pushes
- Use proper Pages deployment command

## 🔧 Cloudflare API Token Permissions Required

You need to update your `CLOUDFLARE_API_TOKEN` with these **exact permissions**:

### Required Permissions:
```
Account:
- Account Settings: Read
- Workers Scripts: Edit  
- Workers KV Storage: Edit
- Workers R2 Storage: Edit (if using R2)

Zone:
- Workers Routes: Edit (for all zones)

User:
- User Details: Read ⚠️ CRITICAL - Often missing
- Memberships: Read ⚠️ CRITICAL - Often missing  

Pages:
- Cloudflare Pages: Edit
```

### ⚠️ Critical Missing Permissions
Most deployment failures are caused by missing:
- **User → User Details → Read**
- **User → Memberships → Read**

Without these, you'll get: `"Unable to retrieve email for this user"`

## 🛠️ How to Update Your Token

1. **Go to Cloudflare Dashboard**
   - Navigate to: https://dash.cloudflare.com/profile/api-tokens

2. **Edit Existing Token or Create New**
   - Find your current `CLOUDFLARE_API_TOKEN`
   - Click "Edit" or create a new one

3. **Set Permissions** (use Custom Token):
   ```
   Account permissions:
   ✅ Account Settings: Read
   ✅ Workers Scripts: Edit
   ✅ Workers KV Storage: Edit
   ✅ Cloudflare Pages: Edit
   
   Zone permissions:
   ✅ Workers Routes: Edit (All zones)
   
   User permissions:
   ✅ User Details: Read
   ✅ Memberships: Read
   ```

4. **Set Resource Scope**:
   - Account: Select your account
   - Zone: All zones (or specific zones if preferred)

5. **Update GitHub Secret**:
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Update `CLOUDFLARE_API_TOKEN` with the new token value

## 🧪 Testing the Fix

After updating the token, the workflow will:

1. **Run Tests First** (new step):
   - Execute `bun run test` (66 tests)
   - Build all components
   - Only proceed if tests pass

2. **Deploy Workers**:
   - Deploy server to Cloudflare Workers
   - Set Honeycomb API key secret

3. **Deploy Pages**:
   - Deploy client to Cloudflare Pages using wrangler
   - Use proper project name: `ballot-app`

## 📋 Verification Checklist

- [ ] API token updated with User permissions
- [ ] `CLOUDFLARE_ACCOUNT_ID` secret is set
- [ ] `HONEYCOMB_API_KEY` secret is set (optional)
- [ ] Tests pass locally: `bun run test`
- [ ] Push to main branch triggers deployment

## 🚨 Common Issues & Solutions

**"Unable to retrieve email for this user"**
- ✅ Add User → User Details → Read permission

**"Account membership not found"**  
- ✅ Add User → Memberships → Read permission

**"Project not found"**
- ✅ Ensure project name matches: `ballot-app`
- ✅ Project should exist in Cloudflare Pages dashboard

**"Permission denied on Workers"**
- ✅ Add Workers Scripts → Edit permission
- ✅ Add Account Settings → Read permission

## 🔗 Helpful Links

- [Cloudflare API Token Creation](https://dash.cloudflare.com/profile/api-tokens)
- [Wrangler Action Documentation](https://github.com/cloudflare/wrangler-action)
- [Pages Migration Guide](https://developers.cloudflare.com/pages/)

## 📞 Support

If you continue having issues:
1. Check GitHub Actions logs for specific error messages
2. Verify token permissions in Cloudflare dashboard
3. Test deployment locally with `wrangler deploy` and `wrangler pages deploy`