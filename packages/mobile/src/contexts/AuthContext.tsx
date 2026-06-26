/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../types';
import { mapRolesToMobileRole, type RayHealthInviteDetails } from '../services/rayhealth-contract';
import { rayhealthApi } from '../services/rayhealth-api';
import { clearSession, loadStoredSession } from '../services/rayhealth-session';

interface AcceptInviteUserData {
  firstName: string;
  lastName: string;
  password: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>;
  validateInvite: (token: string) => Promise<RayHealthInviteDetails | null>;
  acceptInvite: (token: string, userData: AcceptInviteUserData) => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      const session = await loadStoredSession();
      if (!session) {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      const cachedUser = session.user.photoURL ? session.user : { ...session.user, photoURL: session.photoURL };
      if (isMounted) {
        setUser(cachedUser);
      }

      try {
        const profile = await rayhealthApi.getProfile();
        const nextUser: User = {
          ...cachedUser,
          id: profile.id,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          organizationId: profile.organizationId,
          role: mapRolesToMobileRole(profile.roles),
        };

        rayhealthApi.updateSessionProfile({
          firstName: nextUser.firstName,
          lastName: nextUser.lastName,
          email: nextUser.email,
          photoURL: nextUser.photoURL,
        });

        if (isMounted) {
          setUser(nextUser);
        }
      } catch (error) {
        console.error('RayHealth session bootstrap failed', error);
        clearSession();
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      // SECURITY: a hardcoded admin backdoor (durga@rayhealthevv.com / blackops22)
      // lived here in earlier development iterations and was removed on
      // 2026-05-08 prior to App Store submission. Authentication MUST go
      // through `/auth/mobile/login` so the bearer JWT is server-issued and
      // every login is recorded in audit_events. Do not reintroduce.
      const result = await rayhealthApi.login(email, pass);
      const session = rayhealthApi.persistLogin(result);
      setUser(session.user);
      try {
        await rayhealthApi.registerDevice();
      } catch (error) {
        console.warn('Device registration failed', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await rayhealthApi.logout();
    } finally {
      setUser(null);
    }
  };

  const sendPasswordReset = async (email: string) => {
    await rayhealthApi.requestPasswordReset(email);
  };

  const confirmPasswordReset = async (token: string, newPassword: string) => {
    await rayhealthApi.confirmPasswordReset(token, newPassword);
  };

  const validateInvite = async (token: string) => {
    try {
      return await rayhealthApi.getInvitationDetails(token);
    } catch (error: unknown) {
      if (error instanceof Error && 'status' in error && (error as { status?: number }).status === 404) {
        return null;
      }
      throw error;
    }
  };

  const acceptInvite = async (token: string, userData: AcceptInviteUserData) => {
    const invite = await validateInvite(token);
    if (!invite || !invite.isValid) {
      throw new Error(invite?.status === 'EXPIRED' ? 'Invitation expired' : 'Invitation is not valid');
    }

    await rayhealthApi.acceptInvitation({
      token: invite.token,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: userData.password,
      ...(userData.phone ? { phone: userData.phone } : {}),
    });

    await login(invite.email, userData.password);
  };

  const updateUser = async (data: Partial<User>) => {
    const currentUser = user;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    const wantsServerUpdate = data.firstName !== undefined || data.lastName !== undefined || data.email !== undefined;

    if (wantsServerUpdate) {
      const updatedProfile = await rayhealthApi.updateProfile({
        firstName: data.firstName ?? currentUser.firstName,
        lastName: data.lastName ?? currentUser.lastName,
        email: data.email ?? currentUser.email,
      });

      const nextUser: User = {
        ...currentUser,
        ...data,
        id: updatedProfile.id,
        email: updatedProfile.email,
        firstName: updatedProfile.firstName,
        lastName: updatedProfile.lastName,
        organizationId: updatedProfile.organizationId,
      };

      rayhealthApi.updateSessionProfile({
        firstName: nextUser.firstName,
        lastName: nextUser.lastName,
        email: nextUser.email,
        photoURL: nextUser.photoURL,
      });
      setUser(nextUser);
      return;
    }

    const nextUser = { ...currentUser, ...data };
    rayhealthApi.updateSessionProfile({
      firstName: nextUser.firstName,
      lastName: nextUser.lastName,
      email: nextUser.email,
      photoURL: nextUser.photoURL,
    });
    setUser(nextUser);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await rayhealthApi.changePassword(currentPassword, newPassword);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        sendPasswordReset,
        confirmPasswordReset,
        validateInvite,
        acceptInvite,
        updateUser,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
