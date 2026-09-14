import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('Default')).toHaveClass('hs-badge');
    expect(screen.getByText('Default')).toHaveClass('hs-badge--neutral');
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Badge variant="info">Info</Badge>);
    expect(screen.getByText('Info')).toHaveClass('hs-badge--info');

    rerender(<Badge variant="success">Success</Badge>);
    expect(screen.getByText('Success')).toHaveClass('hs-badge--success');

    rerender(<Badge variant="warning">Warning</Badge>);
    expect(screen.getByText('Warning')).toHaveClass('hs-badge--warning');

    rerender(<Badge variant="danger">Danger</Badge>);
    expect(screen.getByText('Danger')).toHaveClass('hs-badge--danger');

    rerender(<Badge variant="brand">Brand</Badge>);
    expect(screen.getByText('Brand')).toHaveClass('hs-badge--brand');

    rerender(<Badge variant="neutral">Neutral</Badge>);
    expect(screen.getByText('Neutral')).toHaveClass('hs-badge--neutral');
  });

  it('renders children', () => {
    render(<Badge><span>Badge content</span></Badge>);
    expect(screen.getByText('Badge content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>);
    expect(screen.getByText('Custom')).toHaveClass('custom-class');
  });
});
