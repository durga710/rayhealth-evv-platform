import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AcceptInvitePage } from './AcceptInvitePage.js';

// Wrap in the router context the page needs (useParams + useNavigate).
function renderWithToken(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/accept/${token}`]}>
      <Routes>
        <Route path="/accept/:token" element={<AcceptInvitePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  headers: { get: (k: string) => string | null };
};

function mockFetch(getResponse: MockResponse, postResponse?: MockResponse) {
  return vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
    if (!options?.method || options.method === 'GET') {
      return Promise.resolve(getResponse);
    }
    return Promise.resolve(postResponse ?? getResponse);
  }) as unknown as typeof global.fetch;
}

const PENDING_INFO = {
  success: true,
  data: {
    email: 'maria@keystone.example',
    role: 'caregiver',
    firstName: 'Maria',
    lastName: 'Lopez',
    agencyName: 'Keystone Home Care',
    expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    status: 'pending',
  },
};

const jsonHeaders: MockResponse['headers'] = { get: () => null };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('AcceptInvitePage', () => {
  describe('loading and invite state', () => {
    it('renders invite info once the GET resolves', async () => {
      global.fetch = mockFetch({ ok: true, status: 200, headers: jsonHeaders, json: () => Promise.resolve(PENDING_INFO) });

      renderWithToken('tok-abc');

      await screen.findByText(/Keystone Home Care/i);
      expect(screen.getByText(/maria@keystone\.example/i)).toBeInTheDocument();
    });

    it('shows error message for 404 unknown token', async () => {
      global.fetch = mockFetch({ ok: false, status: 404, headers: jsonHeaders, json: () => Promise.resolve({}) });

      renderWithToken('bad-token');

      await screen.findByText(/not found/i);
    });

    it('shows blocking message and no form for an expired invite', async () => {
      global.fetch = mockFetch({
        ok: true, status: 200, headers: jsonHeaders,
        json: () => Promise.resolve({ success: true, data: { ...PENDING_INFO.data, status: 'expired' } }),
      });

      renderWithToken('tok-exp');

      await screen.findByText(/expired/i);
      expect(screen.queryByLabelText(/access code/i)).not.toBeInTheDocument();
    });

    it('shows blocking message and no form for a revoked invite', async () => {
      global.fetch = mockFetch({
        ok: true, status: 200, headers: jsonHeaders,
        json: () => Promise.resolve({ success: true, data: { ...PENDING_INFO.data, status: 'revoked' } }),
      });

      renderWithToken('tok-rev');

      await screen.findByText(/revoked/i);
      expect(screen.queryByLabelText(/access code/i)).not.toBeInTheDocument();
    });
  });

  describe('client-side validation', () => {
    beforeEach(() => {
      global.fetch = mockFetch({ ok: true, status: 200, headers: jsonHeaders, json: () => Promise.resolve(PENDING_INFO) });
    });

    it('shows error when password is too short', async () => {
      renderWithToken('tok-abc');
      await screen.findByText(/Keystone Home Care/i);

      fireEvent.change(screen.getByLabelText(/access code/i), { target: { value: 'ABCD-1234' } });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'short' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } });
      fireEvent.click(screen.getByRole('button', { name: /create account|accept/i }));

      await screen.findByText(/at least 12/i);
    });

    it('shows error when passwords do not match', async () => {
      renderWithToken('tok-abc');
      await screen.findByText(/Keystone Home Care/i);

      fireEvent.change(screen.getByLabelText(/access code/i), { target: { value: 'ABCD-1234' } });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'CorrectHorse12!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'DifferentHorse12!' } });
      fireEvent.click(screen.getByRole('button', { name: /create account|accept/i }));

      await screen.findByText(/do not match/i);
    });
  });

  describe('form submission', () => {
    it('shows success state after a 201 response', async () => {
      global.fetch = mockFetch(
        { ok: true, status: 200, headers: jsonHeaders, json: () => Promise.resolve(PENDING_INFO) },
        {
          ok: true, status: 201, headers: jsonHeaders,
          json: () => Promise.resolve({ success: true, data: { token: 'jwt-tok', role: 'caregiver', userId: 'u-1', caregiverId: 'c-1' } }),
        },
      );

      renderWithToken('tok-abc');
      await screen.findByText(/Keystone Home Care/i);

      fireEvent.change(screen.getByLabelText(/access code/i), { target: { value: 'ABCD-1234' } });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'CorrectHorse12!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'CorrectHorse12!' } });
      fireEvent.click(screen.getByRole('button', { name: /create account|accept/i }));

      await screen.findByText(/success|account created|sign in/i);
    });

    it('shows wrong-access-code error on 401 response', async () => {
      global.fetch = mockFetch(
        { ok: true, status: 200, headers: jsonHeaders, json: () => Promise.resolve(PENDING_INFO) },
        { ok: false, status: 401, headers: jsonHeaders, json: () => Promise.resolve({ error: 'wrong code' }) },
      );

      renderWithToken('tok-abc');
      await screen.findByText(/Keystone Home Care/i);

      fireEvent.change(screen.getByLabelText(/access code/i), { target: { value: 'WRONG-CODE' } });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'CorrectHorse12!' } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'CorrectHorse12!' } });
      fireEvent.click(screen.getByRole('button', { name: /create account|accept/i }));

      await screen.findByText(/access code does not match/i);
    });
  });
});
