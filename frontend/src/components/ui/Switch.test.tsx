import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from './Switch';

describe('Switch', () => {
  it('renders without label', () => {
    render(<Switch />);
    const label = screen.getByRole('switch');
    expect(label).toBeInTheDocument();
    expect(label.closest('label')).toHaveClass('hs-switch');
    expect(label.closest('label')).not.toHaveTextContent(/\S/);
  });

  it('renders with label', () => {
    render(<Switch label="Enable feature" />);
    const label = screen.getByLabelText('Enable feature');
    expect(label).toBeInTheDocument();
    expect(label.closest('label')).toHaveClass('hs-switch');
    expect(screen.getByText('Enable feature')).toBeInTheDocument();
  });

  it('renders checked state', () => {
    render(<Switch defaultChecked />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('renders unchecked state', () => {
    render(<Switch />);
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('calls onChange handler', () => {
    const handleChange = vi.fn();
    render(<Switch onChange={handleChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0].target.checked).toBe(true);
  });

  it('calls onChange when unchecking', () => {
    const handleChange = vi.fn();
    render(<Switch defaultChecked onChange={handleChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0].target.checked).toBe(false);
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<Switch ref={ref} />);
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement);
  });

  it('applies custom className', () => {
    render(<Switch className="custom-class" />);
    expect(screen.getByRole('switch').closest('label')).toHaveClass('custom-class');
  });

  it('applies disabled attribute', () => {
    render(<Switch disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('applies required attribute', () => {
    render(<Switch required />);
    expect(screen.getByRole('switch')).toBeRequired();
  });

  it('applies name attribute', () => {
    render(<Switch name="feature" />);
    expect(screen.getByRole('switch')).toHaveAttribute('name', 'feature');
  });

  it('applies id attribute', () => {
    render(<Switch id="test-switch" />);
    expect(screen.getByRole('switch')).toHaveAttribute('id', 'test-switch');
  });

  it('renders track and thumb elements', () => {
    render(<Switch />);
    const label = screen.getByRole('switch').closest('label');
    expect(label).toHaveClass('hs-switch');
    expect(label?.querySelector('.hs-switch__track')).toBeInTheDocument();
    expect(label?.querySelector('.hs-switch__thumb')).toBeInTheDocument();
  });
});
