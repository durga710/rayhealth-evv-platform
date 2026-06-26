/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapacitorApp } from '@capacitor/app';
import { emitRayHealthForegroundEvent } from './services/app-events';
import { installVisitQueueAutoFlush, flushVisitQueue } from './services/visit-offline-queue';

const LoginScreen = React.lazy(async () => await import('./screens/auth/LoginScreen'));
const AccessCodeScreen = React.lazy(async () => await import('./screens/auth/AccessCodeScreen'));
const AcceptInviteScreen = React.lazy(async () => await import('./screens/auth/AcceptInviteScreen'));
const ForgotPasswordScreen = React.lazy(async () => await import('./screens/auth/ForgotPasswordScreen'));
const ResetPasswordScreen = React.lazy(async () => await import('./screens/auth/ResetPasswordScreen'));
const SignupScreen = React.lazy(async () => await import('./screens/auth/SignupScreen'));
const DashboardScreen = React.lazy(async () => await import('./screens/visits/DashboardScreen'));
const VisitDetailScreen = React.lazy(async () => await import('./screens/visits/VisitDetailScreen'));
const CorrectionScreen = React.lazy(async () => await import('./screens/visits/CorrectionScreen'));
const CorrectionListScreen = React.lazy(async () => await import('./screens/visits/CorrectionListScreen'));
const ScheduleScreen = React.lazy(async () => await import('./screens/visits/ScheduleScreen'));
const ProfileScreen = React.lazy(async () => await import('./screens/visits/ProfileScreen'));
const NotificationScreen = React.lazy(async () => await import('./screens/visits/NotificationScreen'));
const RayAiScreen = React.lazy(async () => await import('./screens/ai/RayAiScreen'));
const LearningScreen = React.lazy(async () => await import('./screens/learning/LearningScreen'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
}

/**
 * Last-line-of-defense error boundary so a runtime error in any lazy
 * route doesn't tear down the entire React tree to a white screen
 * (which is what users saw when ProfileScreen errored on a previous
 * build). Renders a minimal recovery UI with "Reload" so the user is
 * never stuck on an empty screen.
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('RayHealth render error', error, info.componentStack);
  }
  handleReload = () => {
    this.setState({ error: null });
    window.location.href = '/';
  };
  render() {
    if (this.state.error) {
      return (
        <div className="mobile-container flex flex-col items-center justify-center px-8 text-center gap-6 bg-medical-50 min-h-screen">
          <div className="space-y-2">
            <h1 className="text-xl font-black text-medical-700 font-heading">Something went wrong</h1>
            <p className="text-sm text-medical-500 font-medium">
              We hit an unexpected error. Tapping reload will take you back to the dashboard.
            </p>
            <p className="text-[10px] text-medical-300 font-mono mt-4 break-all max-w-sm">
              {String(this.state.error?.message ?? this.state.error)}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="h-12 px-8 rounded-2xl bg-medical-600 text-white font-bold text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-transform"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  return (
    <div className="mobile-container font-sans">
      <ErrorBoundary>
      <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/auth/login" element={<LoginScreen />} />
          <Route path="/auth/signup" element={<SignupScreen />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordScreen />} />
          <Route path="/reset-password" element={<ResetPasswordScreen />} />
          <Route path="/onboarding/access-code" element={<AccessCodeScreen />} />
          <Route path="/onboarding/invite/:token" element={<AcceptInviteScreen />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardScreen />
            </ProtectedRoute>
          } />
          
          <Route path="/visits/:id" element={
            <ProtectedRoute>
              <VisitDetailScreen />
            </ProtectedRoute>
          } />
          
          <Route path="/visits/:id/correction" element={
            <ProtectedRoute>
              <CorrectionScreen />
            </ProtectedRoute>
          } />

          <Route path="/corrections" element={
            <ProtectedRoute>
              <CorrectionListScreen />
            </ProtectedRoute>
          } />

          <Route path="/ai" element={
            <ProtectedRoute>
              <RayAiScreen />
            </ProtectedRoute>
          } />

          <Route path="/schedule" element={
            <ProtectedRoute>
              <ScheduleScreen />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfileScreen />
            </ProtectedRoute>
          } />

          <Route path="/notifications" element={
            <ProtectedRoute>
              <NotificationScreen />
            </ProtectedRoute>
          } />

          <Route path="/learning" element={
            <ProtectedRoute>
              <LearningScreen />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </React.Suspense>
      </ErrorBoundary>
      <Toaster position="top-center" />
    </div>
  );
}

export default function App() {
  React.useEffect(() => {
    let removeAppStateListener: (() => Promise<void>) | undefined;

    // Drain any visit-actions queued offline as soon as the device
    // reports online + on every app-foreground event. Idempotent.
    installVisitQueueAutoFlush();
    void flushVisitQueue();

    const initNative = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: '#1248a0' });
          await SplashScreen.hide();
          const listener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
              emitRayHealthForegroundEvent();
              // Foreground is a great moment to retry queued punches —
              // the user just opened the app, network is presumably up.
              void flushVisitQueue();
            }
          });
          removeAppStateListener = async () => {
            await listener.remove();
          };
        } catch (err) {
          console.warn('Native UI initialization failed', err);
        }
      }
    };

    void initNative();

    return () => {
      void removeAppStateListener?.();
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
