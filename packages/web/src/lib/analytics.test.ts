import { describe, expect, it } from 'vitest';
import { dropAuthenticatedEvents, isAuthenticatedPath } from './analytics.js';

describe('analytics privacy gate', () => {
  it('flags authenticated route prefixes (and their nested paths)', () => {
    expect(isAuthenticatedPath('/admin')).toBe(true);
    expect(isAuthenticatedPath('/admin/audit-packet/8f2c-visit-id')).toBe(true);
    expect(isAuthenticatedPath('/admin/staff/caregiver-42')).toBe(true);
    expect(isAuthenticatedPath('/superadmin/agencies')).toBe(true);
    expect(isAuthenticatedPath('/portal/visits')).toBe(true);
    expect(isAuthenticatedPath('/caregiver/today')).toBe(true);
  });

  it('does not flag public marketing routes', () => {
    expect(isAuthenticatedPath('/')).toBe(false);
    expect(isAuthenticatedPath('/pricing')).toBe(false);
    expect(isAuthenticatedPath('/hipaa')).toBe(false);
    expect(isAuthenticatedPath('/trust')).toBe(false);
    // A public route that merely starts with the same letters must not match.
    expect(isAuthenticatedPath('/administrators-guide')).toBe(false);
  });

  it('drops analytics events for authenticated, id-bearing paths', () => {
    const event = { url: 'https://app.rayhealthevv.com/admin/audit-packet/visit-9f3a' };
    expect(dropAuthenticatedEvents(event)).toBeNull();
  });

  it('passes through analytics events for public marketing paths', () => {
    const event = { url: 'https://www.rayhealthevv.com/pricing' };
    expect(dropAuthenticatedEvents(event)).toBe(event);
  });

  it('fails closed (drops) when the URL cannot be parsed', () => {
    expect(dropAuthenticatedEvents({ url: 'not a url' })).toBeNull();
  });
});
