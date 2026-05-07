# Render Deployment Checklist

Quick checklist for deploying DotVests backend to Render with PostgreSQL.

---

## Pre-Deployment (Local)

- [ ] All code committed to git
- [ ] `.env` file updated with test values
- [ ] `.env.example` has correct variable names
- [ ] `npm install` runs without errors
- [ ] `npm start` runs without errors locally
- [ ] All tests pass (if applicable)
- [ ] Database migration tested locally if switching from SQLite

---

## Render Setup

### Create PostgreSQL Database

- [ ] Log in to Render dashboard
- [ ] Click **"New +"** → **"PostgreSQL"**
- [ ] Set **Name:** `dotvests-db`
- [ ] Set **Region:** Same as backend (for latency)
- [ ] Create database
- [ ] Copy connection string to clipboard
  ```
  postgresql://user:pass@host:port/database
  ```

### Create Web Service

- [ ] Click **"New +"** → **"Web Service"**
- [ ] Connect Git repository
- [ ] Set **Name:** `dotvests-backend`
- [ ] Set **Region:** Same as database
- [ ] Set **Branch:** `main` (or your deploy branch)
- [ ] Set **Build Command:** `npm install`
- [ ] Set **Start Command:** `npm start`
- [ ] **Advanced** → Set **Health Check Path:** `/` (optional)
- [ ] Click **"Create Web Service"**

---

## Environment Configuration

### Add Environment Variables

In Render Web Service **Dashboard → Environment:**

| Key | Value | Source |
|-----|-------|--------|
| `DATABASE_URL` | `postgresql://...` | From PostgreSQL database |
| `NODE_ENV` | `production` | Type this |
| `PORT` | `3000` | Type this (or leave for auto) |
| `JWT_SECRET` | Generate: `openssl rand -hex 32` | Generate new |
| `PAYSTACK_SECRET_KEY` | From Paystack account | From Paystack |
| `PAYSTACK_PUBLIC_KEY` | From Paystack account | From Paystack |
| `SENDGRID_API_KEY` | From SendGrid account | From SendGrid |
| `SENDGRID_FROM_EMAIL` | `noreply@dotvests.com` | Your email |
| `SMILE_API_KEY` | From Smile account | From Smile |
| `SMILE_PARTNER_ID` | From Smile account | From Smile |
| `PRIVATE_KEY` | ZetaChain wallet key | From ZetaChain |
| `PLATFORM_WALLET` | ZetaChain platform wallet | From ZetaChain |
| `DTV_CONTRACT` | Token contract address | From ZetaChain |
| `TEL_CONTRACT` | Token contract address | From ZetaChain |
| `ORB_CONTRACT` | Token contract address | From ZetaChain |
| `CEM_CONTRACT` | Token contract address | From ZetaChain |
| `FRONTEND_URL` | `https://dotvests.com` | Your frontend URL |
| `ADMIN_EMAILS` | `admin@dotvests.com` | Your admin emails |
| `WAITLIST_NOTIFICATION_EMAIL` | `info@dotvests.com` | Your email |

### Save Environment Variables

- [ ] Review all values
- [ ] Click **"Save"**

---

## Deploy

### Option 1: Auto-Deploy (Recommended)

- [ ] Connect GitHub repository to Render
- [ ] Render automatically deploys on push to `main`
- [ ] Monitor deployment in **Logs** tab

### Option 2: Manual Deploy

```bash
git add .
git commit -m "Deploy to Render"
git push origin main

# Or in Render dashboard:
# Click Deploy button manually
```

---

## Verify Deployment

### Check Backend Status

In Render Web Service dashboard:

- [ ] **Status** shows "Live" (green)
- [ ] **Logs** show no errors
- [ ] No "Build failed" message

### Test Health Check

```bash
curl https://your-backend.onrender.com/
```

Should return:
```json
{
  "success": true,
  "message": "DotVests API is live",
  "version": "1.0.0",
  "status": "running"
}
```

### Test Database Connection

```bash
curl https://your-backend.onrender.com/api/user \
  -H "Authorization: Bearer [valid_jwt_token]"
```

Should connect to PostgreSQL without errors.

---

## Post-Deployment

### Monitor Application

- [ ] Check **Metrics** tab for:
  - CPU usage (should be <50%)
  - Memory usage (should be <300MB)
  - Response times (should be <500ms)
- [ ] Check **Logs** for errors
- [ ] Monitor for 24 hours

### Test Key Flows

- [ ] User registration works
- [ ] User login works
- [ ] Get stocks endpoint works
- [ ] Order placement works (with test data)
- [ ] Transaction history works

### Database Backups

- [ ] Enable automatic backups on PostgreSQL database
- [ ] Test restore from backup (off-peak)

### Set Up Monitoring

- [ ] Enable email alerts for deployment failures
- [ ] Enable email alerts for high error rates
- [ ] Set up uptime monitoring (optional)

