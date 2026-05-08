import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { AssignmentsPage } from './AssignmentsPage.js';

describe('AssignmentsPage', () => {
  it('submits a coordinator assignment form', async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockImplementation((url, options) => {
      if (options?.method === 'POST') {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ 
            id: '123',
            clientId: body.clientId || 'client-1',
            caregiverId: body.caregiverId || 'caregiver-1',
            visitDate: body.visitDate || ''
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      });
    });
    global.fetch = mockFetch;

    render(<AssignmentsPage />);
    
    fireEvent.change(screen.getByLabelText('Client ID'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Caregiver ID'), { target: { value: 'caregiver-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Assignment' }));
    
    await waitFor(() => {
      expect(screen.getByText('Assignment created successfully')).toBeInTheDocument();
    });
    
    expect(mockFetch).toHaveBeenCalled();
  });
});
