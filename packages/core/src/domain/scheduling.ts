import { z } from 'zod';

export const assignmentInputSchema = z.object({
  caregiverId: z.string().min(1),
  visitTemplateId: z.string().min(1),
  credentialStatus: z.enum(['active', 'expired', 'pending']).refine((value) => value === 'active', {
    message: 'Caregiver must be eligible for assignment'
  })
});

export type AssignmentInput = z.infer<typeof assignmentInputSchema>;
