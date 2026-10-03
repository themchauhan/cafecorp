import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Nav } from './nav';

describe('Nav', () => {
  it('renders the placeholder nav links', () => {
    render(<Nav profile={null} />);
    expect(screen.getByText('CafeCorp')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
  });

  it('shows a login link when signed out', () => {
    render(<Nav profile={null} />);
    expect(screen.getByText('Log in')).toBeInTheDocument();
  });

  it('shows the role and a logout button when signed in', () => {
    render(<Nav profile={{ uid: 'u1', role: 'ADMIN', tenantId: 't1' }} />);
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    expect(screen.getByText('Log out')).toBeInTheDocument();
  });
});
