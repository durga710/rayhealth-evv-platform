import { describe, it, expect } from 'vitest';
import { isTestingAccount } from './test-account';

describe('isTestingAccount', () => {
  it('allows the fixture agencies', () => {
    expect(isTestingAccount({ agencyId: 'e1c4a7e3-1cad-4001-8e0a-000000000001', role: 'caregiver' })).toBe(true);
    expect(isTestingAccount({ agencyId: 'b2000000-0000-4000-8000-000000000099', role: 'caregiver' })).toBe(true);
  });

  it('allows admin sessions anywhere', () => {
    expect(isTestingAccount({ agencyId: 'some-real-agency', role: 'admin' })).toBe(true);
  });

  it('denies real caregivers and signed-out state', () => {
    expect(isTestingAccount({ agencyId: 'some-real-agency', role: 'caregiver' })).toBe(false);
    expect(isTestingAccount(null)).toBe(false);
    expect(isTestingAccount({})).toBe(false);
  });
});
