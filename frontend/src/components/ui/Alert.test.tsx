import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert } from './Alert';

describe('Alert', () => {
  it('renders with default variant', () => {
    render(<Alert>Default alert</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('hs-alert');
    expect(alert).toHaveClass('hs-alert--info');
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Alert variant="info">Info</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('hs-alert--info');

    rerender(<Alert variant="success">Success</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('hs-alert--success');

    rerender(<Alert variant="warning">Warning</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('hs-alert--warning');

    rerender(<Alert variant="danger">Danger</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('hs-alert--danger');
  });

  it('renders children', () => {
    render(<Alert><strong>Bold</strong> alert</Alert>);
    expect(screen.getByText('Bold')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Bold alert');
  });

  it('applies custom className', () => {
    render(<Alert className="custom-class">Custom</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('custom-class');
  });

  it('has role alert for accessibility', () => {
    render(<Alert>Alert message</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
