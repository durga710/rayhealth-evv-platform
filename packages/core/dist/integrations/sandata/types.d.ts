/**
 * RayHealth EVV → Sandata Alt EVV Integration — type definitions.
 *
 * Ported from the Sandata Open EVV / Alt EVV REST API reference (PA Alt EVV
 * Technical Specification v1.4). Field names below are CASE SENSITIVE and must
 * match Sandata's published specification EXACTLY — do not rename or recase.
 * Confirm required/optional flags and PA-specific code values against the
 * credentialed PA addendum before production.
 */
/** Sandata supports only string | number | boolean on the wire. */
export type SandataScalar = string | number | boolean;
/** The three independent record types carried over one data pipe. */
export declare enum SandataEntityType {
    CLIENT = "CLIENT",
    EMPLOYEE = "EMPLOYEE",
    VISIT = "VISIT"
}
/** Status of a record as tracked locally in RayHealth. */
export declare enum SandataRecordStatus {
    PENDING = "PENDING",// not yet transmitted
    RECEIVED = "RECEIVED",// POSTed, UUID returned, awaiting /status
    VERIFIED = "VERIFIED",// accepted by Sandata, no blocking exceptions
    EXCEPTION = "EXCEPTION",// accepted but has unresolved exceptions
    REJECTED = "REJECTED"
}
/** Capture method for a clock-in / clock-out "call". */
export declare enum SandataCallType {
    MOBILE = "Mobile",
    TELEPHONY = "Telephony",
    FVV = "FVV",// Fixed Verification Device
    MANUAL = "Manual",
    OTHER = "Other"
}
export interface SandataClient {
    /** Sandata-assigned payer ID (from implementation). */
    PayerID?: string;
    PayerProgram?: string;
    /** RayHealth internal client ID — reused as the link key on visits. */
    ClientCustomID: string;
    /** Member / Medicaid identifier. */
    ClientMedicaidID?: string;
    ClientOtherID?: string;
    ClientQualifier?: string;
    ClientFirstName: string;
    ClientMiddleInitial?: string;
    ClientLastName: string;
    ClientTimezone?: string;
    ClientStatus?: string;
    ClientAddress?: SandataClientAddress[];
    /** Per-record sequence number (see state repository). */
    SequenceID: number;
}
export interface SandataClientAddress {
    ClientAddressType?: 'Home' | 'Business' | 'Other';
    ClientAddressLine1: string;
    ClientAddressLine2?: string;
    ClientCity: string;
    ClientState: string;
    ClientZip: string;
    /** REQUIRED if program uses GPS validation. RayHealth must geocode. */
    ClientLatitude?: number;
    ClientLongitude?: number;
}
export interface SandataEmployee {
    /** RayHealth internal caregiver ID — reused as the link key on visits. */
    EmployeeCustomID: string;
    /** Identifier or Medicaid ID for the caregiver. */
    EmployeeQualifier?: string;
    EmployeeOtherID?: string;
    EmployeeLastName: string;
    EmployeeFirstName: string;
    EmployeeEmail?: string;
    EmployeeDateOfHire?: string;
    SequenceID: number;
}
export interface SandataVisit {
    /** RayHealth unique visit key (sequence-tracked). */
    VisitOtherID: string;
    /** MUST reference an already-accepted Client. */
    ClientCustomID: string;
    /** MUST reference an already-accepted Employee. */
    EmployeeCustomID: string;
    /** CMS #1 — type of service. */
    ProcedureCode: string;
    Modifier1?: string;
    Modifier2?: string;
    Modifier3?: string;
    Modifier4?: string;
    VisitTimeZone?: string;
    /** CMS #6 — adjusted in/out if manual, else actual. UTC. */
    AdjInDateTime?: string;
    AdjOutDateTime?: string;
    BillVisit?: boolean;
    BilledHours?: number;
    VisitMemo?: string;
    /** Clock in/out events. CMS #4 location lives here. */
    Calls?: SandataCall[];
    /** Care-plan tasks performed (conditional, per PA service-task appendix). */
    Tasks?: SandataTask[];
    /** Acknowledgements for resolvable exceptions. */
    Exceptions?: SandataExceptionAck[];
    /** Conditional — present when visit was manually entered/adjusted. */
    VisitChanges?: SandataVisitChange[];
    SequenceID: number;
}
export interface SandataCall {
    CallExternalID: string;
    /** CMS #6 — event timestamp. UTC. */
    CallDateTime: string;
    CallAssignment?: 'Time In' | 'Time Out';
    CallType: SandataCallType;
    /** CMS #4 — location. Required for Mobile calls. */
    CallLatitude?: number;
    CallLongitude?: number;
    /** Required if CallType = Telephony. */
    TelephonyPIN?: number;
    OriginatingPhoneNumber?: string;
    GroupVisit?: boolean;
}
export interface SandataTask {
    /** Task ID from the PA service-task appendix. */
    TaskID: string;
    TaskReading?: string;
    TaskRefused?: boolean;
}
export interface SandataExceptionAck {
    ExceptionID: string;
    AcknowledgedBy?: string;
    AcknowledgedDateTime?: string;
}
export interface SandataVisitChange {
    ChangeMadeBy?: string;
    ChangeDateTime?: string;
    /** Reason code per PA addendum. */
    ReasonCode: string;
    ResolutionCode?: string;
    ChangeReasonMemo?: string;
}
/** A batch of 1–5,000 records of a single entity type. */
export type SandataBatch<T> = T[];
/** Immediate response to a POST — NOT a validation result. */
export interface SandataPostResponse {
    uuid: string;
    status: string;
    message?: string;
}
/** Response from GET /{entity}/status/{uuid}. */
export interface SandataStatusResponse {
    uuid: string;
    /** Overall transmission status. */
    status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | string;
    /** Per-record outcomes. */
    records?: SandataRecordResult[];
    message?: string;
}
export interface SandataRecordResult {
    /** Echoes the record's custom ID (ClientCustomID / EmployeeCustomID / VisitOtherID). */
    externalID: string;
    status: 'ACCEPTED' | 'REJECTED' | 'EXCEPTION' | string;
    /** Reason / error codes when rejected or flagged. */
    reasonCodes?: string[];
    description?: string;
}
export interface SandataAltEvvConfig {
    baseUrl: string;
    username: string;
    password: string;
    /** Provided by Sandata for multi-agency (MCO/vendor) transmissions. */
    entityGuid?: string;
    /** Max records per POST per Sandata spec. */
    maxBatchSize: number;
    /** Delay before first status poll (Sandata recommends ~5 min). */
    statusPollDelayMs: number;
    /** 'UAT' | 'PROD' — recorded on each transmission row. */
    environment: 'UAT' | 'PROD';
}
//# sourceMappingURL=types.d.ts.map