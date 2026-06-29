import { z } from 'zod';
/**
 * Billing / claims domain.
 *
 * A {@link Claim} aggregates one client's GPS-verified visits over a service
 * period into a payer claim. Each {@link ClaimLine} corresponds to exactly one
 * verified EVV visit (one date of service), so every billed line is traceable
 * back to an immutable `evv_visits` row — the core integrity property of the
 * product: a claim line should only exist behind a verified visit.
 *
 * Money is stored in integer cents to avoid float drift. Charge amounts are
 * OPTIONAL (default 0 / "unpriced"): RayHealth is the verification + claim
 * assembly layer, and the payer fee schedule determines the paid amount, so we
 * never invent dollar rates. Units (HCPCS units of measure) are always
 * computed and validated.
 */
/** Claim lifecycle. Mirrors the real X12 837 → 277CA → 835 round-trip. */
export declare const claimStatuses: readonly ["draft", "ready", "submitted", "accepted", "rejected", "denied", "paid", "void"];
export type ClaimStatus = (typeof claimStatuses)[number];
/** Terminal statuses a claim can never transition out of. */
export declare const terminalClaimStatuses: readonly ClaimStatus[];
/** Denial-risk band assigned by pre-submission scoring. */
export declare const denialRiskLevels: readonly ["low", "medium", "high"];
export type DenialRiskLevel = (typeof denialRiskLevels)[number];
export declare const claimLineSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    claimId: z.ZodOptional<z.ZodString>;
    visitId: z.ZodString;
    serviceCode: z.ZodEnum<{
        T1019: "T1019";
        S5125: "S5125";
        T1004: "T1004";
        T1021: "T1021";
    }>;
    serviceDate: z.ZodString;
    units: z.ZodNumber;
    minutes: z.ZodNumber;
    chargeCents: z.ZodDefault<z.ZodNumber>;
    denialRisk: z.ZodDefault<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>>;
    denialReasons: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type ClaimLine = z.infer<typeof claimLineSchema>;
export declare const claimSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    agencyId: z.ZodString;
    clientId: z.ZodString;
    payerId: z.ZodString;
    periodStart: z.ZodString;
    periodEnd: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<{
        void: "void";
        accepted: "accepted";
        submitted: "submitted";
        rejected: "rejected";
        denied: "denied";
        draft: "draft";
        ready: "ready";
        paid: "paid";
    }>>;
    totalUnits: z.ZodDefault<z.ZodNumber>;
    totalChargeCents: z.ZodDefault<z.ZodNumber>;
    denialRisk: z.ZodDefault<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>>;
    controlNumber: z.ZodOptional<z.ZodString>;
    payerClaimId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    statusReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    submittedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
    lines: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        claimId: z.ZodOptional<z.ZodString>;
        visitId: z.ZodString;
        serviceCode: z.ZodEnum<{
            T1019: "T1019";
            S5125: "S5125";
            T1004: "T1004";
            T1021: "T1021";
        }>;
        serviceDate: z.ZodString;
        units: z.ZodNumber;
        minutes: z.ZodNumber;
        chargeCents: z.ZodDefault<z.ZodNumber>;
        denialRisk: z.ZodDefault<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>>;
        denialReasons: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type Claim = z.infer<typeof claimSchema>;
/** Allowed manual status transitions (admin-driven, post-generation). */
export declare const allowedClaimTransitions: Record<ClaimStatus, readonly ClaimStatus[]>;
export declare function canTransitionClaim(from: ClaimStatus, to: ClaimStatus): boolean;
//# sourceMappingURL=billing.d.ts.map