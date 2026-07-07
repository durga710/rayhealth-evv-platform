import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { extractYouTubeId, toEmbedUrl } from '../../lib/video-embed';
import { parseVideoMessage, type VideoBridgeEvent } from '../../lib/video-progress';
import { colors, radii, shadow, typography } from '../common/tokens';

/**
 * Branded training-video player. YouTube supplies the stream (their terms
 * require using their embedded player for YouTube content), but all of their
 * controls are hidden (controls=0) and replaced with our own overlay: a brand
 * play/pause control and a read-only progress bar, so there is no seek bar to
 * jump ahead with. The page is loaded with a baseUrl so the player request
 * carries a real referring origin (YouTube rejects referer-less embeds with
 * Error 153).
 *
 * The page script measures which seconds were actually watched (a set of
 * whole seconds, so skipped-over content earns no credit), detects seek
 * jumps, and reports progress over the WebView bridge. The screen uses that
 * to gate Next and to ask for a rewatch after skipping.
 *
 * Non-YouTube URLs fall back to a plain embed with no tracking; the page
 * posts an error event so the caregiver is never blocked.
 */

interface Props {
  videoUrl: string;
  onEvent: (event: VideoBridgeEvent) => void;
}

function playerHtml(videoId: string): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html,body{margin:0;padding:0;height:100%;background:#0f2d52;overflow:hidden;font-family:-apple-system,Roboto,sans-serif}
  #player{position:absolute;top:0;left:0;width:100%;height:100%}
  /* Transparent shield: all taps go to our controls, not YouTube's UI. */
  #shield{position:absolute;top:0;left:0;width:100%;height:100%;z-index:5}
  #big{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:6;
       width:64px;height:64px;border-radius:32px;background:rgba(26,95,168,.92);border:0;
       color:#fff;font-size:26px;display:flex;align-items:center;justify-content:center;
       transition:opacity .25s}
  #big.faded{opacity:0;pointer-events:none}
  #barwrap{position:absolute;left:0;right:0;bottom:0;height:14px;z-index:6;background:rgba(15,45,82,.55)}
  #fill{height:100%;width:0%;background:#2d7dd2}
  #time{position:absolute;right:8px;bottom:18px;z-index:6;color:#fff;font-size:11px;
        background:rgba(15,45,82,.7);padding:2px 8px;border-radius:8px}
</style>
</head><body>
<div id="player"></div>
<div id="shield"></div>
<button id="big" aria-label="Play">&#9654;</button>
<div id="barwrap"><div id="fill"></div></div>
<div id="time"></div>
<script>
  var post = function (m) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m));
  };
  var player = null, ready = false, watched = {}, watchedCount = 0, prevT = null,
      skipped = false, ended = false, playing = false;
  var big = document.getElementById('big');
  var fill = document.getElementById('fill');
  var timeEl = document.getElementById('time');

  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.onerror = function () { post({ type: 'error' }); };
  document.head.appendChild(tag);

  // Never trap: if the API cannot initialize, unlock the step.
  setTimeout(function () { if (!ready) post({ type: 'error' }); }, 15000);

  function fmt(s) {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function report() {
    if (!ready) return;
    var d = player.getDuration() || 0;
    var pct = d > 0 ? watchedCount / Math.floor(d) : 0;
    post({ type: 'progress', watchedPct: pct, skipped: skipped, ended: ended });
  }

  function tick() {
    if (!ready || !playing) return;
    var t = player.getCurrentTime() || 0;
    if (prevT !== null) {
      var delta = t - prevT;
      if (delta > 3) {
        skipped = true; // jumped ahead: no credit for the gap
      } else if (delta > 0) {
        for (var s = Math.floor(prevT); s <= Math.floor(t); s++) {
          if (!watched[s]) { watched[s] = true; watchedCount++; }
        }
      }
    }
    prevT = t;
    var d = player.getDuration() || 0;
    if (d > 0) {
      fill.style.width = Math.min(100, (t / d) * 100) + '%';
      timeEl.textContent = fmt(t) + ' / ' + fmt(d);
    }
    report();
  }
  setInterval(tick, 500);

  function toggle() {
    if (!ready) return;
    if (playing) { player.pauseVideo(); } else { player.playVideo(); }
  }
  document.getElementById('shield').addEventListener('click', toggle);
  big.addEventListener('click', toggle);

  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('player', {
      host: 'https://www.youtube-nocookie.com',
      videoId: '${videoId}',
      playerVars: { controls: 0, rel: 0, playsinline: 1, disablekb: 1, fs: 0, iv_load_policy: 3 },
      events: {
        onReady: function () { ready = true; player.playVideo(); },
        onError: function () { post({ type: 'error' }); },
        onStateChange: function (e) {
          playing = e.data === 1;
          if (e.data === 0) { ended = true; playing = false; prevT = null; report(); }
          if (e.data === 1) { big.classList.add('faded'); big.innerHTML = '&#10073;&#10073;'; }
          else { big.classList.remove('faded'); big.innerHTML = e.data === 0 ? '&#8635;' : '&#9654;'; }
        },
      },
    });
  };
</script>
</body></html>`;
}

/** Plain fallback for non-YouTube URLs: no tracking, step stays unlocked. */
function fallbackHtml(videoUrl: string): string {
  const src = toEmbedUrl(videoUrl);
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;padding:0;height:100%;background:#0f2d52;overflow:hidden}
iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}</style>
</head><body>
<iframe src="${src}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
<script>if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error' }));</script>
</body></html>`;
}

export default function CourseVideo({ videoUrl, onEvent }: Props) {
  const [started, setStarted] = useState(false);
  const videoId = useMemo(() => extractYouTubeId(videoUrl), [videoUrl]);
  const html = useMemo(
    () => (videoId ? playerHtml(videoId) : fallbackHtml(videoUrl)),
    [videoId, videoUrl],
  );

  if (!started) {
    return (
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          setStarted(true);
        }}
        style={({ pressed }) => [styles.frame, styles.poster, pressed && { opacity: 0.92 }]}
        accessibilityRole="button"
        accessibilityLabel="Play training video"
      >
        <View style={styles.playCircle}>
          <Ionicons name="play" size={30} color={colors.onGradient} style={{ marginLeft: 3 }} />
        </View>
        <Text style={styles.posterText}>Tap to play the training video</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.frame}>
      <WebView
        source={{ html, baseUrl: 'https://rayhealthevv.com' }}
        originWhitelist={['*']}
        style={styles.webview}
        onMessage={(e) => {
          const event = parseVideoMessage(e.nativeEvent.data);
          if (event) onEvent(event);
        }}
        onError={() => onEvent({ kind: 'error' })}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.onGradient} size="large" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 16 / 9,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.navy,
    ...shadow.card,
  },
  poster: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  playCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.brandBlue,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.raised,
  },
  posterText: { ...typography.body, color: colors.onGradientSoft },
  webview: { flex: 1, backgroundColor: colors.navy },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.navy,
  },
});
