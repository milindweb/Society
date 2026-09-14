import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('renders with label', () => {
    render(<Checkbox label="I agree" />);
    const label = screen.getByLabelText('I agree');
    expect(label).toBeInTheDocument();
    expect(label.closest('label')).toHaveClass('hs-checkbox');
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders checked state', () => {
    render(<Checkbox label="Checked" defaultChecked />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('renders unchecked state', () => {
    render(<Checkbox label="Unchecked" />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('calls onChange handler', () => {
    const handleChange = vi.fn();
    render(<Checkbox label="Toggle" onChange={handleChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0].target.checked).toBe(true);
  });

  it('calls onChange when unchecking', () => {
    const handleChange = vi.fn();
    render(<Checkbox label="Toggle" defaultChecked onChange={handleChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0].target.checked).toBe(false);
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<Checkbox ref={ref} label="Ref test" />);
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement);
  });

  it('applies custom className', () => {
    render(<Checkbox label="Custom" className="custom-class" />);
    expect(screen.getByLabelText('Custom').closest('label')).toHaveClass('custom-class');
  });

  it('applies disabled attribute', () => {
    render(<Checkbox label="Disabled" disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('applies required attribute', () => {
    render(<Checkbox label="Required" required />);
    expect(screen.getByRole('checkbox')).toBeRequired();
  });

  it('applies id attribute', () => {
    render(<Checkbox label="Test" id="test-checkbox" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('id', 'test-checkbox');
  });

  it('applies name attribute', () => {
    render(<Checkbox label="Test" name="agreement" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('name', 'agreement');
  });

  it('applies value attribute', () => {
    render(<Checkbox label="Test" value="agreed" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('value', 'agreed');
  });
});