---

## If Deployment Fails

### Check Logs

In Render **Logs** tab, look for:

```
Error: Cannot find module 'xyz'
→ Missing dependency. Run `npm install`

Error: connect ECONNREFUSED
→ Database URL wrong or PostgreSQL down

Error: Error: listen EADDRINUSE
→ PORT already in use. Use PORT=3000

Error: Authentication failed
→ DATABASE_URL or API keys wrong
```

### Common Fixes

| Error | Fix |
|-------|-----|
| Build fails | Check `npm install` succeeds locally |
| App crashes on start | Check all environment variables are set |
| Database connection fails | Verify `DATABASE_URL` format and exists |
| API calls fail | Check Paystack/Smile/ZetaChain API keys |
| CORS errors | Check `FRONTEND_URL` is set correctly |

### Rollback

If deployment is broken:

1. Previous deployment is still available
2. Click **"Previous Deployments"**
3. Select last working deployment
4. Click **"Deploy"**

---

## Database Migration (If Switching from SQLite)

### Before Deployment

```bash
# Export SQLite data
npm run migrate:export

# Creates migration-data-[timestamp].json
```

### After Deployment

```bash
# Add DATABASE_URL to .env locally
export DATABASE_URL="postgresql://..."

# Import to PostgreSQL
npm run migrate:import

# Verify success
npm run migrate:verify
```

### Or Use Render Shell

In Render Web Service, click **"Shell"** and run:

```bash
npm run migrate:import
npm run migrate:verify
```

---

## Custom Domain (Optional)

To use `api.yourdomain.com` instead of Render's URL:

1. In Render Web Service **Settings**
2. Click **"Add Custom Domain"**
3. Enter your domain
4. Get the CNAME record from Render
5. Add CNAME record to your DNS provider
6. Wait for DNS propagation (can take hours)
7. Render auto-provisions SSL certificate

---

## Scaling (Future)

When traffic increases:

### Vertical Scaling (More powerful instance)

- Render → **Settings** → **Instance Type**
- Choose higher tier

### Horizontal Scaling

- Render doesn't support multiple instances on Pro plan
- Options:
  - Upgrade to Team plan
  - Use load balancer service
  - Migrate to AWS/GCP

---

## Environment Comparison

| Aspect | Local | Staging | Production |
|--------|-------|---------|-----------|
| Database | SQLite | PostgreSQL | PostgreSQL |
| NODE_ENV | development | staging | production |
| Monitoring | None | Basic | Full |
| Backups | Manual | Manual | Automatic |
| SSL | No | Yes | Yes |
| Cost | Free | Free | Paid (eventually) |

---

## Cost Estimation (Render)

### Free Tier (Included)

- Web Service: Auto-suspends after 15 min inactivity
- PostgreSQL: Limited capacity
- Bandwidth: Limited

### Pro Plan (If needed)

- Web Service: ~$7/month
- PostgreSQL: ~$15/month
- **Total: ~$22/month**

### Cost Optimization

- Use free tier initially
- Monitor usage
- Upgrade only if needed

---

## Monitoring Commands

### Check Application Status

```bash
# Test API
curl https://your-backend.onrender.com/

# Test with auth
curl https://your-backend.onrender.com/api/user \
  -H "Authorization: Bearer [token]"

# Check database connection
curl https://your-backend.onrender.com/api/stocks
```

### Check Logs in Real-Time

In Render dashboard:

1. Click **"Logs"** tab
2. Live stream of application output
3. Scroll to see recent events

### Monitor Resources

In Render dashboard:

1. Click **"Metrics"** tab
2. View:
   - CPU usage
   - Memory usage
   - Network I/O
   - Response times

---

## Troubleshooting Checklist

- [ ] Is PostgreSQL database running? (Check Render dashboard)
- [ ] Is DATABASE_URL set correctly? (Check environment variables)
- [ ] Are all API keys set? (Check environment variables)
- [ ] Does app start locally? (Run `npm start`)
- [ ] Does `npm install` work? (Test locally)
- [ ] Are all dependencies listed in package.json? (Check file)
- [ ] Is NODE_ENV set to "production"? (Check environment)
- [ ] Is PORT set or auto-assigned? (Default 3000)

---

## After Going Live

- [ ] Monitor metrics for 24 hours
- [ ] Test user registration flow
- [ ] Test payment flow (Paystack)
- [ ] Test KYC flow (Smile)
- [ ] Test blockchain operations (ZetaChain)
- [ ] Set up alert for high error rates
- [ ] Set up alert for deployment failures
- [ ] Document any issues found
- [ ] Create runbook for common issues

---

## Need Help?

- **Render docs:** https://render.com/docs
- **PostgreSQL docs:** https://www.postgresql.org/docs/
- **Git/GitHub help:** https://docs.github.com
- **Check application logs** in Render dashboard first
- **Test locally** before deploying to Render

