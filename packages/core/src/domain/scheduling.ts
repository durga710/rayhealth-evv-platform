import { z } from 'zod';
import { paAssignmentStatuses } from '../config/pennsylvania.js';
import { TIME_RE } from './recurring-schedule.js';

export const assignmentStatusSchema = z.enum(paAssignmentStatuses);
export type AssignmentStatus = z.infer<typeof assignmentStatusSchema>;

export const assignmentInputSchema = z
  .object({
    caregiverId: z.string().min(1),
    visitTemplateId: z.string().min(1),
    credentialStatus: z.literal('active', {
      message: 'Caregiver must be eligible for assignment'
    }),
    visitDate: z.string().optional(),
    // Optional time-of-day window. When present the assignment participates in
    // true overlap detection (schedule-conflict-service); without it the
    // booking stays day-granular and only the duplicate rule applies.
    startTime: z.string().regex(TIME_RE, 'startTime must be HH:MM').optional(),
    endTime: z.string().regex(TIME_RE, 'endTime must be HH:MM').optional()
  })
  .refine((v) => (v.startTime === undefined) === (v.endTime === undefined), {
    message: 'startTime and endTime must be provided together',
    path: ['endTime']
  })
  .refine((v) => !v.startTime || !v.endTime || v.endTime > v.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime']
  })
  .refine((v) => !v.startTime || !!v.visitDate, {
    message: 'a visit date is required when times are set',
    path: ['startTime']
  });

export type AssignmentInput = z.infer<typeof assignmentInputSchema>;
