/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EarningStats, MissedPunchCorrection, Notification, User, Visit } from '../types';
import { mapRayHealthTask, mapRayHealthVisit } from './rayhealth-contract';
import { rayhealthApi } from './rayhealth-api';
import { getStoredSession } from './rayhealth-session';
import { readStoredJson, writeStoredJson } from './mobile-storage';
import { startVisitWithQueue, endVisitWithQueue } from './visit-offline-queue';

const CORRECTIONS_STORAGE_KEY = 'rayhealth.mobile.corrections';
const NOTIFICATIONS_STORAGE_KEY = 'rayhealth.mobile.notifications';

function currentUserId(): string | null {
  return getStoredSession()?.user.id ?? null;
}

function currentOrganizationId(): string | null {
  return getStoredSession()?.user.organizationId ?? null;
}

function deriveVisitHours(visit: Visit): number {
  const start = new Date(visit.endTime ?? visit.scheduledEndTime).getTime();
  const end = new Date(visit.startTime ?? visit.scheduledStartTime).getTime();
  const duration = Math.max(start - end, 0);
  return duration / (1000 * 60 * 60);
}

export const dataService = {
  getVisits: async (): Promise<Visit[]> => {
    const response = await rayhealthApi.getTodayVisits();
    return response.visits.map(mapRayHealthVisit);
  },

  getVisitById: async (id: string): Promise<Visit | undefined> => {
    try {
      const visit = await rayhealthApi.getVisitById(id);
      return mapRayHealthVisit(visit);
    } catch (error) {
      if (error instanceof Error && 'status' in error && (error as { status?: number }).status === 404) {
        return undefined;
      }
      throw error;
    }
  },

  getVisitTasks: async (id: string) => {
    const tasks = await rayhealthApi.getVisitTasks(id);
    return tasks.map(mapRayHealthTask);
  },

  startVisit: async (id: string, location: Record<string, unknown>, deviceInfo: Record<string, unknown>) => {
    const { queued } = await startVisitWithQueue(id, location, deviceInfo);
    if (queued) {
      // No server round-trip happened; just surface a queued sentinel so
      // VisitDetail can render "queued — will sync when online".
      return { queued: true } as unknown as Visit;
    }
    return await dataService.getVisitById(id);
  },

  endVisit: async (
    id: string,
    location: Record<string, unknown>,
    deviceInfo: Record<string, unknown>,
    notes?: string,
  ) => {
    const { queued } = await endVisitWithQueue(id, location, deviceInfo, notes);
    if (queued) {
      return { queued: true } as unknown as Visit;
    }
    return await dataService.getVisitById(id);
  },

  completeTask: async (id: string, notes?: string) => {
    return await rayhealthApi.completeTask(id, { notes, completedValue: true });
  },

  updateVisit: async (visit: Visit) => {
    return visit;
  },

  getCorrections: async (): Promise<MissedPunchCorrection[]> => {
    const userId = currentUserId();
    if (!userId) {
      return [];
    }

    return (await readStoredJson<MissedPunchCorrection[]>(CORRECTIONS_STORAGE_KEY, [])).filter(
      (correction) => correction.caregiverId === userId,
    );
  },

  getEarnings: async (): Promise<EarningStats | null> => {
    const visits = await dataService.getVisits();
    const completedVisits = visits.filter((visit) => visit.status === 'completed');
    const totalHours = Number(
      completedVisits.reduce((sum, visit) => sum + deriveVisitHours(visit), 0).toFixed(2),
    );

    return {
      daily: 0,
      weekly: 0,
      monthly: 0,
      currency: 'USD',
      completedVisits: completedVisits.length,
      totalHours,
      totalEarnings: 0,
    };
  },

  addCorrection: async (correction: Omit<MissedPunchCorrection, 'id' | 'createdAt' | 'status'>) => {
    const newCorrection: MissedPunchCorrection = {
      ...correction,
      id: `corr-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    const corrections = await readStoredJson<MissedPunchCorrection[]>(CORRECTIONS_STORAGE_KEY, []);
    corrections.unshift(newCorrection);
    await writeStoredJson(CORRECTIONS_STORAGE_KEY, corrections);
    return newCorrection;
  },

  updateUserProfile: async (_userId: string, data: Partial<User>) => {
    // Profile updates are handled through AuthContext + users/profile so local callers can no-op here.
    return data;
  },

  getNotifications: async (): Promise<Notification[]> => {
    const userId = currentUserId();
    if (!userId) {
      return [];
    }

    return (await readStoredJson<Notification[]>(NOTIFICATIONS_STORAGE_KEY, []))
      .filter((notification) => notification.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  },

  markNotificationRead: async (notificationId: string) => {
    const notifications = (await readStoredJson<Notification[]>(NOTIFICATIONS_STORAGE_KEY, [])).map((notification) =>
      notification.id === notificationId ? { ...notification, read: true } : notification,
    );
    await writeStoredJson(NOTIFICATIONS_STORAGE_KEY, notifications);
  },

  syncWithParent: async () => {
    const userId = currentUserId();
    const organizationId = currentOrganizationId();
    if (!userId || !organizationId) {
      throw new Error('Authentication required for sync');
    }

    const syncStatus = await rayhealthApi.getSyncStatus();
    await rayhealthApi.pullSync({
      lastPulledAt: Math.max(syncStatus.lastSyncAt - 60_000, 0),
      entities: ['VISIT', 'TASK', 'CLIENT', 'CAREGIVER'],
      organizationId,
      caregiverId: userId,
      limit: 50,
    });

    const notifications = await readStoredJson<Notification[]>(NOTIFICATIONS_STORAGE_KEY, []);
    notifications.unshift({
      id: `sync-${Date.now()}`,
      userId,
      title: 'Mobile sync completed',
      message: 'RayHealth refreshed your caregiver schedule from the agency platform.',
      type: 'success',
      read: false,
      createdAt: new Date().toISOString(),
    });
    await writeStoredJson(NOTIFICATIONS_STORAGE_KEY, notifications.slice(0, 50));

    return {
      success: true,
      lastSync: new Date(syncStatus.lastSyncAt).toISOString(),
    };
  },
};
