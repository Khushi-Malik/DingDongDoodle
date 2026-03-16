"""
FastAPI Python worker for rig generation.
Deploy to Render, Railway, or similar serverless Python platform.
"""
import os
import json
import tempfile
import base64
import subprocess
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI()

# Worker secret for basic auth
WORKER_SECRET = os.environ.get("WORKER_SECRET", "your-secret-key-change-in-prod")

# Path to arap_animate.py script
SCRIPT_PATH = os.environ.get("RIG_PYTHON_SCRIPT", "/app/arap_animate.py")
PYTHON_BIN = os.environ.get("RIG_PYTHON_BIN", "python3")


def verify_secret(x_worker_secret: str = Header(...)):
    """Verify worker secret from X-Worker-Secret header."""
    if x_worker_secret != WORKER_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


def get_file_content_type(file_path: str) -> str:
    """Determine content type from file extension."""
    ext = Path(file_path).suffix.lower()
    type_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".json": "application/json",
    }
    return type_map.get(ext, "application/octet-stream")


@app.post("/generate-rig")
async def generate_rig(
    image: UploadFile = File(...),
    use_editor: bool = False,
    x_worker_secret: str = Header(...),
):
    """
    Generate a rig from an image.
    
    Args:
        image: The character image file
        use_editor: Whether to include editor mode (True = with editor, False = --no-editor)
        x_worker_secret: Worker secret for authentication
    
    Returns:
        JSON with rigJson and base64-encoded files
    """
    try:
        verify_secret(x_worker_secret)
    except HTTPException as e:
        return JSONResponse({"error": str(e.detail)}, status_code=e.status_code)

    # Check if script exists
    if not Path(SCRIPT_PATH).exists():
        return JSONResponse(
            {"error": f"Script not found: {SCRIPT_PATH}"}, status_code=500
        )

    with tempfile.TemporaryDirectory(prefix="rig-") as tmp_dir:
        tmp_path = Path(tmp_dir)
        input_path = tmp_path / "input.png"
        out_dir = tmp_path / "out"
        out_dir.mkdir(exist_ok=True)

        try:
            # Save uploaded image
            image_data = await image.read()
            input_path.write_bytes(image_data)

            # Build command
            cmd = [PYTHON_BIN, SCRIPT_PATH, str(input_path), "--out", str(out_dir)]
            if not use_editor:
                cmd.append("--no-editor")

            # Run Python script
            result = subprocess.run(
                cmd,
                cwd=str(Path(SCRIPT_PATH).parent),
                capture_output=True,
                text=True,
                timeout=120,  # 2 minute timeout
            )

            if result.returncode != 0:
                return JSONResponse(
                    {
                        "error": f"Rig generation failed: {result.stderr}",
                        "stdout": result.stdout,
                    },
                    status_code=500,
                )

            # Read rig.json
            rig_json_path = out_dir / "rig.json"
            if not rig_json_path.exists():
                return JSONResponse(
                    {"error": "rig.json not found in output"}, status_code=500
                )

            rig_json = json.loads(rig_json_path.read_text())

            # Collect part files
            part_files = {}
            if "parts" in rig_json:
                for part_name, part_data in rig_json["parts"].items():
                    if "file" in part_data:
                        file_key = part_data["file"].replace("\\", "/").lstrip("/")
                        if ".." in file_key:
                            return JSONResponse(
                                {"error": f"Unsafe file path: {file_key}"},
                                status_code=400,
                            )

                        file_path = out_dir / file_key
                        if not str(file_path.resolve()).startswith(str(out_dir.resolve())):
                            return JSONResponse(
                                {
                                    "error": f"File escapes output directory: {file_key}"
                                },
                                status_code=400,
                            )

                        if file_path.exists():
                            file_data = file_path.read_bytes()
                            part_files[file_key] = {
                                "contentType": get_file_content_type(str(file_path)),
                                "dataBase64": base64.b64encode(file_data).decode("utf-8"),
                            }

            return JSONResponse(
                {
                    "ok": True,
                    "rigJson": rig_json,
                    "files": part_files,
                }
            )

        except subprocess.TimeoutExpired:
            return JSONResponse(
                {"error": "Rig generation timeout (2 min)"}, status_code=500
            )
        except Exception as e:
            return JSONResponse(
                {"error": f"Worker error: {str(e)}"}, status_code=500
            )


@app.get("/health")
async def health():
    """Health check endpoint."""
    script_exists = Path(SCRIPT_PATH).exists()
    return JSONResponse(
        {
            "status": "ok" if script_exists else "script_missing",
            "script_path": SCRIPT_PATH,
            "script_exists": script_exists,
            "python_bin": PYTHON_BIN,
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
