# RayHealthEVV Launch Ad Exports

This folder generates downloadable review-cut videos for the RayHealthEVV launch campaign.

The visual identity is based on `/Users/durgaghimeray/Downloads/RayHealthEVV_Brand_Kit.html`.

Run:

```bash
npm install
npm run render
```

Outputs:

- `renders/*.mp4` - individual video cuts
- `audio/07-audio-cutdown.mp3` - audio-only cutdown
- `posters/*.jpg` - poster frames
- `RayHealthEVV-launch-ads-download.zip` - download bundle

Notes:

- These are generated motion-graphic review cuts with local synthetic narration.
- Current narration uses Kokoro `hm_psi` with US-English phonemization for a middle-aged Indian male read in American business English.
- Replace the synthetic voice and illustrated scenes with final talent/b-roll before paid media.
- The canonical URL used across all end frames is `rayhealthevv.com`.
