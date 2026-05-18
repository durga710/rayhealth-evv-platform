# RayHealth EVV — Marketing video pipeline

End-to-end production for the six marketing spots in `MARKETING_KIT.md`, automated with ElevenLabs (voiceover) + Seedance via fal.ai (video) + DaVinci Resolve (assembly).

```
marketing/
├── scripts/                  ← VO copy + shot lists per spot
│   ├── spot1-hero.md
│   ├── spot2-agency-owner.md
│   ├── spot3-caregiver.md
│   ├── spot4-family.md
│   ├── spot5-compliance.md
│   └── spot6-bumper.md
├── pipeline/
│   ├── generate_vo.py        ← ElevenLabs runner
│   ├── generate_clips.py     ← Seedance / fal.ai runner
│   └── shots.yaml            ← 27 shots across 6 spots
├── vo/                       ← output: one MP3 per spot (~75 KB each)
├── clips/                    ← output: ~27 MP4 clips, grouped by spot folder
└── .env                      ← API keys — NEVER commit (covered by .gitignore)
```

---

## 1. Setup (one time)

### 1a. Install Python dependencies

```
pip install requests python-dotenv pyyaml fal-client
```

If you're using a Python virtualenv (recommended) create one in the marketing folder first:

```
cd marketing
python3 -m venv .venv
source .venv/bin/activate
pip install requests python-dotenv pyyaml fal-client
```

### 1b. Create `.env` with your API keys

```
cd marketing
touch .env
chmod 600 .env
```

Edit `.env` with your editor of choice and add:

```
ELEVENLABS_API_KEY=sk-...your-key-here...
FAL_KEY=your-fal-key-here
```

**Important:** add `marketing/.env` to `.gitignore` if it's not already covered. Verify:

```
git check-ignore marketing/.env
# Should print: marketing/.env
```

If it doesn't, add a line to `.gitignore`:

```
echo "marketing/.env" >> .gitignore
```

Never paste these keys into chat, into a script that gets committed, or into a shell as a literal command. Always read them from `.env`.

### 1c. Get the API keys

**ElevenLabs:**
1. Go to https://elevenlabs.io/app/settings/api-keys
2. Click "Create API Key"
3. Copy the key (starts with `sk_`)
4. Paste into `marketing/.env` as the `ELEVENLABS_API_KEY` value

**fal.ai:**
1. Go to https://fal.ai/dashboard/keys
2. Click "Create new key"
3. Copy the key
4. Paste into `marketing/.env` as the `FAL_KEY` value

---

## 2. Generate the voiceovers

Quick smoke test that the script can parse all your script files:

```
cd marketing/pipeline
python3 generate_vo.py --dry-run
```

Should print 6 rows, one per spot, showing word count and projected duration. If a row says "No script file found" for any spot, the script filename doesn't match the `spot{N}-*.md` pattern.

Generate just spot 1 to verify the API call shape:

```
python3 generate_vo.py --spot 1
```

Output lands at `marketing/vo/spot1-hero-vo.mp3`. Listen to it. If it's the right tone, generate the rest:

```
python3 generate_vo.py
```

All 6 MP3s land in `marketing/vo/`. Each spot uses a different voice configured in `generate_vo.py`'s `VOICE_CONFIGS` dict — swap voice IDs there to use your own voice clones or different library voices.

**Cost estimate:** ~3,000 characters total across the six spots, well within ElevenLabs' Starter plan monthly quota.

---

## 3. Generate the video clips

**Two pipelines available — pick one:**

| | Veo 3 (Google) | Seedance (fal.ai) |
|---|---|---|
| Script | `generate_clips_veo3.py` | `generate_clips.py` |
| Auth env var | `GOOGLE_AI_API_KEY` | `FAL_KEY` |
| Quality (subjective) | Generally higher cinematic | Strong but more variable |
| Per-second cost | ~$0.10 (Fast) / ~$0.75 (Pro) | ~$0.05 (Lite) / ~$0.15 (Pro) |
| Clip durations | 4, 6, or 8 seconds | 5 or 10 seconds |
| Full 140s pass cost | ~$16 Fast / ~$120 Pro | ~$8 Lite / ~$25 Pro |

**Recommendation: start with Veo 3 Fast.** It's higher quality than Seedance Lite, cheap enough to iterate, and lets you preview every shot for under $20 before committing to Pro on the 6-8 hero shots you keep.

Quick smoke test:

```
cd marketing/pipeline
python3 generate_clips_veo3.py --dry-run    # for Veo 3
# OR
python3 generate_clips.py --dry-run          # for Seedance
```

Should print 27 shot rows.

**Veo 3 recommended workflow:**

Verify wiring with one shot on Fast:

```
python3 generate_clips_veo3.py --shot s1-shot3-checkin --model fast
```

A single Veo Fast generation takes 30–90 seconds. Output lands at `marketing/clips/spot1/s1-shot3-checkin.mp4`.

Full Fast pass once wiring is confirmed:

```
python3 generate_clips_veo3.py --model fast
```

