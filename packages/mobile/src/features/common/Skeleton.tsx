// Lightweight shimmer skeletons for loading states. A Skeleton is a block
// whose opacity pulses via Reanimated; SkeletonCard/SkeletonList compose them
// into the app's list-card silhouette so screens can swap a spinner for a
// content-shaped placeholder with one line.

import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radii, shadow } from './tokens';

export function Skeleton({
  width,
  height,
  radius = radii.sm,
  color = colors.border,
  style,
}: {
  width: DimensionValue;
  height: DimensionValue;
  radius?: number;
  /** Override for skeletons on gradients (translucent whites). */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: color }, pulse, style]}
    />
  );
}

export function SkeletonCard({ lines = 2, avatar = true }: { lines?: number; avatar?: boolean }) {
  return (
    <View style={styles.card}>
      {avatar ? <Skeleton width={44} height={44} radius={22} /> : null}
      <View style={styles.lines}>
        <Skeleton width="60%" height={14} radius={7} />
        {Array.from({ length: Math.max(0, lines - 1) }, (_, i) => (
          <Skeleton key={i} width={i % 2 === 0 ? '40%' : '52%'} height={10} radius={5} />
        ))}
      </View>
    </View>
  );
}

export function SkeletonList({
  count = 4,
  ...cardProps
}: {
  count?: number;
  lines?: number;
  avatar?: boolean;
}) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} {...cardProps} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    ...shadow.card,
  },
  lines: { flex: 1, gap: 8 },
  list: { gap: 12 },
});
