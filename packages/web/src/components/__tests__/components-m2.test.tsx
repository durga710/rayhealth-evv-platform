import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Skeleton } from '../ui/skeleton';
import { Spinner } from '../ui/spinner';
import { EmptyState } from '../patterns/empty-state';
import { StatCard } from '../patterns/stat-card';
import { SearchInput } from '../patterns/search-input';

describe('Alert', () => {
  it('renders with role="alert" and title/description', () => {
    render(
      <Alert variant="success">
        <AlertTitle>Saved</AlertTitle>
        <AlertDescription>Changes stored.</AlertDescription>
      </Alert>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Changes stored.')).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('renders an aria-hidden placeholder', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    const el = container.querySelector('[data-slot="skeleton"]');
    expect(el).toBeTruthy();
    expect(el).toHaveAttribute('aria-hidden');
  });
});

describe('Spinner', () => {
  it('exposes an accessible status label', () => {
    render(<Spinner label="Fetching" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Fetching')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders title, description, and action', () => {
    render(
      <EmptyState title="No clients" description="Add your first client" action={<button>Add</button>} />,
    );
    expect(screen.getByText('No clients')).toBeInTheDocument();
    expect(screen.getByText('Add your first client')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Active caregivers" value={42} />);
    expect(screen.getByText('Active caregivers')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('treats a positive delta as good by default and invertable', () => {
    const { rerender, container } = render(<StatCard label="Revenue" value="$1k" delta={12} />);
    expect(container.querySelector('.bg-success-subtle')).toBeTruthy();
    rerender(<StatCard label="Missed visits" value={3} delta={5} invertDelta />);
    expect(container.querySelector('.bg-destructive-subtle')).toBeTruthy();
  });
});

describe('SearchInput', () => {
  it('emits changes and clears', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<SearchInput value="" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ana' } });
    expect(onValueChange).toHaveBeenCalledWith('ana');

    rerender(<SearchInput value="ana" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onValueChange).toHaveBeenCalledWith('');
  });
});
