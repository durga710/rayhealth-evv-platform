/**
 * Clearinghouse config types shared by the config repository and the
 * transport layer. The actual transports (sftp, http, sandbox) live in
 * clearinghouse-transport.ts and its sibling modules; the old stub
 * submitClaim/fetchRemittances functions that lived here were never called
 * and were removed when the real transports landed.
 */

export interface ClearinghouseClientConfig {
  enabled: boolean;
  /** 'sftp' | 'http' | 'sandbox' */
  transport: string;
  /** SFTP host or HTTPS base URL. Unused by the sandbox transport. */
  endpoint: string | null;
  /** Decrypted credentials (username/password or apiKey). */
  credentials: Record<string, string | undefined> | null;
  /** submitterId, receiverId, port, uploadDir, remittanceDir, etc. */
  settings: Record<string, unknown>;
}

export type ClearinghouseResult =
  | { kind: 'not_configured'; reason: string }
  | { kind: 'ok'; reference: string }
  | { kind: 'error'; message: string; retryable: boolean };
