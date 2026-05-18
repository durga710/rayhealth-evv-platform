#!/usr/bin/env python3
"""
generate_vo.py

Reads each spot's VO line from marketing/scripts/spotN-*.md and generates
ElevenLabs voiceovers as MP3 files in marketing/vo/.

Usage:
    # 1. Put your API key in marketing/.env (NEVER commit this file):
    #    ELEVENLABS_API_KEY=sk-...

    # 2. Install deps:
    #    pip install requests python-dotenv

    # 3. Run:
    #    cd marketing/pipeline
    #    python3 generate_vo.py
    #    # OR generate just one spot:
    #    python3 generate_vo.py --spot 1

Output: marketing/vo/spotN-vo.mp3 — one file per spot, 44.1 kHz mono, ~-18 LUFS.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

try:
    import requests
except ImportError:
    sys.stderr.write("Missing dependency: requests. Run: pip install requests python-dotenv\n")
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    sys.stderr.write("Missing dependency: python-dotenv. Run: pip install python-dotenv\n")
    sys.exit(1)

# ---- Paths ----------------------------------------------------------------

THIS = Path(__file__).resolve().parent
MARKETING_DIR = THIS.parent
SCRIPTS_DIR = MARKETING_DIR / "scripts"
VO_DIR = MARKETING_DIR / "vo"
ENV_FILE = MARKETING_DIR / ".env"

# ---- Voice configuration ---------------------------------------------------
# Each spot maps to a specific ElevenLabs voice. Find voice IDs in your
# ElevenLabs library at https://elevenlabs.io/app/voice-library. The default
# IDs below are widely available premium voices — swap with your preferred
# clones or library voices as you finalize the brand voice direction.

@dataclass(frozen=True)
class VoiceConfig:
    spot: int
    label: str
    voice_id: str
    stability: float          # 0.0 .. 1.0 — higher = more consistent / less expressive
    similarity_boost: float   # 0.0 .. 1.0 — higher = sticks closer to the source voice
    style: float              # 0.0 .. 1.0 — higher = more dramatic/expressive
    use_speaker_boost: bool

# Defaults chosen to match each spot's tone direction. Adjust voice_id only.
VOICE_CONFIGS: dict[int, VoiceConfig] = {
    1: VoiceConfig(  # Hero — calm/credible
        spot=1, label="hero",
        voice_id="JBFqnCBsd6RMkjVDRZzb",  # "George" — confident neutral
        stability=0.65, similarity_boost=0.75, style=0.15,
        use_speaker_boost=True,
    ),
    2: VoiceConfig(  # Agency owner — direct/confident
        spot=2, label="agency-owner",
        voice_id="XB0fDUnXU5powFXDhCwa",  # "Charlotte" — confident female
        stability=0.55, similarity_boost=0.80, style=0.35,
        use_speaker_boost=True,
    ),
    3: VoiceConfig(  # Caregiver — warm/peer
        spot=3, label="caregiver",
        voice_id="FGY2WhTYpPnrIDTdsKH5",  # "Laura" — warm conversational
        stability=0.50, similarity_boost=0.75, style=0.45,
        use_speaker_boost=True,
    ),
    4: VoiceConfig(  # Family — tender/calm
        spot=4, label="family",
        voice_id="cgSgspJ2msm6clMCkdW9",  # "Jessica" — calm warm
        stability=0.70, similarity_boost=0.80, style=0.20,
        use_speaker_boost=True,
    ),
    5: VoiceConfig(  # Compliance — precise/credible
        spot=5, label="compliance",
        voice_id="onwK4e9ZLuTAKqWW03F9",  # "Daniel" — articulate news anchor
        stability=0.75, similarity_boost=0.75, style=0.10,
        use_speaker_boost=True,
    ),
    6: VoiceConfig(  # Bumper — matches Spot 1
        spot=6, label="bumper",
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        stability=0.65, similarity_boost=0.75, style=0.20,
        use_speaker_boost=True,
    ),
}

# ---- Script parsing --------------------------------------------------------

def extract_vo_text(script_path: Path) -> str:
    """
    Extract the VO copy from a spot markdown file. The convention is:
    a `## Voiceover` heading, then any number of blank lines, then a single
    paragraph of verbatim VO. We stop at the next `##` heading or `**Word count:**`.
    """
    raw = script_path.read_text(encoding="utf-8")
    lines = raw.splitlines()

    vo_lines: list[str] = []
    in_section = False
    for line in lines:
        if re.match(r"^##\s*Voiceover", line, re.IGNORECASE):
            in_section = True
            continue
        if not in_section:
            continue
        if line.strip().startswith("##"):
            break
        if line.strip().startswith("**Word count"):
            break
        if line.strip().startswith("---"):
            break
        if line.strip().startswith("(") and line.strip().endswith(")"):
            # parenthetical stage directions like "(use this exact text)" — skip
            continue
        if line.strip().startswith("**"):
            # bold descriptors like "**Voiceover (verbatim — ...)**" — skip
            continue
        vo_lines.append(line)

    text = " ".join(l.strip() for l in vo_lines if l.strip())
    if not text:
        raise ValueError(f"No Voiceover section found in {script_path}")
    return text


def find_script_for_spot(spot: int) -> Optional[Path]:
    matches = sorted(SCRIPTS_DIR.glob(f"spot{spot}-*.md"))
    if not matches:
        return None
    return matches[0]


# ---- ElevenLabs API --------------------------------------------------------

ELEVENLABS_BASE = "https://api.elevenlabs.io/v1"
MODEL_ID = "eleven_multilingual_v2"  # high quality, supports English perfectly


def synthesize(api_key: str, text: str, voice: VoiceConfig, out_path: Path) -> None:
    url = f"{ELEVENLABS_BASE}/text-to-speech/{voice.voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": MODEL_ID,
        "voice_settings": {
            "stability": voice.stability,
            "similarity_boost": voice.similarity_boost,
            "style": voice.style,
            "use_speaker_boost": voice.use_speaker_boost,
        },
    }
    response = requests.post(url, headers=headers, json=payload, timeout=120)
    if response.status_code != 200:
        raise RuntimeError(
            f"ElevenLabs API error {response.status_code}: {response.text[:500]}"
        )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(response.content)


# ---- Main ------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Generate ElevenLabs voiceovers for RayHealth marketing spots.")
    parser.add_argument("--spot", type=int, choices=[1, 2, 3, 4, 5, 6], help="Generate only this spot (default: all)")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be generated, don't call API")
    args = parser.parse_args()

    if ENV_FILE.exists():
        load_dotenv(ENV_FILE)
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key and not args.dry_run:
        sys.stderr.write(
            "ELEVENLABS_API_KEY is not set.\n"
            f"Create {ENV_FILE} with the line:\n"
            "  ELEVENLABS_API_KEY=sk-...\n"
            "Or export it in your shell. Then re-run.\n"
        )
        return 1

    spots_to_run = [args.spot] if args.spot else sorted(VOICE_CONFIGS.keys())

    for spot_num in spots_to_run:
        voice = VOICE_CONFIGS[spot_num]
        script_path = find_script_for_spot(spot_num)
        if script_path is None:
            sys.stderr.write(f"[spot{spot_num}] No script file found in {SCRIPTS_DIR}\n")
            continue
        text = extract_vo_text(script_path)
        out_path = VO_DIR / f"spot{spot_num}-{voice.label}-vo.mp3"

        word_count = len(text.split())
        print(f"[spot{spot_num}] {voice.label}")
        print(f"  script: {script_path.name}")
        print(f"  voice:  {voice.voice_id} (stability={voice.stability}, style={voice.style})")
        print(f"  words:  {word_count} (~{word_count / 2.5:.0f}s at 150 wpm)")
        print(f"  out:    {out_path.relative_to(MARKETING_DIR)}")

        if args.dry_run:
            print("  -- dry run, not calling API --\n")
            continue

        try:
            synthesize(api_key, text, voice, out_path)
            print(f"  -> wrote {out_path.stat().st_size // 1024} KB\n")
        except Exception as exc:
            sys.stderr.write(f"  ERROR: {exc}\n\n")
            continue

    return 0


if __name__ == "__main__":
    sys.exit(main())
