import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast, ToastContainer } from './Toast';

describe('Toast', () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnDismiss.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with message', () => {
    render(<Toast id="1" type="success" message="Operation successful" onDismiss={mockOnDismiss} />);
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('renders with different types', () => {
    const { rerender } = render(<Toast id="1" type="success" message="Success" onDismiss={mockOnDismiss} />);
    expect(screen.getByText('Success').parentElement).toHaveClass('hs-toast--success');

    rerender(<Toast id="2" type="error" message="Error" onDismiss={mockOnDismiss} />);
    expect(screen.getByText('Error').parentElement).toHaveClass('hs-toast--error');

    rerender(<Toast id="3" type="warning" message="Warning" onDismiss={mockOnDismiss} />);
    expect(screen.getByText('Warning').parentElement).toHaveClass('hs-toast--warning');

    rerender(<Toast id="4" type="info" message="Info" onDismiss={mockOnDismiss} />);
    expect(screen.getByText('Info').parentElement).toHaveClass('hs-toast--info');
  });

  it('calls onDismiss when dismiss button clicked', () => {
    render(<Toast id="1" type="success" message="Success" onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(mockOnDismiss).toHaveBeenCalledWith('1');
  });

  it('calls onDismiss after timeout', () => {
    render(<Toast id="1" type="success" message="Success" onDismiss={mockOnDismiss} />);
    expect(mockOnDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(mockOnDismiss).toHaveBeenCalledWith('1');
  });

  it('clears timeout on unmount', () => {
    const { unmount } = render(<Toast id="1" type="success" message="Success" onDismiss={mockOnDismiss} />);
    unmount();
    vi.advanceTimersByTime(5000);
    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('renders dismiss button with icon', () => {
    render(<Toast id="1" type="success" message="Success" onDismiss={mockOnDismiss} />);
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    expect(dismissBtn).toBeInTheDocument();
    expect(dismissBtn).toHaveAttribute('aria-label', 'Dismiss');
  });
});

describe('ToastContainer', () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    mockOnDismiss.mockClear();
  });

  it('renders nothing when toasts array is empty', () => {
    render(<ToastContainer toasts={[]} onDismiss={mockOnDismiss} />);
    expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    render(
      <ToastContainer
        toasts={[
          { id: '1', type: 'success', message: 'Success 1' },
          { id: '2', type: 'error', message: 'Error 1' },
        ]}
        onDismiss={mockOnDismiss}
      />
    );
    expect(screen.getByText('Success 1')).toBeInTheDocument();
    expect(screen.getByText('Error 1')).toBeInTheDocument();
  });

  it('passes onDismiss to each toast', () => {
    render(
      <ToastContainer
        toasts={[{ id: '1', type: 'success', message: 'Success' }]}
        onDismiss={mockOnDismiss}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(mockOnDismiss).toHaveBeenCalledWith('1');
  });

  it('renders toast container wrapper', () => {
    render(
      <ToastContainer
        toasts={[{ id: '1', type: 'success', message: 'Success' }]}
        onDismiss={mockOnDismiss}
      />
    );
    expect(screen.getByText('Success').parentElement?.parentElement).toHaveClass('hs-toast-container');
  });
});
