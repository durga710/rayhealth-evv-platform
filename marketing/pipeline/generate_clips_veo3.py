#!/usr/bin/env python3
"""
generate_clips_veo3.py

Reads marketing/pipeline/shots.yaml and submits each shot to Google's Veo 3
model via the Gemini API. Saves resulting MP4s to marketing/clips/spotN/.

Why Veo 3 over Seedance:
  - Generally higher cinematic quality and better prompt adherence
  - Built-in synchronized audio generation (we disable it for these spots
    because we have separate ElevenLabs VO + licensed music)
  - First-party support from Google with a clean SDK

Cost ballpark (verify on https://ai.google.dev/pricing before a big run):
  veo-3.0-fast-generate-preview: ~$0.10/second of generated video
  veo-3.0-generate-preview     : ~$0.75/second of generated video

Recommended workflow:
  1. Run with --model fast to draft every shot (~$11 for the full 140s set)
  2. Identify the 6-8 hero shots you want to keep
  3. Regen JUST those in --model pro for final quality (~$30-50)

Usage:
    # 1. New Veo-capable Google API key in marketing/.env (NEVER in chat):
    #    GOOGLE_AI_API_KEY=AIza...

    # 2. Install deps:
    #    pip install google-genai pyyaml python-dotenv requests

    # 3. Run:
    #    cd marketing/pipeline
    #    python3 generate_clips_veo3.py                            # all shots, pro model
    #    python3 generate_clips_veo3.py --spot 1                   # only spot 1
    #    python3 generate_clips_veo3.py --shot s1-shot1-walkup     # only one shot
    #    python3 generate_clips_veo3.py --model fast               # cheaper iteration
    #    python3 generate_clips_veo3.py --dry-run                  # plan only
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

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
    from google import genai  # type: ignore[import-not-found]
    from google.genai import types as genai_types  # type: ignore[import-not-found]
except ImportError:
    sys.stderr.write(
        "Missing dependency: google-genai. Run: pip install google-genai\n"
        "Note: 'google-generativeai' (older package) does NOT work for Veo.\n"
    )
    sys.exit(1)

# ---- Paths -----------------------------------------------------------------

THIS = Path(__file__).resolve().parent
MARKETING_DIR = THIS.parent
CLIPS_DIR = MARKETING_DIR / "clips"
ENV_FILE = MARKETING_DIR / ".env"
SHOTS_FILE = THIS / "shots.yaml"

# ---- Veo model endpoints ---------------------------------------------------
# Verify model names at https://ai.google.dev/gemini-api/docs/video before a
# fresh run — Google rotates preview model identifiers periodically.

MODELS = {
    "pro":  "veo-3.0-generate-preview",
    "fast": "veo-3.0-fast-generate-preview",
}

# Veo 3 supports 4, 6, or 8 second durations. Our shot list uses 5 or 10s —
# we round to the nearest supported value and trim in DaVinci during assembly.

def veo_duration_for(shot_duration_s: int) -> int:
    """Map our shot-list duration to the nearest Veo-supported duration."""
    if shot_duration_s <= 4:
        return 4
    if shot_duration_s <= 6:
        return 6
    return 8

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


# ---- Veo submission --------------------------------------------------------

def aspect_ratio_for(resolution: str) -> str:
    width, height = (int(x) for x in resolution.split("x"))
    return "16:9" if width >= height else "9:16"


def submit_shot(client: "genai.Client", shot: Shot, model: str) -> bytes:
    """
    Submit a shot to Veo 3 and block until the video is generated.
    Returns the MP4 bytes.

    Veo uses a long-running-operation pattern: the initial call returns an
    operation, which we poll until done. Generation takes 30-120 seconds for
    Fast and 60-180 seconds for Pro on average.
    """
    model_name = MODELS[model]
    veo_duration = veo_duration_for(shot.duration_s)
    aspect = aspect_ratio_for(shot.resolution)

    # `personGeneration='allow_adult'` is required for prompts featuring
    # people. Our shot list has caregivers, owners, families — all adults —
    # so this is the right setting. Veo will refuse prompts with children
    # implied unless the audience is restricted.
    config = genai_types.GenerateVideosConfig(
        aspect_ratio=aspect,
        duration_seconds=veo_duration,
        negative_prompt=shot.negative_prompt or None,
        person_generation="allow_adult",
        number_of_videos=1,
        # We supply audio separately via ElevenLabs; disable Veo's audio gen.
        # The field name has shifted across SDK versions — leave it unset on
        # SDKs that don't support it (server default is on, but we'll mute in
        # post anyway).
    )

    operation = client.models.generate_videos(
        model=model_name,
        prompt=shot.prompt,
        config=config,
    )

    # Poll. fal.ai's subscribe() blocked for us; the google-genai SDK gives us
    # an explicit operation object we drive ourselves.
    poll_interval_s = 10
    timeout_s = 600  # 10 minutes max per shot
    deadline = time.time() + timeout_s
    while not operation.done:
        if time.time() > deadline:
            raise TimeoutError(f"Veo operation didn't finish within {timeout_s}s")
        time.sleep(poll_interval_s)
        operation = client.operations.get(operation)

    if operation.error:
        raise RuntimeError(f"Veo operation error: {operation.error}")

    response = operation.response
    if response is None:
        raise RuntimeError("Veo operation completed but returned no response")

    # The response shape across SDK versions:
    #   response.generated_videos[0].video  → File handle with .uri and bytes
    # We pull the URI and download with requests (works regardless of SDK
    # convenience-method availability).
    videos = getattr(response, "generated_videos", None)
    if not videos:
        raise RuntimeError(f"Veo response has no generated_videos: {response}")
    video = videos[0].video
    uri = getattr(video, "uri", None)
    if not uri:
        # Some SDK builds embed the bytes directly.
        raw = getattr(video, "video_bytes", None) or getattr(video, "data", None)
        if raw:
            return raw  # type: ignore[no-any-return]
        raise RuntimeError(f"Veo response video has no uri or bytes: {video}")

    api_key = os.environ.get("GOOGLE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Cannot download Veo result without GOOGLE_AI_API_KEY")
    response_http = requests.get(uri, params={"key": api_key}, timeout=180)
    response_http.raise_for_status()
    return response_http.content


# ---- Main ------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Veo 3 video clips for RayHealth marketing spots.")
    parser.add_argument("--spot", type=int, choices=[1, 2, 3, 4, 5, 6], help="Generate only this spot")
    parser.add_argument("--shot", type=str, help="Generate only this shot id")
    parser.add_argument("--model", choices=list(MODELS.keys()), default="pro",
                        help="Veo variant. 'fast' is ~7x cheaper for iteration.")
    parser.add_argument("--dry-run", action="store_true", help="Print plan, no API calls")
    parser.add_argument("--shots-file", type=Path, default=SHOTS_FILE)
    args = parser.parse_args()

    if ENV_FILE.exists():
        load_dotenv(ENV_FILE)
    api_key = os.environ.get("GOOGLE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key and not args.dry_run:
        sys.stderr.write(
            "GOOGLE_AI_API_KEY is not set.\n"
            f"Create {ENV_FILE} with the line:\n"
            "  GOOGLE_AI_API_KEY=AIza...\n"
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

    total_seconds = sum(veo_duration_for(s.duration_s) for s in shots)
    cost_per_s = 0.75 if args.model == "pro" else 0.10
    print("=== Plan ===")
    print(f"  shots:           {len(shots)}")
    print(f"  generated video: {total_seconds}s (Veo rounds 5s→6s, 10s→8s)")
    print(f"  model:           {args.model} ({MODELS[args.model]})")
    print(f"  est. cost:       ~${total_seconds * cost_per_s:.2f} (verify pricing first)")
    print(f"  output:          marketing/clips/spotN/")
    print()

    client = None if args.dry_run else genai.Client(api_key=api_key)

    for idx, shot in enumerate(shots, start=1):
        out_path = CLIPS_DIR / f"spot{shot.spot}" / f"{shot.id}.mp4"
        veo_dur = veo_duration_for(shot.duration_s)
        print(f"[{idx}/{len(shots)}] spot{shot.spot} {shot.id} ({shot.duration_s}s→Veo {veo_dur}s, {shot.resolution})")
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
            assert client is not None  # narrowed by dry-run guard above
            video_bytes = submit_shot(client, shot, args.model)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(video_bytes)
            elapsed = time.time() - started
            print(f"        -> wrote {len(video_bytes) // 1024} KB in {elapsed:.0f}s\n")
        except Exception as exc:
            sys.stderr.write(f"        ERROR: {exc}\n\n")
            continue

    return 0


if __name__ == "__main__":
    sys.exit(main())
