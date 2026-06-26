/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'caregiver' | 'admin' | 'supervisor';
  organizationId: string;
  photoURL?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: string;
  actionUrl?: string; // e.g. /visits/123
  aiContext?: string; // Context to pass to Ray AI
}

export interface EarningStats {
  daily: number;
  weekly: number;
  monthly: number;
  currency: string;
  completedVisits: number;
  totalHours: number;
  totalEarnings?: number;
}

export interface Organization {
  id: string;
  name: string;
  settings: {
    evvEnabled: boolean;
    requireSignature: boolean;
    requirePhoto: boolean;
  };
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface Visit {
  id: string;
  caregiverId: string;
  patientName: string;
  patientAddress: string;
  startTime?: string; // ISO string
  endTime?: string; // ISO string
  scheduledStartTime: string;
  scheduledEndTime: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled' | 'missed';
  location?: {
    latitude: number;
    longitude: number;
  };
  locationPoints?: LocationPoint[];
  documentation?: string;
  signature?: string; // Data URL or reference
}

export interface MissedPunchCorrection {
  id: string;
  visitId: string;
  caregiverId: string;
  originalStartTime?: string;
  originalEndTime?: string;
  correctedStartTime: string;
  correctedEndTime: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedBy?: string;
  reviewComment?: string;
}

export interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  token: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired';
}
