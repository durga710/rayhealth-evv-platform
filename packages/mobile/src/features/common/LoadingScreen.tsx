import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

// Branded full-screen loading state shown while the session hydrates, so a slow
// or hanging network shows a spinner instead of a blank white screen.
export default function LoadingScreen() {
  return (
    <LinearGradient colors={['#0f2d52', '#1a5fa8']} style={styles.root}>
      <StatusBar style="light" />
      <ActivityIndicator size="large" color="#ffffff" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
