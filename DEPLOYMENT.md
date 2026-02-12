# Deployment Guide - Render.com

## Step 1: Create Render Account

1. Go to https://render.com
2. Sign up with GitHub (recommended) or email
3. Verify your email

---

## Step 2: Create PostgreSQL Database

1. Click **"New +"** → **"PostgreSQL"**
2. Configure:
   - **Name:** `logispro-db`
   - **Database:** `logispro`
   - **User:** `logispro`
   - **Region:** Oregon (US West)
   - **Plan:** Free
3. Click **"Create Database"**
4. Wait ~2 minutes for database to provision
5. **Copy the "Internal Database URL"** (we'll use this later)
   - Format: `postgresql://user:pass@host:5432/logispro`

---

## Step 3: Seed Database (One-Time)

Before deploying the web service, we need to seed the database with initial data.

### Option A: Using Render Shell (Recommended)

1. After database is created, click on it
2. Go to **"Shell"** tab
3. Run these commands:

```bash
# Install git
apt-get update && apt-get install -y git

# Clone your repo
git clone https://github.com/YOUR-USERNAME/ruby-rosette.git
cd ruby-rosette/server

# Install dependencies
npm install

# Set environment variable
export DATABASE_URL="your-internal-database-url-here"

# Initialize and seed
npm run db:init
npm run db:seed
```

### Option B: From Local Machine

```bash
# In your local terminal
export DATABASE_URL="postgresql://user:pass@hostname.render.com:5432/logispro"

cd server
npm run db:init
npm run db:seed
```

---

## Step 4: Deploy Backend Web Service

1. Click **"New +"** → **"Web Service"**
2. **Connect GitHub Repository:**
   - Click "Connect GitHub"
   - Authorize Render
   - Select your repository
3. **Configure Service:**
   - **Name:** `logispro-api`
   - **Region:** Oregon (same as database)
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. **Add Environment Variables:**
   Click "Advanced" → "Add Environment Variable"
   
   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `3001` |
   | `DATABASE_URL` | (Paste Internal Database URL from Step 2) |
   | `JWT_SECRET` | (Generate random: use `openssl rand -base64 32`) |
   | `FRONTEND_URL` | `*` |

5. Click **"Create Web Service"**
6. Wait ~5-10 minutes for first deployment

---

## Step 5: Verify Deployment

Once deployed, you'll get a URL like: `https://logispro-api.onrender.com`

Test these endpoints:

```bash
# Health check
curl https://logispro-api.onrender.com/health

# Should return: {"status":"healthy","timestamp":"..."}

# Test login
curl -X POST https://logispro-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@logispro.vn",
    "password": "admin123",
    "deviceId": "test-device",
    "deviceName": "Test",
    "osInfo": "Test OS"
  }'
```

---

## Step 6: Update Frontend Configuration

Now update your Electron app to use the production backend:

1. Create `.env` file in project root (if not exists):

```bash
VITE_API_URL=https://logispro-api.onrender.com
```

2. Or update existing `.env`

3. Rebuild the app:

```bash
npm install
npm run build:mac
```

---

## Troubleshooting

### Database Connection Error

**Error:** `role "postgres" does not exist`

**Fix:** Update `DATABASE_URL` in Render environment variables with the exact Internal Database URL from Step 2.

### 503 Service Unavailable

**Cause:** Free tier spins down after 15 minutes of inactivity.

**Fix:** First request will take 30-60 seconds to wake up the service. Subsequent requests will be fast.

### CORS Error

**Error:** `Access-Control-Allow-Origin`

**Fix:** Make sure `FRONTEND_URL` is set to `*` in environment variables.

---

## Free Tier Limitations

- **Database:** 
  - 1 GB storage
  - 97 hours/month uptime
  - Deleted after 90 days of inactivity

- **Web Service:**
  - 512 MB RAM
  - Spins down after 15 min inactivity
  - 750 hours/month uptime

**Recommendation:** For production, upgrade to paid plans ($7/month for database, $7/month for web service).

---

## Next Steps

After deployment:
1. ✅ Backend is live
2. ⏭️ Build installers with production API URL
3. ⏭️ Setup auto-update mechanism
4. ⏭️ Distribute to users

**Your production API URL:**
```
https://YOUR-SERVICE-NAME.onrender.com
```

Save this URL - you'll need it for the next steps! 🚀
