/**
 * RayHealth EVV → Sandata Alt EVV Integration — type definitions.
 *
 * Ported from the Sandata Open EVV / Alt EVV REST API reference (PA Alt EVV
 * Technical Specification v1.4). Field names below are CASE SENSITIVE and must
 * match Sandata's published specification EXACTLY — do not rename or recase.
 * Confirm required/optional flags and PA-specific code values against the
 * credentialed PA addendum before production.
 */
/** The three independent record types carried over one data pipe. */
export var SandataEntityType;
(function (SandataEntityType) {
    SandataEntityType["CLIENT"] = "CLIENT";
    SandataEntityType["EMPLOYEE"] = "EMPLOYEE";
    SandataEntityType["VISIT"] = "VISIT";
})(SandataEntityType || (SandataEntityType = {}));
/** Status of a record as tracked locally in RayHealth. */
export var SandataRecordStatus;
(function (SandataRecordStatus) {
    SandataRecordStatus["PENDING"] = "PENDING";
    SandataRecordStatus["RECEIVED"] = "RECEIVED";
    SandataRecordStatus["VERIFIED"] = "VERIFIED";
    SandataRecordStatus["EXCEPTION"] = "EXCEPTION";
    SandataRecordStatus["REJECTED"] = "REJECTED";
})(SandataRecordStatus || (SandataRecordStatus = {}));
/** Capture method for a clock-in / clock-out "call". */
export var SandataCallType;
(function (SandataCallType) {
    SandataCallType["MOBILE"] = "Mobile";
    SandataCallType["TELEPHONY"] = "Telephony";
    SandataCallType["FVV"] = "FVV";
    SandataCallType["MANUAL"] = "Manual";
    SandataCallType["OTHER"] = "Other";
})(SandataCallType || (SandataCallType = {}));
//# sourceMappingURL=types.js.map