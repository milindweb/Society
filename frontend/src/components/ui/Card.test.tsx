import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardBody, CardFooter } from './Card';

describe('Card', () => {
  it('renders with children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
    expect(screen.getByText('Card content')).toHaveClass('hs-card');
  });

  it('renders with raised variant', () => {
    render(<Card raised>Raised card</Card>);
    expect(screen.getByText('Raised card')).toHaveClass('hs-card--raised');
  });

  it('applies custom className', () => {
    render(<Card className="custom-class">Content</Card>);
    expect(screen.getByText('Content')).toHaveClass('custom-class');
  });

  it('forwards additional props', () => {
    render(<Card id="test-card" data-test="card">Content</Card>);
    expect(screen.getByText('Content')).toHaveAttribute('id', 'test-card');
    expect(screen.getByText('Content')).toHaveAttribute('data-test', 'card');
  });
});

describe('CardHeader', () => {
  it('renders title', () => {
    render(<CardHeader title="Card Title" />);
    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card Title')).toHaveClass('hs-card__title');
  });

  it('renders action', () => {
    render(<CardHeader title="Title" action={<button>Action</button>} />);
    expect(screen.getByRole('button', { name: /action/i })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<CardHeader title="Title" className="custom-class" />);
    expect(screen.getByText('Title').parentElement).toHaveClass('custom-class');
  });
});

describe('CardBody', () => {
  it('renders children', () => {
    render(<CardBody>Body content</CardBody>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toHaveClass('hs-card__body');
  });

  it('applies custom className', () => {
    render(<CardBody className="custom-class">Content</CardBody>);
    expect(screen.getByText('Content')).toHaveClass('custom-class');
  });

  it('forwards additional props', () => {
    render(<CardBody id="test-body">Content</CardBody>);
    expect(screen.getByText('Content')).toHaveAttribute('id', 'test-body');
  });
});

describe('CardFooter', () => {
  it('renders children', () => {
    render(<CardFooter>Footer content</CardFooter>);
    expect(screen.getByText('Footer content')).toBeInTheDocument();
    expect(screen.getByText('Footer content')).toHaveClass('hs-card__footer');
  });

  it('applies custom className', () => {
    render(<CardFooter className="custom-class">Content</CardFooter>);
    expect(screen.getByText('Content')).toHaveClass('custom-class');
  });
});
