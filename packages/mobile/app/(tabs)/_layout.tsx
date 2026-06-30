import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { useAuth } from '../../src/lib/AuthContext';

// The dashboard is the single home screen; clock-in is reached by tapping a
// visit (or a shift-alert notification), so it pushes over the dashboard as a
// stack screen rather than living in a bottom tab bar. initialRouteName keeps
// the dashboard anchored underneath, so a cold deep-link straight to /clockin
// still has somewhere to go "back" to.
export const unstable_settings = {
  initialRouteName: 'dashboard',
};

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  // Wait for the session to finish hydrating before mounting ANY protected
  // screen. Otherwise a child (e.g. the dashboard) mounts and fires its
  // authenticated request before the bearer token is attached on reload — that
  // request 401s, trips the "session was ended" handler, and bounces the user
  // back to login even though the stored token is perfectly valid.
  if (isLoading) {
    return null;
  }

  // Auth gate for the whole app area. If the session is lost at any point
  // (token rejected, logout, expiry mid-use), bounce straight to login rather
  // than leaving the user on a protected screen they can't load data into.
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="clockin" />
    </Stack>
  );
}
