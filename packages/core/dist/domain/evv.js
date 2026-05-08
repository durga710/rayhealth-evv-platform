import { z } from 'zod';
export const evvVisitSchema = z.object({
    id: z.string().uuid().optional(),
    assignmentId: z.string().uuid(),
    caregiverId: z.string().uuid(),
    clockInTime: z.string().datetime(),
    clockOutTime: z.string().datetime().optional(),
    clockInLocation: z.object({
        lat: z.number(),
        lng: z.number(),
        accuracy: z.number()
    }),
    clockOutLocation: z.object({
        lat: z.number(),
        lng: z.number(),
        accuracy: z.number()
    }).optional(),
    status: z.enum(['pending', 'verified', 'flagged']).default('pending')
});
//# sourceMappingURL=evv.js.map