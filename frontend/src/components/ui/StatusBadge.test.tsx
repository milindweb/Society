import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders with status key and applies correct tone', () => {
    render(<StatusBadge statusKey="PAID" />);
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toHaveClass('hs-badge--success');
  });

  it('renders warning tone for PENDING', () => {
    render(<StatusBadge statusKey="PENDING" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toHaveClass('hs-badge--warning');
  });

  it('renders danger tone for OVERDUE', () => {
    render(<StatusBadge statusKey="OVERDUE" />);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toHaveClass('hs-badge--danger');
  });

  it('renders info tone for OPEN', () => {
    render(<StatusBadge statusKey="OPEN" />);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Open')).toHaveClass('hs-badge--info');
  });

  it('renders neutral tone for unknown status', () => {
    render(<StatusBadge statusKey="UNKNOWN_STATUS" />);
    expect(screen.getByText('Unknown Status')).toBeInTheDocument();
    expect(screen.getByText('Unknown Status')).toHaveClass('hs-badge--neutral');
  });

  it('renders neutral tone for empty status', () => {
    render(<StatusBadge statusKey="" />);
    expect(document.querySelector('.hs-badge')).toHaveClass('hs-badge--neutral');
  });

  it('applies custom className', () => {
    render(<StatusBadge statusKey="PAID" className="custom-class" />);
    expect(screen.getByText('Paid')).toHaveClass('custom-class');
  });

  it('formats label correctly with underscores', () => {
    render(<StatusBadge statusKey="IN_PROGRESS" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('formats label correctly for single word', () => {
    render(<StatusBadge statusKey="CLOSED" />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });
});
