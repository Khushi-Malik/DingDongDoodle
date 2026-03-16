# Vercel + Python Worker Deployment Guide

This guide explains how to deploy Ding Dong Doodle to Vercel with a separate Python worker service for rig generation.

## Architecture

```
┌─────────────────┐
│   Vercel App    │ (Next.js on Serverless)
│  art-island-app │
└────────┬────────┘
         │ (HTTP POST to /generate-rig)
         ▼
┌────────────────────────────────────────┐
│   Python Worker Service                │
│   (Render, Railway, AWS Lambda, etc.)  │
│   - FastAPI server                     │
│   - Runs arap_animate.py               │
│   - Returns rig.json + part images     │
└────────────────────────────────────────┘
         │ (Returns JSON with base64 files)
         ▼
┌──────────────────┐
│    MongoDB       │
│  (Atlas, etc.)   │ (Stores rigAssets)
└──────────────────┘
```

## Part 1: Deploy Python Worker

### Option A: Deploy to Render (Recommended - Free tier available)

1. **Sign up to Render**: https://render.com

2. **Push python-worker to GitHub** (if not already there):
   ```bash
   git add python-worker/
   git commit -m "Add Python worker for Vercel deployment"
   git push origin main
   ```

3. **Connect to Render**:
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Find the repository and click "Connect"

4. **Configure Web Service**:
   - **Name**: `ding-dong-doodle-python-worker`
   - **Runtime**: `Docker`
   - **Branch**: `main`
   - **Dockerfile Path**: `python-worker/Dockerfile`
   - **Auto-Deploy**: Toggle ON

5. **Add Environment Variables**:
   - Click "Environment" tab
   - Add these variables:
     ```
     WORKER_SECRET=<generate-a-strong-random-string>
     RIG_PYTHON_SCRIPT=/app/arap_animate.py
     PORT=8000
     ```
   - **IMPORTANT**: Generate a strong WORKER_SECRET (e.g., `openssl rand -hex 32`)

6. **Deploy**:
   - Click "Create Web Service"
   - Wait for build (5-10 minutes for first build)
   - Copy the service URL (e.g., `https://ding-dong-doodle-python-worker.onrender.com`)

7. **Test the worker**:
   ```bash
   curl https://ding-dong-doodle-python-worker.onrender.com/health \
     -H "X-Worker-Secret: <your-WORKER_SECRET>"
   ```
   Should return:
   ```json
   {"status": "ok", "script_path": "/app/arap_animate.py", "script_exists": true}
   ```

### Option B: Deploy to Railway (Also free)

1. **Sign up**: https://railway.app

2. **Connect repository**:
   - New Project → GitHub → Select your repo

3. **Create Web Service**:
   - Choose `Dockerfile`
   - Path: `python-worker/Dockerfile`

4. **Set Environment Variables** in Railway dashboard:
   ```
   WORKER_SECRET=<strong-random-string>
   RIG_PYTHON_SCRIPT=/app/arap_animate.py
   ```

5. **Deploy** → Copy the public URL when ready

## Part 2: Deploy Next.js App to Vercel

1. **Push to GitHub** (if not already):
   ```bash
   cd art-island-app
   git add .
   git commit -m "Enable Vercel deployment with Python worker"
   git push origin main
   ```

2. **Sign up to Vercel**: https://vercel.com

3. **Import Project**:
   - Go to Dashboard → Add New → Project
   - Import Git repository
   - Select your repo

4. **Configure Build**:
   - **Root Directory**: `art-island-app`
   - **Framework Preset**: `Next.js`
   - Click "Deploy"

5. **Add Environment Variables** AFTER deployment starts:
   - Go to Settings → Environment Variables
   - Add these variables (**must match your Python worker deployment**):
     ```
     RIG_WORKER_URL=https://ding-dong-doodle-python-worker.onrender.com/generate-rig
     RIG_WORKER_SECRET=<your-WORKER_SECRET-from-above>
     JWT_SECRET=<strong-random-string>
     MONGODB_URI=<your-mongodb-atlas-uri>
     NEXT_PUBLIC_API_BASE=https://<your-vercel-domain>.vercel.app
     ```

6. **Redeploy** after adding env vars:
   - Go to Deployments → Latest → Click 3 dots → "Redeploy"

## Part 3: Verify Deployment

1. **Test health endpoint**:
   ```bash
   curl "https://ding-dong-doodle-python-worker.onrender.com/health" \
     -H "X-Worker-Secret: <your-secret>"
   ```

2. **Test rig generation** via Vercel app:
   - Log in to deployed app
   - Create/upload a character
   - Click "Generate Rig"
   - Should work without `ENOENT` errors

3. **Check logs**:
   - **Vercel**: Deployments → Functions → View logs
   - **Render**: Dashboard → Service → Logs

## Troubleshooting

### "Worker not reachable" error

- Check `RIG_WORKER_URL` in Vercel env vars is correct
- Verify worker service is running: curl the `/health` endpoint
- Check `RIG_WORKER_SECRET` matches in both services

### "Rig generation failed" on Render

- Check worker logs: Dashboard → Service → Logs
- Verify `/app/arap_animate.py` exists inside container
- Confirm `Dockerfile` copies the script correctly

### "Unauthorized" error (401)

- Check `RIG_WORKER_SECRET` value matches exactly in both services
- Verify `X-Worker-Secret` header is being sent

### Slow first rig generation

- Docker image builds are cached on subsequent deployments
- First build on Render can take 10+ minutes
- Subsequent generations should be ~30 seconds

## Cost Breakdown

| Service | Free Tier | Pro Tier |
|---------|-----------|----------|
| **Vercel** | $0/month | $20/month (optional) |
| **Render** | $0/month (512MB RAM) | $7/month per service |
| **MongoDB Atlas** | 512MB → $0 | Paid as needed |
| **Total** | **$0** | ~$27/month |

## Local Development (No Python Worker Needed)

To run locally with the old Python execution model:

```bash
cd art-island-app
npm run dev
```

The existing code still supports local Python if `RIG_WORKER_URL` is not set (falls back to filesystem execution).

## Environment Variables Reference

### Vercel (art-island-app/.env.production)
```
RIG_WORKER_URL=https://your-worker.onrender.com/generate-rig
RIG_WORKER_SECRET=<copy-from-render>
JWT_SECRET=<new-random-string>
MONGODB_URI=<your-mongodb-uri>
NEXT_PUBLIC_API_BASE=https://your-app.vercel.app
```

### Render (python-worker)
```
WORKER_SECRET=<same-as-RIG_WORKER_SECRET>
RIG_PYTHON_SCRIPT=/app/arap_animate.py
PORT=8000
```

## Scaling Tips

- **Render memory**: Start with 512MB, increase if timeouts occur
- **Vercel functions**: Auto-scales, no config needed
- **MongoDB**: Monitor storage, add indexes on `characters.userId`
- **Worker concurrency**: Render standard can handle ~10 concurrent requests

## Next Steps

1. ✅ Create `python-worker/` directory with FastAPI app
2. ✅ Update `/api/rig/generate/route.ts` to call worker
3. ⏳ Deploy Python worker to Render/Railway
4. ⏳ Deploy Next.js app to Vercel
5. ⏳ Add environment variables to both services
6. ⏳ Test rig generation end-to-end
