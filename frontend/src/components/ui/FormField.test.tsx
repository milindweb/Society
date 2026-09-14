import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from './FormField';

describe('FormField', () => {
  it('renders label', () => {
    render(<FormField label="Email"><input type="email" /></FormField>);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders required indicator', () => {
    render(<FormField label="Email" required><input type="email" /></FormField>);
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('*')).toHaveClass('hs-text-danger');
  });

  it('renders error message', () => {
    render(<FormField label="Email" error="Invalid email"><input type="email" /></FormField>);
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
    expect(screen.getByText('Invalid email')).toHaveClass('hs-field__error');
  });

  it('renders hint message', () => {
    render(<FormField label="Email" hint="Enter your email"><input type="email" /></FormField>);
    expect(screen.getByText('Enter your email')).toBeInTheDocument();
    expect(screen.getByText('Enter your email')).toHaveClass('hs-field__hint');
  });

  it('does not render hint when error is present', () => {
    render(<FormField label="Email" error="Error" hint="Hint"><input type="email" /></FormField>);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('Hint')).not.toBeInTheDocument();
  });

  it('renders children', () => {
    render(<FormField label="Email"><input type="email" data-testid="input" /></FormField>);
    expect(screen.getByTestId('input')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<FormField label="Email" className="custom-class"><input type="email" /></FormField>);
    expect(screen.getByLabelText('Email').closest('.hs-field')).toHaveClass('custom-class');
  });

  it('applies id to label htmlFor', () => {
    render(<FormField label="Email"><input type="email" /></FormField>);
    const label = screen.getByText('Email').closest('label');
    const input = screen.getByRole('textbox');
    expect(label).toHaveAttribute('for', input.id);
  });

  it('generates unique id when not provided', () => {
    render(
      <>
        <FormField label="Email"><input type="email" /></FormField>
        <FormField label="Name"><input /></FormField>
      </>
    );
    expect(screen.getByLabelText('Email').id).not.toBe(screen.getByLabelText('Name').id);
  });

  it('renders with textarea child', () => {
    render(<FormField label="Message"><textarea /></FormField>);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders with select child', () => {
    render(
      <FormField label="Option">
        <select><option value="1">Option 1</option></select>
      </FormField>
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
