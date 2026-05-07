import { z } from 'zod';

export const caregiverCredentialSchema = z.object({
  caregiverId: z.string().uuid().or(z.string().min(1)),
  credentialType: z.enum(['tb-screening', 'background-check', 'license', 'training']),
  status: z.enum(['active', 'expired', 'pending']),
  expiresAt: z.string().date()
});

export type CaregiverCredential = z.infer<typeof caregiverCredentialSchema>;
