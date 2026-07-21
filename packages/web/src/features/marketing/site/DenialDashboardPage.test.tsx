import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { DenialDashboardPage } from './DenialDashboardPage.js';

describe('DenialDashboardPage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <DenialDashboardPage />
      </MemoryRouter>
    );
  }

  it('renders the hero heading', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /See your denials\. Keep your system\./i, level: 1 })
    ).toBeInTheDocument();
  });

  it('leads with the no-switch wedge promise', () => {
    renderPage();
    expect(screen.getByText(/No platform switch required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no claims need to be generated in RayHealth/i)
    ).toBeInTheDocument();
  });

  it('renders the three steps', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Post your 835s/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /See the denial picture/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Work every denial to done/i })).toBeInTheDocument();
  });

  it('names no competitor anywhere on the page', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';
    for (const vendor of ['HHAeXchange', 'WellSky', 'AxisCare', 'OneCare', 'StoriiCare', 'Alora', 'CareVoyant']) {
      expect(text).not.toContain(vendor);
    }
  });

  it('links the primary CTA to the demo page', () => {
    renderPage();
    const cta = screen.getByRole('link', { name: /See it with your 835s/i });
    expect(cta).toHaveAttribute('href', '/demo');
  });
});
