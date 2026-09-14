import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('renders with default props', () => {
    render(<Input placeholder="Enter text" />);
    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('hs-input');
    expect(input).not.toHaveClass('hs-input--error');
  });

  it('renders with value', () => {
    render(<Input value="Test value" readOnly />);
    expect(screen.getByDisplayValue('Test value')).toBeInTheDocument();
  });

  it('renders with error state', () => {
    render(<Input error="This field is required" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('hs-input--error');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('renders with hint', () => {
    render(<Input hint="Enter your email" />);
    expect(screen.getByText('Enter your email')).toBeInTheDocument();
    expect(screen.getByText('Enter your email')).toHaveClass('hs-field__hint');
  });

  it('does not render hint when error is present', () => {
    render(<Input error="Error" hint="Hint" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Hint')).not.toBeInTheDocument();
  });

  it('calls onChange handler', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new value' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('calls onBlur handler', () => {
    const handleBlur = vi.fn();
    render(<Input onBlur={handleBlur} />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('calls onFocus handler', () => {
    const handleFocus = vi.fn();
    render(<Input onFocus={handleFocus} />);
    fireEvent.focus(screen.getByRole('textbox'));
    expect(handleFocus).toHaveBeenCalledTimes(1);
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<Input ref={ref} />);
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement);
  });

  it('applies custom className', () => {
    render(<Input className="custom-class" />);
    expect(screen.getByRole('textbox')).toHaveClass('custom-class');
  });

  it('applies disabled attribute', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('applies required attribute', () => {
    render(<Input required />);
    expect(screen.getByRole('textbox')).toBeRequired();
  });

  it('renders with type password', () => {
    render(<Input type="password" />);
    expect(document.querySelector('input')).toHaveAttribute('type', 'password');
  });

  it('renders with type email', () => {
    render(<Input type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
  });

  it('applies aria-describedby when error or hint present', () => {
    const { rerender } = render(<Input error="Error" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    rerender(<Input hint="Hint" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
  });
});
