import { getCsrfToken } from './session-state.js';

/**
 * Typed error thrown by getJson / postJson on non-2xx responses.
 * Carries the parsed JSON body (if any) so callers can branch on
 * server-supplied error codes (e.g. 422 CAREGIVER_NOT_COMPLIANT) without
 * a second fetch.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    /** Parsed JSON body — `null` if the response wasn't JSON or was empty. */
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const csrfToken = getCsrfToken();
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const parsed = await parseBody(response);
    throw new HttpError(response.status, parsed, `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { accept: 'application/json' }
  });

  if (!response.ok) {
    const parsed = await parseBody(response);
    throw new HttpError(response.status, parsed, `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}
