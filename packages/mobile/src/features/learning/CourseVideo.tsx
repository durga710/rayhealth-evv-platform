import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { toEmbedUrl } from '../../lib/video-embed';
import { colors, radii, shadow, typography } from '../common/tokens';

/**
 * Inline training video for the course player: a tap-to-play poster that swaps
 * to a WebView on the privacy-enhanced YouTube embed (autoplay once tapped).
 * Nothing loads until the caregiver explicitly taps play.
 *
 * The embed is wrapped in a minimal HTML page loaded with a baseUrl so the
 * iframe request carries a real referring origin — loading the embed URL
 * directly has no referer and YouTube rejects it with "Error 153: video
 * player configuration error".
 */
function embedHtml(videoUrl: string): string {
  const src = toEmbedUrl(videoUrl);
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;padding:0;height:100%;background:#0f2d52;overflow:hidden}
iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}</style>
</head><body>
<iframe src="${src}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
</body></html>`;
}

export default function CourseVideo({ videoUrl }: { videoUrl: string }) {
  const [started, setStarted] = useState(false);

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
        source={{ html: embedHtml(videoUrl), baseUrl: 'https://rayhealthevv.com' }}
        originWhitelist={['*']}
        style={styles.webview}
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
