# Python Rig Generation Worker

This is a FastAPI microservice that handles Python-based rig generation for Ding Dong Doodle. It's designed to be deployed separately from the main Next.js application (e.g., on Render, Railway, or AWS Lambda).

## Why a Separate Service?

Vercel's serverless functions don't include Python or system binaries by default. By running the Python rig generation in a separate containerized service, we can:

- ✅ Deploy Vercel without Python dependencies
- ✅ Scale Python workers independently  
- ✅ Use platform-specific optimizations (free tier on Render/Railway)
- ✅ Keep main app lightweight

## Local Development

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Copy arap_animate.py
```bash
# Adjust path to match where your Python script is located
cp ../image_2/arap_animate.py .
```

### 3. Run locally
```bash
WORKER_SECRET=dev-secret python main.py
```

Server runs at `http://localhost:8000`

### 4. Test endpoint
```bash
curl http://localhost:8000/health \
  -H "X-Worker-Secret: dev-secret"
```

## API Endpoints

### POST /generate-rig
Generates a rig from a character image.

**Headers:**
```
X-Worker-Secret: <your-secret>
Content-Type: multipart/form-data
```

**Form Parameters:**
- `image` (file, required): PNG/JPEG character image
- `use_editor` (boolean, optional): Include editor mode (default: false)

**Response:**
```json
{
  "ok": true,
  "rigJson": { "parts": {...}, ... },
  "files": {
    "part_01.png": {
      "contentType": "image/png",
      "dataBase64": "iVBORw0KGgo..."
    }
  }
}
```

### GET /health
Health check endpoint.

**Headers:**
```
X-Worker-Secret: <your-secret>
```

**Response:**
```json
{
  "status": "ok",
  "script_path": "/app/arap_animate.py",
  "script_exists": true,
  "python_bin": "python3"
}
```

## Deployment

### Render (Recommended)

1. Push this directory to GitHub
2. Go to https://dashboard.render.com → New Web Service
3. Connect your repository, select this folder
4. Set environment variables (see `.env.example`)
5. Click Deploy

Public URL: `https://ding-dong-doodle-python-worker.onrender.com`

### Railway

1. New Project → GitHub Repo
2. Choose Dockerfile
3. Set env vars in Railway dashboard
4. Deploy

### Docker (Local)

```bash
docker build -t ding-doodle-worker .
docker run -p 8000:8000 \
  -e WORKER_SECRET=dev-secret \
  ding-doodle-worker
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `script not found` | Verify `RIG_PYTHON_SCRIPT` path in Dockerfile and env var |
| `401 Unauthorized` | Check `X-Worker-Secret` header matches `WORKER_SECRET` |
| `timeout (2 min)` | Large/complex images take time; normal for first run |
| Build fails | Ensure `../image_2/arap_animate.py` exists relative to Dockerfile |

## Performance

- **First request**: ~30-60 seconds (includes Python startup)
- **Subsequent**: ~20-30 seconds per image
- **Rendering**: Workers are stateless and auto-scale

## Environment Variables

See `.env.example` for all options.

## Security

- ✅ Request authentication via `X-Worker-Secret` header
- ✅ Path traversal protection (sanitizes file paths)
- ✅ Timeout protection (2-minute max execution)
- ⚠️ **Important**: Use strong random secret in production (`openssl rand -hex 32`)
