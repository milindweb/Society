import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Select } from './Select';

describe('Select', () => {
  const options = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3', disabled: true },
  ];

  it('renders with options', () => {
    render(<Select options={options} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).toHaveClass('hs-input');
    expect(select).toHaveClass('hs-select');
    expect(screen.getByRole('option', { name: /option 1/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /option 2/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /option 3/i })).toBeDisabled();
  });

  it('renders placeholder option', () => {
    render(<Select options={options} placeholder="Select an option" />);
    expect(screen.getByRole('option', { name: /select an option/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /select an option/i })).toBeDisabled();
  });

  it('renders with error state', () => {
    render(<Select options={options} error="Please select an option" />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('hs-input--error');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Please select an option')).toBeInTheDocument();
  });

  it('renders with hint', () => {
    render(<Select options={options} hint="Choose one" />);
    expect(screen.getByText('Choose one')).toBeInTheDocument();
    expect(screen.getByText('Choose one')).toHaveClass('hs-field__hint');
  });

  it('does not render hint when error is present', () => {
    render(<Select options={options} error="Error" hint="Hint" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Hint')).not.toBeInTheDocument();
  });

  it('calls onChange handler with selected value', () => {
    const handleChange = vi.fn();
    render(<Select options={options} onChange={handleChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0].target.value).toBe('2');
  });

  it('sets value prop', () => {
    render(<Select options={options} value="2" />);
    expect(screen.getByRole('combobox')).toHaveValue('2');
  });

  it('forwards ref', () => {
    const ref = vi.fn();
    render(<Select ref={ref} options={options} />);
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLSelectElement);
  });

  it('applies custom className', () => {
    render(<Select options={options} className="custom-class" />);
    expect(screen.getByRole('combobox')).toHaveClass('custom-class');
  });

  it('applies disabled attribute', () => {
    render(<Select options={options} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('applies required attribute', () => {
    render(<Select options={options} required />);
    expect(screen.getByRole('combobox')).toBeRequired();
  });

  it('does not render placeholder when not provided', () => {
    render(<Select options={options} />);
    expect(screen.queryByRole('option', { name: /select/i })).not.toBeInTheDocument();
  });

  it('renders empty options array', () => {
    render(<Select options={[]} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});