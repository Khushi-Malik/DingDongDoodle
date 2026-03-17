# Use Python 3.11 slim image with system dependencies
FROM python:3.11-slim

WORKDIR /app

# Copy worker app
COPY main.py .
COPY requirements.txt .
COPY arap_animate.py .

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
