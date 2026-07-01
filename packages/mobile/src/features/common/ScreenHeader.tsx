import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

/**
 * Standard gradient nav header for pushed sub-screens: a back button on the
 * left with the screen title centered on the same row (iOS-style), instead of
 * stacking the title on its own line below the back button. Optional children
 * render in the gradient below the title bar (e.g. a status banner).
 */
export default function ScreenHeader({ title, children }: { title: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <LinearGradient colors={['#0f2d52', '#1a5fa8']} style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <StatusBar style="light" />
      <View style={styles.bar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#cfe2f5" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 10, paddingBottom: 14 },
  bar: { height: 40, justifyContent: 'center' },
  backBtn: {
    position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 2,
    flexDirection: 'row', alignItems: 'center', gap: 1, paddingRight: 12,
  },
  backText: { color: '#cfe2f5', fontSize: 16, fontWeight: '700' },
  title: { textAlign: 'center', color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.2, paddingHorizontal: 76 },
});
