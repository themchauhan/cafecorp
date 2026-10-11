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

  it('prefers the real display name over the raw role when given one', () => {
    render(
      <Nav
        profile={{ uid: 'u1', role: 'ADMIN', tenantId: 't1' }}
        displayName="Priya Sharma"
      />,
    );
    expect(screen.getAllByText('Priya Sharma').length).toBeGreaterThan(0);
  });

  it('hides Reports and Admin for STAFF, who get a 403 on those routes', () => {
    render(<Nav profile={{ uid: 'u1', role: 'STAFF', tenantId: 't1' }} />);
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
    expect(screen.getByText('Tables')).toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('shows every link for ADMIN', () => {
    render(<Nav profile={{ uid: 'u1', role: 'ADMIN', tenantId: 't1' }} />);
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('only shows Dashboard and Admin for SUPER_ADMIN, who has no tenant', () => {
    render(
      <Nav profile={{ uid: 'u1', role: 'SUPER_ADMIN', tenantId: null }} />,
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();
  });
});
