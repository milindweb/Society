import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('renders with default props', () => {
    render(<Textarea placeholder="Enter text" />);
    const textarea = screen.getByPlaceholderText('Enter text');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveClass('hs-input');
    expect(textarea).toHaveClass('hs-textarea');
    expect(textarea).not.toHaveClass('hs-input--error');
  });

  it('renders with value', () => {
    render(<Textarea value="Test value" readOnly />);
    expect(screen.getByDisplayValue('Test value')).toBeInTheDocument();
  });

  it('renders with error state', () => {
    render(<Textarea error="This field is required" />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveClass('hs-input--error');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('renders with hint', () => {
    render(<Textarea hint="Enter your message" />);
    expect(screen.getByText('Enter your message')).toBeInTheDocument();
    expect(screen.getByText('Enter your message')).toHaveClass('hs-field__hint');
  });

  it('does not render hint when error is present', () => {
    render(<Textarea error="Error" hint="Hint" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Hint')).not.toBeInTheDocument();
  });

  it('calls onChange handler', () => {
    const handleChange = vi.fn();
    render(<Textarea onChange={handleChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new value' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('calls onBlur handler', () => {
    const handleBlur = vi.fn();
    render(<Textarea onBlur={handleBlur} />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('calls onFocus handler', () => {
    const handleFocus = vi.fn();
    render(<Textarea onFocus={handleFocus} />);
    fireEvent.focus(screen.getByRole('textbox'));
    expect(handleFocus).toHaveBeenCalledTimes(1);
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<Textarea ref={ref} />);
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('applies custom className', () => {
    render(<Textarea className="custom-class" />);
    expect(screen.getByRole('textbox')).toHaveClass('custom-class');
  });

  it('applies disabled attribute', () => {
    render(<Textarea disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('applies required attribute', () => {
    render(<Textarea required />);
    expect(screen.getByRole('textbox')).toBeRequired();
  });

  it('applies rows attribute', () => {
    render(<Textarea rows={5} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '5');
  });

  it('applies cols attribute', () => {
    render(<Textarea cols={40} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('cols', '40');
  });
});