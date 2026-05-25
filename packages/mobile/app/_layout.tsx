import { Stack } from 'expo-router';
import { AuthProvider } from '../src/lib/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="visit-detail" options={{ title: 'Visit Detail' }} />
        <Stack.Screen name="correction" options={{ title: 'Request Correction' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      </Stack>
    </AuthProvider>
  );
}
