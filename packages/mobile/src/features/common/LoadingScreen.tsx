import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from './tokens';

// Branded full-screen loading state shown while the session hydrates, so a slow
// or hanging network shows a spinner instead of a blank white screen.
export default function LoadingScreen() {
  return (
    <LinearGradient colors={gradients.header} style={styles.root}>
      <StatusBar style="light" />
      <ActivityIndicator size="large" color={colors.onGradient} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
