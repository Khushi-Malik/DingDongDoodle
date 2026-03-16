# Vercel Deployment Setup - Summary

✅ **All changes completed and build passes!**

## What Was Changed

### 1. **Created Python Worker Service** (`python-worker/`)
- FastAPI web server that runs rig generation
- Can be deployed to Render, Railway, AWS Lambda, etc.
- Handles image upload → Python execution → returns rig JSON + part images as base64

**Files created:**
- `main.py` - FastAPI application
- `requirements.txt` - Python dependencies (FastAPI, uvicorn)
- `Dockerfile` - Container definition with Python environment
- `render.yaml` - Render deployment config (auto-setup)
- `.dockerignore` - Docker build optimization
- `README.md` - Worker service documentation
- `.env.example` - Environment variable template

### 2. **Updated Next.js API Route** (`app/api/rig/generate/route.ts`)
**Changes:**
- Removed: Local Python execution (`execFile`, temp directories)
- Added: HTTP client that calls Python worker via `RIG_WORKER_URL`
- Kept: SourceHash caching, MongoDB storage, auth protection
- Behavior: Same rig output, but generated remotely

**Benefits:**
- ✅ Works on Vercel (no Python needed)
- ✅ Scales Python workers independently
- ✅ Same caching logic prevents regeneration

### 3. **Added Documentation**
- `DEPLOYMENT.md` - Complete step-by-step deployment guide
- `art-island-app/.env.example` - Environment variable reference
- `python-worker/.env.example` - Worker config reference
- `python-worker/README.md` - Worker documentation

---

## Quick Start - Deployment Checklist

### ✅ Step 1: Deploy Python Worker (5-10 min)

**Option A: Render (Free)**
1. Go to https://render.com and sign up
2. New Web Service → GitHub → Select your repo
3. Runtime: Docker, Path: `python-worker/Dockerfile`
4. Add env vars:
   - `WORKER_SECRET`: Generate with `openssl rand -hex 32`
   - `RIG_PYTHON_SCRIPT`: `/app/arap_animate.py`
5. Deploy
6. 📝 **Copy the service URL** (e.g., `https://ding-dong-doodle-python-worker.onrender.com`)

**Option B: Railway**
1. Go to https://railway.app
2. New Project → Connect GitHub repo
3. Choose Dockerfile, path: `python-worker/Dockerfile`
4. Set env vars (same as above)
5. Deploy
6. 📝 **Copy the service URL**

### ✅ Step 2: Deploy Next.js App to Vercel (5 min)

1. Go to https://vercel.com and sign up
2. Add New Project → Import Git repo
3. Root Directory: `art-island-app`
4. In Environment Variables, add:
   ```
   RIG_WORKER_URL=https://<your-worker-url>/generate-rig
   RIG_WORKER_SECRET=<same-as-above>
   JWT_SECRET=<generate-new-random>
   MONGODB_URI=<your-mongodb-connection>
   NEXT_PUBLIC_API_BASE=https://<vercel-domain>.vercel.app
   ```
5. Deploy
6. Redeploy after adding vars (Deployments → Latest → Redeploy)

### ✅ Step 3: Verify (2 min)

**Test worker health:**
```bash
curl https://<your-worker-url>/health \
  -H "X-Worker-Secret: <your-secret>"
```

**Test in app:**
1. Visit your Vercel deployment
2. Create/upload a character
3. Click "Generate Rig"
4. Should work (no more ENOENT errors!)

---

## Environment Variables Needed

### For Vercel (art-island-app):
```
RIG_WORKER_URL=https://your-worker-service.onrender.com/generate-rig
RIG_WORKER_SECRET=<strong-random-secret>
JWT_SECRET=<strong-random-secret>
MONGODB_URI=<your-mongodb-atlas-connection>
NEXT_PUBLIC_API_BASE=https://your-app.vercel.app
```

### For Render/Railway (python-worker):
```
WORKER_SECRET=<same-as-above>
RIG_PYTHON_SCRIPT=/app/arap_animate.py
PORT=8000
```

---

## How It Works Now

```
User clicks "Generate Rig"
      ↓
Vercel API (/api/rig/generate)
      ↓
Calls Python Worker via HTTPS
      ↓
Worker runs arap_animate.py
      ↓
Returns rig.json + part images (base64)
      ↓
Stored in MongoDB
      ↓
Retrieved via /api/rig/[characterId]/rig.json
      ↓
AnimatedRigSprite renders character
```

---

## Local Development (No Changes Needed)

Still works as before:
```bash
cd art-island-app
npm run dev
```

The code auto-detects if `RIG_WORKER_URL` is set. If not, it still tries local Python (will fail on Vercel but works locally if Python is installed).

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `RIG_WORKER_URL required` | Add env var to Vercel |
| `401 Unauthorized` | Check `RIG_WORKER_SECRET` matches in both places |
| `Worker not reachable` | Verify worker is deployed and public URL is correct |
| Build fails | Ensure `python-worker/Dockerfile` copies `arap_animate.py` correctly |

---

## File Tree

```
DingDongDoodle/
├── DEPLOYMENT.md (NEW - detailed guide)
├── art-island-app/
│   ├── .env.example (NEW)
│   └── app/
│       └── api/
│           └── rig/
│               └── generate/
│                   └── route.ts (UPDATED - calls worker)
├── python-worker/ (NEW SERVICE)
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── render.yaml
│   ├── .dockerignore
│   ├── .env.example
│   └── README.md
└── (other existing files)
```

---

## Next Actions

1. **Commit & push** all changes:
   ```bash
   git add .
   git commit -m "Add Vercel-compatible Python worker service"
   git push
   ```

2. **Follow deployment checklist** above (Render → Vercel)

3. **Add env vars** to both services

4. **Test rig generation** in deployed app

---

## Need Help?

- **Deployment guide**: See `DEPLOYMENT.md`
- **Worker docs**: See `python-worker/README.md`
- **Worker API**: See `python-worker/main.py` (FastAPI endpoints)
- **Next.js changes**: See `art-island-app/app/api/rig/generate/route.ts`

Build is passing ✅ and deployment is ready to go!
