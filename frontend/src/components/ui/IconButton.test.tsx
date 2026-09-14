import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('renders with required props', () => {
    render(<IconButton icon={<span data-testid="icon">★</span>} label="Action" />);
    const button = screen.getByRole('button', { name: /action/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Action');
    expect(button).toHaveAttribute('title', 'Action');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders with different variants', () => {
    const { rerender } = render(
      <IconButton icon={<span />} label="Test" variant="primary" />
    );
    expect(screen.getByRole('button')).toHaveClass('hs-btn--primary');

    rerender(<IconButton icon={<span />} label="Test" variant="secondary" />);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--secondary');

    rerender(<IconButton icon={<span />} label="Test" variant="outline" />);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--outline');

    rerender(<IconButton icon={<span />} label="Test" variant="ghost" />);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--ghost');

    rerender(<IconButton icon={<span />} label="Test" variant="danger" />);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--danger');
  });

  it('renders with different sizes', () => {
    const { rerender } = render(
      <IconButton icon={<span />} label="Test" size="sm" />
    );
    expect(screen.getByRole('button')).toHaveClass('hs-btn--sm');

    rerender(<IconButton icon={<span />} label="Test" size="md" />);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--md');

    rerender(<IconButton icon={<span />} label="Test" size="lg" />);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--lg');
  });

  it('shows loading state', () => {
    render(<IconButton icon={<span />} label="Loading" loading />);
    const button = screen.getByRole('button', { name: /loading/i });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('hs-btn--loading');
  });

  it('does not call onClick when loading', () => {
    const handleClick = vi.fn();
    render(<IconButton icon={<span />} label="Loading" loading onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('calls onClick handler', () => {
    const handleClick = vi.fn();
    render(<IconButton icon={<span />} label="Click" onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<IconButton ref={ref} icon={<span />} label="Ref test" />);
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLButtonElement);
  });

  it('applies custom className', () => {
    render(<IconButton icon={<span />} label="Test" className="custom-class" />);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('does not render children other than icon', () => {
    render(
      <IconButton icon={<span data-testid="icon">★</span>} label="Test">
        Ignored
      </IconButton>
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.queryByText('Ignored')).not.toBeInTheDocument();
  });
});