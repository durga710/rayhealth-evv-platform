/**
 * Sandbox clearinghouse transport: a deterministic simulator with no network
 * and no persistent state of its own.
 *
 * submit() accepts any 837P document and returns a synthetic reference.
 * fetchRemittances() looks at the agency's claims that are currently in
 * "submitted" status (via the injected claim source) and generates ONE
 * realistic 835 file for them, which then flows through the REAL parse835 +
 * postEra path. Rule: a claim whose control number ends in "3" is DENIED with
 * a full-charge CO/97 adjustment; every other claim is PAID in full. Once
 * posted, those claims leave "submitted" status, so the next sweep finds
 * nothing: the loop is naturally idempotent.
 *
 * The generated file name and content are deterministic for a given claim
 * set (no timestamps inside), so its sha256 is stable and the remittance
 * ledger dedupes replays.
 */
import { createHash } from 'crypto';
import type {
  ClearinghouseTransport,
  TransportFetchResult,
  TransportSubmitResult,
  TransportTestResult,
} from './clearinghouse-transport.js';

export interface SandboxClaim {
  controlNumber: string;
  totalChargeCents: number;
}

/** Injected by the app layer so this module stays free of DB access. */
export type SandboxClaimSource = () => Promise<SandboxClaim[]>;

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Deterministic denial rule so demos can show both outcomes. */
export function isSandboxDenied(controlNumber: string): boolean {
  return controlNumber.endsWith('3');
}

/**
 * Build a minimal 835 covering the given claims. Uses default separators
 * (element "*", segment "~") which parse835 assumes when no ISA envelope is
 * present. Returns null for an empty claim set.
 */
export function buildSandbox835(
  claims: SandboxClaim[],
): { fileName: string; content: string } | null {
  const usable = claims.filter((c) => c.controlNumber.trim().length > 0);
  if (usable.length === 0) return null;

  const sorted = [...usable].sort((a, b) => a.controlNumber.localeCompare(b.controlNumber));
  const traceHash = sha256Hex(sorted.map((c) => c.controlNumber).join('|')).slice(0, 8);

  const segments: string[] = [];
  let totalPaidCents = 0;
  const claimSegments: string[] = [];

  for (const claim of sorted) {
    const denied = isSandboxDenied(claim.controlNumber);
    const paidCents = denied ? 0 : claim.totalChargeCents;
    totalPaidCents += paidCents;
    const statusCode = denied ? '4' : '1';
    claimSegments.push(
      `CLP*${claim.controlNumber}*${statusCode}*${dollars(claim.totalChargeCents)}*${dollars(paidCents)}*0*MC*SBX-${claim.controlNumber}`,
    );
    if (denied) {
      claimSegments.push(`CAS*CO*97*${dollars(claim.totalChargeCents)}`);
    }
  }

  segments.push(`BPR*I*${dollars(totalPaidCents)}*C*ACH`);
  segments.push(`TRN*1*SBX${traceHash.toUpperCase()}`);
  segments.push(...claimSegments);

  return {
    fileName: `sandbox-era-${traceHash}.835`,
    content: segments.join('~\n') + '~\n',
  };
}

export function createSandboxClearinghouseTransport(
  source: SandboxClaimSource,
): ClearinghouseTransport {
  return {
    name: 'sandbox',

    async submit(edi837, meta): Promise<TransportSubmitResult> {
      if (!edi837.includes('ST*837')) {
        return { kind: 'error', message: 'Input does not look like an 837 document', retryable: false };
      }
      const epochSeconds = Math.floor(Date.now() / 1000);
      return { kind: 'ok', reference: `SBX-${meta.controlNumber}-${epochSeconds}` };
    },

    async fetchRemittances(): Promise<TransportFetchResult> {
      const claims = await source();
      const file = buildSandbox835(claims);
      if (!file) return { kind: 'ok', files: [] };
      return {
        kind: 'ok',
        files: [{ name: file.fileName, content: file.content, sha256: sha256Hex(file.content) }],
      };
    },

    async testConnection(): Promise<TransportTestResult> {
      return { kind: 'ok', detail: 'Sandbox simulator active. No external connection is made.' };
    },
  };
}
