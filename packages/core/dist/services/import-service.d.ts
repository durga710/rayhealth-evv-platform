/**
 * Bulk import / migration service.
 *
 * Onboarding a homecare agency off another platform (HHAeXchange, Sandata,
 * Tellus, a spreadsheet) means importing their clients, caregivers, and
 * authorizations. This module is the PURE half of that pipeline: an RFC-4180
 * CSV parser plus per-entity row validators that turn raw CSV text into typed,
 * normalized rows with per-row error reporting. No database access here — the
 * routes layer takes the validated rows and upserts them (idempotently, keyed
 * on `external_id`) inside a transaction.
 *
 * The design mirrors how enterprise importers work: a PREVIEW pass (validate +
 * report every row's status and errors, no writes) followed by a COMMIT pass
 * (upsert the rows that validated). Same parser + validators feed both.
 */
import { type PaServiceCode } from '../config/pennsylvania.js';
export type ImportEntity = 'clients' | 'caregivers' | 'authorizations';
export declare const IMPORT_ENTITIES: readonly ImportEntity[];
export interface ImportClientRow {
    externalId: string | null;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    medicaidNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    geofenceRadiusM?: number;
}
export interface ImportCaregiverRow {
    externalId: string | null;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    npi?: string;
    hireDate?: string;
    status: 'active' | 'inactive';
}
export interface ImportAuthorizationRow {
    externalId: string | null;
    clientExternalId: string;
    payerId: string;
    serviceCode: PaServiceCode;
    unitsAuthorized: number;
    startDate: string;
    endDate: string;
}
export type ImportRow = ImportClientRow | ImportCaregiverRow | ImportAuthorizationRow;
export interface RowResult<T extends ImportRow = ImportRow> {
    /** 1-based data-row number (the header is row 0 and excluded). */
    rowNumber: number;
    status: 'ok' | 'error';
    value?: T;
    errors: string[];
}
/** Header columns for each entity's downloadable CSV template. */
export declare const IMPORT_TEMPLATES: Record<ImportEntity, string[]>;
/**
 * Parse RFC-4180 CSV text into a header + array of records keyed by normalized
 * header name (lowercased, spaces/dashes → underscore). Handles quoted fields
 * with embedded commas, escaped quotes (""), and CRLF or LF line endings.
 * Blank lines are skipped. Throws on a structurally broken file (e.g. an
 * unterminated quote).
 */
export declare function parseCsv(text: string): {
    header: string[];
    records: Array<Record<string, string>>;
};
/**
 * Validate every parsed record for an entity. Returns one RowResult per data
 * row, in file order, with a 1-based rowNumber. Pure — no DB. Relational
 * existence checks (e.g. does client_external_id resolve?) happen at commit.
 */
export declare function validateImportRecords(entity: ImportEntity, records: Array<Record<string, string>>): RowResult[];
/** Convenience: parse CSV text and validate in one call. */
export declare function parseAndValidate(entity: ImportEntity, csv: string): {
    header: string[];
    results: RowResult[];
};
//# sourceMappingURL=import-service.d.ts.map