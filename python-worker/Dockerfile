# Use Python 3.11 slim image with system dependencies
FROM python:3.11-slim

WORKDIR /app

# Copy current build context and normalize paths so this Dockerfile works
# whether context is repo root or python-worker.
COPY . /src

RUN set -eux; \
    if [ -f /src/main.py ]; then cp /src/main.py /app/main.py; \
    elif [ -f /src/python-worker/main.py ]; then cp /src/python-worker/main.py /app/main.py; \
    else echo "main.py not found in build context"; exit 1; fi; \
    if [ -f /src/requirements.txt ]; then cp /src/requirements.txt /app/requirements.txt; \
    elif [ -f /src/python-worker/requirements.txt ]; then cp /src/python-worker/requirements.txt /app/requirements.txt; \
    else echo "requirements.txt not found in build context"; exit 1; fi; \
    if [ -f /src/arap_animate.py ]; then cp /src/arap_animate.py /app/arap_animate.py; \
    elif [ -f /src/python-worker/arap_animate.py ]; then cp /src/python-worker/arap_animate.py /app/arap_animate.py; \
    elif [ -f /src/art-island-app/image_mesh_animation/arap_animate.py ]; then cp /src/art-island-app/image_mesh_animation/arap_animate.py /app/arap_animate.py; \
    elif [ -f /src/art-island-app/image-mesh-animation/arap_animate.py ]; then cp /src/art-island-app/image-mesh-animation/arap_animate.py /app/arap_animate.py; \
    elif [ -f /src/image_2/arap_animate.py ]; then cp /src/image_2/arap_animate.py /app/arap_animate.py; \
    else echo "arap_animate.py not found in build context"; exit 1; fi

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install system dependencies that arap_animate.py might need
# (PIL, numpy, scipy, etc. are included via pip)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopenblas-dev \
    liblapack-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Environment variables
ENV PORT=8000
ENV RIG_PYTHON_SCRIPT=/app/arap_animate.py
ENV RIG_PYTHON_BIN=python3

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