~27 generations × ~60s each = roughly **30 minutes wall-clock**. They run sequentially. Cost ~$16 for all 27 shots.

Watch the previews. Identify your 6-8 hero shots. Re-gen JUST those on Pro:

```
python3 generate_clips_veo3.py --shot s1-shot1-walkup --model pro
python3 generate_clips_veo3.py --shot s1-shot6-client-warmth --model pro
```

The script skips shots whose output file already exists — delete the file to force regen. So `rm clips/spot1/s1-shot1-walkup.mp4` then re-run.

**Important per-shot detail:** Veo 3 supports 4, 6, or 8 second clips. The shot list requests 5 or 10 seconds; the script auto-rounds (5→6, 10→8). You'll trim to the exact shot-list duration in DaVinci during assembly.

**If you'd rather use Seedance:** swap `generate_clips_veo3.py` for `generate_clips.py` in every command above. Same arguments, same output paths. Seedance supports the exact 5/10s durations from the shot list.

---

## 4. Assembly in DaVinci Resolve

DaVinci Resolve's free tier handles this entire project. Premiere or Final Cut work fine if that's your tool.

**Per spot, the timeline structure is:**

```
Track 4: Logo / brand identity overlays      (0–3s and 27–30s)
Track 3: Animated title cards                 (Spot 5 only)
Track 2: Generated Seedance clips             (cut to shot-list timing)
Track 1: ElevenLabs voiceover MP3             (continuous across 30s)
Audio:   Music bed @ -22 LUFS                 (under VO)
```

**Step by step for one spot:**

1. **New Project** — Resolution 1920×1080, frame rate 24fps (matches Seedance default).
2. **Import** the VO MP3 (`marketing/vo/spotN-vo.mp3`) and all clips for that spot (`marketing/clips/spotN/`).
3. **Drop VO on Track 1.** This is your master timing.
4. **Drop clips on Track 2** in the order from the script's shot list. Trim each clip to the duration in the table.
5. **Music bed:** Drop the licensed track on a third audio track, drop volume to -22 LUFS so it sits under the VO. Resolve's Fairlight tab has an LUFS meter — use it.
6. **Brand title at end:** static PNG of the logo (`deliverables/app-icon/rayhealth-icon-1024.png`) scaled and animated in for 3s.
7. **Captions (auto):** Resolve has built-in transcribed captions. Generate from the VO track. Match the script word-for-word — every legal claim is in the script for a reason.
8. **Export:** H.264, 1920×1080, 24fps, ~10 Mbps target. File → Deliver.

**Audio targets per channel:**

| Channel | Master LUFS | Notes |
|---|---|---|
| YouTube ad | -14 LUFS integrated | YouTube re-encodes; over-compressing is wasted effort |
| LinkedIn | -16 LUFS | LinkedIn favors quieter ads |
| Connected TV | -24 LUFS | ATSC broadcast spec |
| Audio-only (Spot 7) | -16 LUFS, true peak -1 dBTP | Spotify spec |

---

## 5. Final variants per channel

Each 30-second spot produces multiple deliverables:

| Variant | Resolution | Why |
|---|---|---|
| YouTube pre-roll | 1920×1080 (16:9) | Master |
| LinkedIn feed | 1920×1080 (16:9) | Captions burned-in, no music gap |
| Instagram Reels | 1080×1920 (9:16) | Vertical recut — Seedance can re-gen vertical, or crop in Resolve |
| TikTok | 1080×1920 (9:16) | Same as Reels |
| Connected TV | 1920×1080 (16:9) | Master, audio re-mixed to -24 LUFS |
| Audio-only | n/a, 44.1 kHz stereo MP3 | Spotify/podcast |
| 6-second bumper (Spot 6) | 1920×1080 + 1080×1920 | YouTube non-skippable + Reels |

Resolve handles all of this from the same master timeline — duplicate the timeline, swap aspect ratio, re-deliver.

---

## 6. Safety / security reminders

- `.env` should be `chmod 600` and in `.gitignore`. Check with `ls -la marketing/.env` — expect `-rw-------`.
- Never echo API keys to terminal or commit them — even temporarily.
- If you suspect a key was leaked: revoke at the provider dashboard, generate a new one, update `.env`.
- The whole `marketing/clips/` and `marketing/vo/` directories can be committed (they're large but not sensitive). Consider Git LFS if you're worried about repo bloat: `git lfs track "marketing/**/*.mp4"`.

---

## 7. Iterating

Treat the first pass as a draft. Common iteration cycles:

- **Voice doesn't fit the spot's tone** → swap `voice_id` in `VOICE_CONFIGS` (find IDs at https://elevenlabs.io/app/voice-library) and rerun `generate_vo.py --spot N`.
- **Clip doesn't match the shot intent** → edit the `prompt` in `shots.yaml`, delete the existing MP4, rerun `generate_clips.py --shot <id>`.
- **Want vertical versions** → change `resolution: 1920x1080` to `resolution: 1080x1920` in `shots.yaml` for the shots you want vertical, then rerun.

The whole pipeline is deterministic given the same inputs, so you can iterate one variable at a time without re-generating everything.
