import { z } from 'zod';
export declare const authorizationSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    clientId: z.ZodUnion<[z.ZodString, z.ZodString]>;
    payerId: z.ZodUnion<[z.ZodString, z.ZodString]>;
    unitsAuthorized: z.ZodNumber;
    serviceCode: z.ZodEnum<{
        T1019: "T1019";
        S5125: "S5125";
        T1004: "T1004";
        T1021: "T1021";
    }>;
    startDate: z.ZodString;
    endDate: z.ZodString;
}, z.core.$strip>;
export type Authorization = z.infer<typeof authorizationSchema>;
export declare const clientSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    firstName: z.ZodString;
    lastName: z.ZodString;
    dateOfBirth: z.ZodString;
    medicaidNumber: z.ZodOptional<z.ZodString>;
    addressLine1: z.ZodOptional<z.ZodString>;
    addressLine2: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
    geofenceRadiusM: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type Client = z.infer<typeof clientSchema>;
//# sourceMappingURL=client.d.ts.map