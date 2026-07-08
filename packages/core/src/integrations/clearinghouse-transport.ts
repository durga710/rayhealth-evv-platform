/**
 * Clearinghouse transport abstraction: one interface, three implementations.
 *
 *   sftp     real SFTP drop (the industry norm for 837 batch submission)
 *   http     generic HTTPS REST submission for API-based clearinghouses
 *   sandbox  built-in simulator, no network: the full claim loop is demoable
 *            with zero real credentials, and moving to a real clearinghouse
 *            later is a config change only
 *
 * The factory gates per transport and returns `not_configured` with a human
 * reason instead of throwing, matching the Sandata client convention. Security
 * posture for real transports: endpoints are validated against the SSRF host
 * rules at construction AND call time, upstream error bodies are never
 * reflected into our error messages, and credentials never appear in messages
 * or logs.
 */
import type { ClearinghouseClientConfig } from './clearinghouse-client.js';
import { isBlockedOutboundHost, isSafeOutboundUrl } from './url-guard.js';
import { createHttpClearinghouseTransport } from './clearinghouse-http.js';
import { createSftpClearinghouseTransport, type SftpFactory } from './clearinghouse-sftp.js';
import {
  createSandboxClearinghouseTransport,
  type SandboxClaimSource,
} from './clearinghouse-sandbox.js';

/** One remittance file pulled from the clearinghouse. */
export interface RemittanceFile {
  name: string;
  /** Raw 835 text. */
  content: string;
  /** Hex sha256 of content, the ledger dedupe key. */
  sha256: string;
}

export type TransportSubmitResult =
  | { kind: 'ok'; reference: string }
  | { kind: 'error'; message: string; retryable: boolean };

export type TransportFetchResult =
  | { kind: 'ok'; files: RemittanceFile[] }
  | { kind: 'error'; message: string; retryable: boolean };

export type TransportTestResult =
  | { kind: 'ok'; detail: string }
  | { kind: 'error'; message: string; retryable: boolean };

export interface ClearinghouseTransport {
  readonly name: 'sftp' | 'http' | 'sandbox';
  /** Transmit one 837P document. */
  submit(edi837: string, meta: { controlNumber: string }): Promise<TransportSubmitResult>;
  /** Pull up to maxFiles pending 835 files. Never mutates the remote side. */
  fetchRemittances(opts: { maxFiles: number }): Promise<TransportFetchResult>;
  /** Cheap connectivity check for the config page. */
  testConnection(): Promise<TransportTestResult>;
}

export interface ClearinghouseTransportDeps {
  /** Required for the sandbox transport: the agency's submitted claims. */
  sandboxClaims?: SandboxClaimSource;
  /** Test injection point; defaults to a lazy ssh2-sftp-client import. */
  sftpFactory?: SftpFactory;
}

export type TransportFactoryResult =
  | { kind: 'not_configured'; reason: string }
  | { kind: 'ok'; transport: ClearinghouseTransport };

function hasHttpAuth(credentials: ClearinghouseClientConfig['credentials']): boolean {
  return Boolean(credentials && (credentials.apiKey || (credentials.username && credentials.password)));
}

export function createClearinghouseTransport(
  config: ClearinghouseClientConfig,
  deps: ClearinghouseTransportDeps = {},
): TransportFactoryResult {
  if (!config.enabled) {
    return { kind: 'not_configured', reason: 'Clearinghouse integration is disabled for this agency' };
  }

  if (config.transport === 'sandbox') {
    if (!deps.sandboxClaims) {
      return { kind: 'not_configured', reason: 'Sandbox transport requires a claim source' };
    }
    return { kind: 'ok', transport: createSandboxClearinghouseTransport(deps.sandboxClaims) };
  }

  if (config.transport === 'sftp') {
    const host = (config.endpoint ?? '').trim();
    if (!host) return { kind: 'not_configured', reason: 'No SFTP host configured' };
    if (host.includes('://')) {
      return { kind: 'not_configured', reason: 'SFTP endpoint must be a bare hostname, not a URL' };
    }
    if (isBlockedOutboundHost(host)) {
      return { kind: 'not_configured', reason: 'SFTP host resolves to a private or internal address' };
    }
    const creds = config.credentials;
    if (!creds?.username || !creds?.password) {
      return { kind: 'not_configured', reason: 'SFTP transport requires a username and password' };
    }
    return {
      kind: 'ok',
      transport: createSftpClearinghouseTransport(
        { host, username: creds.username, password: creds.password, settings: config.settings },
        deps.sftpFactory,
      ),
    };
  }

  if (config.transport === 'http') {
    const endpoint = (config.endpoint ?? '').trim();
    if (!endpoint) return { kind: 'not_configured', reason: 'No clearinghouse endpoint configured' };
    if (!isSafeOutboundUrl(endpoint)) {
      return { kind: 'not_configured', reason: 'Endpoint must be a public https URL' };
    }
    if (!hasHttpAuth(config.credentials)) {
      return { kind: 'not_configured', reason: 'No clearinghouse credentials configured' };
    }
    return {
      kind: 'ok',
      transport: createHttpClearinghouseTransport({
        endpoint,
        credentials: config.credentials ?? {},
        settings: config.settings,
      }),
    };
  }

  return { kind: 'not_configured', reason: `Unknown clearinghouse transport "${config.transport}"` };
}
