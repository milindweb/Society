import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button).toHaveClass('hs-btn--primary');
    expect(button).toHaveClass('hs-btn--md');
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--primary');

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--secondary');

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--outline');

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--ghost');

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--danger');

    rerender(<Button variant="link">Link</Button>);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--link');
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--sm');

    rerender(<Button size="md">Medium</Button>);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--md');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('hs-btn--lg');
  });

  it('shows loading state', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button', { name: /loading/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveClass('hs-btn--loading');
    expect(button).toHaveTextContent('Loading');
  });

  it('hides icon when loading', () => {
    const { rerender } = render(
      <Button icon={<span data-testid="icon">★</span>}>With Icon</Button>
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();

    rerender(
      <Button loading icon={<span data-testid="icon">★</span>}>Loading</Button>
    );
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
  });

  it('calls onClick handler', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('does not call onClick when loading', () => {
    const handleClick = vi.fn();
    render(<Button loading onClick={handleClick}>Loading</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Ref test</Button>);
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLButtonElement);
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('renders children correctly', () => {
    render(<Button><span>Child content</span></Button>);
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('applies aria-busy when loading', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('applies aria-busy=false when not loading', () => {
    render(<Button>Not loading</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'false');
  });
});
