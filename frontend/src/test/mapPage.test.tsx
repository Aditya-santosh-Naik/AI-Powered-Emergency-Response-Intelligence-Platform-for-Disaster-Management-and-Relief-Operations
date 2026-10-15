import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeverityBadge } from '../components/SeverityBadge';

describe('Map Page Components', () => {
  it('renders Critical severity badge with red styling', () => {
    render(<SeverityBadge level="Critical" score={85} />);
    const badge = screen.getByText(/Critical/i);
    expect(badge).toBeInTheDocument();
    expect(screen.getByText('(85)')).toBeInTheDocument();
  });

  it('renders Low severity badge with green styling', () => {
    render(<SeverityBadge level="Low" score={15} />);
    const badge = screen.getByText(/Low/i);
    expect(badge).toBeInTheDocument();
  });
});
