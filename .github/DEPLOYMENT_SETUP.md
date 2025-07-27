# 🚀 Deployment Setup Guide

This guide helps you configure GitHub Actions for automatic deployment to Cloudflare.

## Required GitHub Secrets

You need to add these secrets to your GitHub repository settings:

### 1. Cloudflare API Token
- Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
- Click "Create Token"
- Use "Custom token" template
- **Permissions**:
  - Account: `Cloudflare Workers:Edit`
  - Zone: `Zone:Read`
  - Account: `Account Settings:Read`
- **Account Resources**: Include your account
- **Zone Resources**: Include all zones
- Copy the token and add it as `CLOUDFLARE_API_TOKEN` in GitHub secrets

### 2. Cloudflare Account ID
- Go to your [Cloudflare Dashboard](https://dash.cloudflare.com)
- In the right sidebar, copy your "Account ID"
- Add it as `CLOUDFLARE_ACCOUNT_ID` in GitHub secrets

### 3. Honeycomb API Key (Optional)
- Go to [Honeycomb Settings](https://ui.honeycomb.io/account)
- Copy your API key
- Add it as `HONEYCOMB_API_KEY` in GitHub secrets

## Setting Secrets in GitHub

1. Go to your repository: https://github.com/gsiener/ballot-app
2. Click **Settings** tab
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret with the name and value from above

## GitHub CLI Method (Alternative)

You can also set secrets using the GitHub CLI:

```bash
# Set Cloudflare API Token
gh secret set CLOUDFLARE_API_TOKEN

# Set Cloudflare Account ID  
gh secret set CLOUDFLARE_ACCOUNT_ID

# Set Honeycomb API Key (optional)
gh secret set HONEYCOMB_API_KEY
```

## Verification

After adding secrets, you can verify the deployment workflow:

1. Make any change to your code
2. Commit and push to `main` branch
3. Check the **Actions** tab in GitHub
4. Watch the deployment process
5. Your app will be automatically deployed to Cloudflare!

## Deployment URLs

After successful deployment:
- **Frontend**: https://ballot-app-client.pages.dev
- **Backend**: https://ballot-app-server.{your-username}.workers.dev

## Troubleshooting

- **401 Unauthorized**: Check your Cloudflare API token permissions
- **Account ID not found**: Verify your Cloudflare Account ID
- **Build failures**: Check the Actions logs for detailed error messages