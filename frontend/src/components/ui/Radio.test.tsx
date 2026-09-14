import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Radio } from './Radio';

describe('Radio', () => {
  it('renders with label', () => {
    render(<Radio label="Option 1" />);
    const label = screen.getByLabelText('Option 1');
    expect(label).toBeInTheDocument();
    expect(label.closest('label')).toHaveClass('hs-radio');
    expect(screen.getByRole('radio')).toBeInTheDocument();
  });

  it('renders checked state', () => {
    render(<Radio label="Selected" defaultChecked />);
    expect(screen.getByRole('radio')).toBeChecked();
  });

  it('renders unchecked state', () => {
    render(<Radio label="Not selected" />);
    expect(screen.getByRole('radio')).not.toBeChecked();
  });

  it('calls onChange handler', () => {
    const handleChange = vi.fn();
    render(<Radio label="Option" onChange={handleChange} />);
    fireEvent.click(screen.getByRole('radio'));
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0].target.checked).toBe(true);
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<Radio ref={ref} label="Ref test" />);
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement);
  });

  it('applies custom className', () => {
    render(<Radio label="Custom" className="custom-class" />);
    expect(screen.getByLabelText('Custom').closest('label')).toHaveClass('custom-class');
  });

  it('applies disabled attribute', () => {
    render(<Radio label="Disabled" disabled />);
    expect(screen.getByRole('radio')).toBeDisabled();
  });

  it('applies required attribute', () => {
    render(<Radio label="Required" required />);
    expect(screen.getByRole('radio')).toBeRequired();
  });

  it('applies name attribute for grouping', () => {
    render(<Radio label="Option 1" name="group" />);
    expect(screen.getByRole('radio')).toHaveAttribute('name', 'group');
  });

  it('applies value attribute', () => {
    render(<Radio label="Option" value="option1" />);
    expect(screen.getByRole('radio')).toHaveAttribute('value', 'option1');
  });

  it('applies id attribute', () => {
    render(<Radio label="Test" id="test-radio" />);
    expect(screen.getByRole('radio')).toHaveAttribute('id', 'test-radio');
  });
});
