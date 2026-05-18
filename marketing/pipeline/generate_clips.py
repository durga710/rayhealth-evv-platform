#!/usr/bin/env python3
"""
generate_clips.py

Reads marketing/pipeline/shots.yaml and submits each shot to Seedance via
fal.ai for video generation. Saves resulting MP4s to marketing/clips/spotN/.

Why fal.ai: cleanest Python SDK, hosts both seedance-1.0-pro (high quality, 5
or 10s clips, supports 16:9 and 9:16) and seedance-1.0-lite (faster/cheaper,
5s only). Set --model lite if you want to iterate fast and cheap before
spending pro credits on final clips.

Usage:
    # 1. Put your fal key in marketing/.env (NEVER commit this file):
    #    FAL_KEY=...

    # 2. Install deps:
    #    pip install fal-client pyyaml python-dotenv requests

    # 3. Run:
    #    cd marketing/pipeline
    #    python3 generate_clips.py                       # all shots, pro model
    #    python3 generate_clips.py --spot 1              # only spot 1
    #    python3 generate_clips.py --shot s1-shot1-walkup  # only one shot
    #    python3 generate_clips.py --model lite          # cheaper iteration
    #    python3 generate_clips.py --dry-run             # print plan, don't call API
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

try:
    import yaml
except ImportError:
    sys.stderr.write("Missing dependency: pyyaml. Run: pip install pyyaml\n")
    sys.exit(1)

try:
    import requests
except ImportError:
    sys.stderr.write("Missing dependency: requests. Run: pip install requests\n")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    sys.stderr.write("Missing dependency: python-dotenv. Run: pip install python-dotenv\n")
    sys.exit(1)

try:
    import fal_client  # type: ignore[import-not-found]
except ImportError:
    sys.stderr.write("Missing dependency: fal-client. Run: pip install fal-client\n")
    sys.exit(1)

# ---- Paths ----------------------------------------------------------------

THIS = Path(__file__).resolve().parent
MARKETING_DIR = THIS.parent
CLIPS_DIR = MARKETING_DIR / "clips"
ENV_FILE = MARKETING_DIR / ".env"
SHOTS_FILE = THIS / "shots.yaml"

# ---- Model endpoints -------------------------------------------------------
# Updated to fal.ai's current ByteDance Seedance endpoints. Verify endpoint
# names at https://fal.ai/models?q=seedance before a fresh run.

MODEL_ENDPOINTS = {
    "pro":  "fal-ai/bytedance/seedance/v1/pro/text-to-video",
    "lite": "fal-ai/bytedance/seedance/v1/lite/text-to-video",
}

# ---- Shot dataclass --------------------------------------------------------

@dataclass(frozen=True)
class Shot:
    spot: int
    id: str
    duration_s: int
    resolution: str
    prompt: str
    negative_prompt: str


def load_shots(path: Path) -> list[Shot]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    shots: list[Shot] = []
    for entry in raw.get("shots", []):
        shots.append(
            Shot(
                spot=int(entry["spot"]),
                id=str(entry["id"]),
                duration_s=int(entry["duration_s"]),
                resolution=str(entry["resolution"]),
                prompt=" ".join(str(entry["prompt"]).split()),
                negative_prompt=str(entry.get("negative_prompt", "")),
            )
        )
    return shots


# ---- Submission ------------------------------------------------------------

def submit_shot(shot: Shot, model: str) -> str:
    """
    Submit a shot to Seedance via fal.ai. Returns the URL of the resulting MP4.
    Uses fal_client.subscribe which blocks until the generation completes.
    """
    endpoint = MODEL_ENDPOINTS[model]
    # Parse resolution into aspect_ratio + size. Seedance expects 1280x720 or
    # 720x1280 for lite, and supports 1080p for pro. fal.ai's wrapper normally
    # accepts a `resolution` string OR `aspect_ratio` plus explicit width/height.
    width, height = (int(x) for x in shot.resolution.split("x"))
    aspect_ratio = "16:9" if width >= height else "9:16"
    payload: dict[str, object] = {
        "prompt": shot.prompt,
        "aspect_ratio": aspect_ratio,
        "duration": shot.duration_s,
    }
    if shot.negative_prompt:
        payload["negative_prompt"] = shot.negative_prompt

    result = fal_client.subscribe(  # type: ignore[attr-defined]
        endpoint,
        arguments=payload,
        with_logs=False,
    )
    # fal.ai response shape: {"video": {"url": "https://..."}} for most video models.
    video = result.get("video") if isinstance(result, dict) else None
    if not isinstance(video, dict) or "url" not in video:
        raise RuntimeError(f"Unexpected fal.ai response shape: {result!r}")
    url = video["url"]
    if not isinstance(url, str):
        raise RuntimeError(f"Unexpected video.url type: {type(url).__name__}")
    return url


def download(url: str, out_path: Path) -> int:
    response = requests.get(url, stream=True, timeout=180)
    response.raise_for_status()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    with out_path.open("wb") as fh:
        for chunk in response.iter_content(chunk_size=64 * 1024):
            if chunk:
                fh.write(chunk)
                total += len(chunk)
    return total


# ---- Main ------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Seedance video clips for RayHealth marketing spots.")
    parser.add_argument("--spot", type=int, choices=[1, 2, 3, 4, 5, 6], help="Generate only this spot")
    parser.add_argument("--shot", type=str, help="Generate only this shot id (e.g. s1-shot1-walkup)")
    parser.add_argument("--model", choices=list(MODEL_ENDPOINTS.keys()), default="pro",
                        help="Seedance model variant. 'lite' is faster and cheaper for iteration.")
    parser.add_argument("--dry-run", action="store_true", help="Print plan; don't call API")
    parser.add_argument("--shots-file", type=Path, default=SHOTS_FILE)
    args = parser.parse_args()

    if ENV_FILE.exists():
        load_dotenv(ENV_FILE)
    if not os.environ.get("FAL_KEY") and not args.dry_run:
        sys.stderr.write(
            "FAL_KEY is not set.\n"
            f"Create {ENV_FILE} with the line:\n"
            "  FAL_KEY=...\n"
            "Or export it in your shell. Then re-run.\n"
        )
        return 1

    shots = load_shots(args.shots_file)
    if args.spot:
        shots = [s for s in shots if s.spot == args.spot]
    if args.shot:
        shots = [s for s in shots if s.id == args.shot]
    if not shots:
        sys.stderr.write("No shots matched filters.\n")
        return 1

    total_seconds = sum(s.duration_s for s in shots)
    print(f"=== Plan ===")
    print(f"  shots:        {len(shots)}")
    print(f"  total seconds: {total_seconds}s of generated video")
    print(f"  model:        {args.model} ({MODEL_ENDPOINTS[args.model]})")
    print(f"  output:       {CLIPS_DIR.relative_to(MARKETING_DIR)}/spotN/")
    print()

    for idx, shot in enumerate(shots, start=1):
        out_path = CLIPS_DIR / f"spot{shot.spot}" / f"{shot.id}.mp4"
        print(f"[{idx}/{len(shots)}] spot{shot.spot} {shot.id} ({shot.duration_s}s {shot.resolution})")
        print(f"        prompt: {shot.prompt[:90]}{'...' if len(shot.prompt) > 90 else ''}")
        print(f"        out:    {out_path.relative_to(MARKETING_DIR)}")

        if args.dry_run:
            print("        -- dry run --\n")
            continue

        if out_path.exists():
            print(f"        skip: already exists ({out_path.stat().st_size // 1024} KB)\n")
            continue

        started = time.time()
        try:
            url = submit_shot(shot, args.model)
            size = download(url, out_path)
            elapsed = time.time() - started
            print(f"        -> wrote {size // 1024} KB in {elapsed:.0f}s\n")
        except Exception as exc:
            sys.stderr.write(f"        ERROR: {exc}\n\n")
            continue

    return 0


if __name__ == "__main__":
    sys.exit(main())
