import { z } from 'zod';
export declare const visitTaskCompletionStatusSchema: z.ZodEnum<{
    performed: "performed";
    refused: "refused";
    not_performed: "not_performed";
}>;
export declare const visitTaskCompletionInputSchema: z.ZodObject<{
    clientEventId: z.ZodString;
    taskCode: z.ZodOptional<z.ZodString>;
    taskLabel: z.ZodString;
    status: z.ZodEnum<{
        performed: "performed";
        refused: "refused";
        not_performed: "not_performed";
    }>;
}, z.core.$strip>;
export declare const visitTaskCompletionBatchSchema: z.ZodObject<{
    completions: z.ZodArray<z.ZodObject<{
        clientEventId: z.ZodString;
        taskCode: z.ZodOptional<z.ZodString>;
        taskLabel: z.ZodString;
        status: z.ZodEnum<{
            performed: "performed";
            refused: "refused";
            not_performed: "not_performed";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const visitTaskCompletionSchema: z.ZodObject<{
    clientEventId: z.ZodString;
    taskCode: z.ZodOptional<z.ZodString>;
    taskLabel: z.ZodString;
    status: z.ZodEnum<{
        performed: "performed";
        refused: "refused";
        not_performed: "not_performed";
    }>;
    id: z.ZodString;
    visitId: z.ZodString;
    caregiverId: z.ZodString;
    recordedAt: z.ZodString;
}, z.core.$strip>;
export type VisitTaskCompletionStatus = z.infer<typeof visitTaskCompletionStatusSchema>;
export type VisitTaskCompletionInput = z.infer<typeof visitTaskCompletionInputSchema>;
export type VisitTaskCompletion = z.infer<typeof visitTaskCompletionSchema>;
export interface VisitTaskPlanItem {
    taskCode?: string;
    taskLabel: string;
}
//# sourceMappingURL=visit-task-completion.d.ts.map