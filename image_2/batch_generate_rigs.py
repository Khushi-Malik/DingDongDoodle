#!/usr/bin/env python3
"""
Batch-generate character rig assets from MongoDB drawings.

This script uses existing arap_animate.py to segment and export:
- rig.json
- parts/*.png

Outputs are copied into Next.js public rigs folder:
  art-island-app/public/rigs/<characterId>/

Usage examples:
  python batch_generate_rigs.py --mongo-uri "$MONGODB_URI"
  python batch_generate_rigs.py --mongo-uri "$MONGODB_URI" --character-id <id>
  python batch_generate_rigs.py --mongo-uri "$MONGODB_URI" --limit 10 --skip-existing
"""

from __future__ import annotations

import argparse
import base64
import os
import shutil
import tempfile
import urllib.request
from pathlib import Path
from typing import Iterable, Optional
from urllib.parse import urlparse

from pymongo import MongoClient

from arap_animate import main as generate_rig


def infer_db_name(mongo_uri: str) -> str:
    parsed = urlparse(mongo_uri)
    path = (parsed.path or "").lstrip("/")
    if path:
        if "?" in path:
            return path.split("?", 1)[0]
        return path
    return "test"


def decode_data_url_to_file(data_url: str, output_file: Path) -> bool:
    if not data_url.startswith("data:image"):
        return False
    try:
        _, data = data_url.split(",", 1)
        payload = base64.b64decode(data)
        output_file.write_bytes(payload)
        return True
    except Exception:
        return False


def download_image_to_file(url: str, output_file: Path) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            output_file.write_bytes(response.read())
        return True
    except Exception:
        return False


def prepare_input_image(image_url: str, output_file: Path) -> bool:
    if decode_data_url_to_file(image_url, output_file):
        return True
    if image_url.startswith("http://") or image_url.startswith("https://"):
        return download_image_to_file(image_url, output_file)

    # Last fallback: local path.
    p = Path(image_url)
    if p.exists() and p.is_file():
        shutil.copy2(p, output_file)
        return True
    return False


def iter_characters(collection, character_ids: Optional[set[str]], limit: Optional[int]) -> Iterable[dict]:
    query = {}
    if character_ids:
        query["_id"] = {"$in": list(character_ids)}
    cursor = collection.find(query).sort("createdAt", 1)
    if limit and limit > 0:
        cursor = cursor.limit(limit)
    yield from cursor


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate rig assets for characters")
    parser.add_argument("--mongo-uri", default=os.getenv("MONGODB_URI"), help="MongoDB URI")
    parser.add_argument(
        "--public-rigs-dir",
        default="../art-island-app/public/rigs",
        help="Target public rigs directory",
    )
    parser.add_argument(
        "--character-id",
        action="append",
        default=[],
        help="Character _id to process (can be repeated)",
    )
    parser.add_argument("--limit", type=int, default=0, help="Max characters to process")
    parser.add_argument("--skip-existing", action="store_true", help="Skip if rig.json already exists")
    parser.add_argument(
        "--use-editor",
        action="store_true",
        help="Open interactive joint editor in arap_animate (default is off)",
    )
    args = parser.parse_args()

    if not args.mongo_uri:
        raise SystemExit("Missing --mongo-uri (or MONGODB_URI env var)")

    public_rigs_dir = Path(args.public_rigs_dir).resolve()
    public_rigs_dir.mkdir(parents=True, exist_ok=True)

    client = MongoClient(args.mongo_uri)
    db_name = infer_db_name(args.mongo_uri)
    db = client[db_name]
    collection = db["characters"]

    ids = set(args.character_id) if args.character_id else None
    limit = args.limit if args.limit > 0 else None

    processed = 0
    skipped = 0
    failed = 0

    for char in iter_characters(collection, ids, limit):
        char_id = str(char.get("_id"))
        image_url = char.get("imageUrl")

        if not image_url:
            print(f"[skip] {char_id}: no imageUrl")
            skipped += 1
            continue

        out_dir = public_rigs_dir / char_id
        rig_json = out_dir / "rig.json"

        if args.skip_existing and rig_json.exists():
            print(f"[skip] {char_id}: rig already exists")
            skipped += 1
            continue

        with tempfile.TemporaryDirectory(prefix=f"rig_{char_id}_") as tmp:
            tmp_path = Path(tmp)
            input_png = tmp_path / "input.png"

            if not prepare_input_image(image_url, input_png):
                print(f"[fail] {char_id}: could not decode/download image")
                failed += 1
                continue

            tmp_out = tmp_path / "generated"

            try:
                generate_rig(str(input_png), out_dir=str(tmp_out), use_editor=args.use_editor)
            except Exception as exc:
                print(f"[fail] {char_id}: rig generation error: {exc}")
                failed += 1
                continue

            if not (tmp_out / "rig.json").exists() or not (tmp_out / "parts").exists():
                print(f"[fail] {char_id}: missing generated rig outputs")
                failed += 1
                continue

            if out_dir.exists():
                shutil.rmtree(out_dir)
            out_dir.mkdir(parents=True, exist_ok=True)

            shutil.copy2(tmp_out / "rig.json", out_dir / "rig.json")
            shutil.copytree(tmp_out / "parts", out_dir / "parts")

            processed += 1
            print(f"[ok] {char_id} -> {out_dir}")

    print("\n=== Summary ===")
    print(f"Processed: {processed}")
    print(f"Skipped:   {skipped}")
    print(f"Failed:    {failed}")


if __name__ == "__main__":
    main()
