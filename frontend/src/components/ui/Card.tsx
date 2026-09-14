/* Card.tsx — design.md §38, §88 */

import { type HTMLAttributes, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
}

export function Card({ raised, className = '', children, ...props }: CardProps) {
  return (
    <div className={`hs-card ${raised ? 'hs-card--raised' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`hs-card__header ${className}`}>
      <h3 className="hs-card__title">{title}</h3>
      {action}
    </div>
  );
}

export function CardBody({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`hs-card__body ${className}`} {...props}>
      {children}
    </div>
  );
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '', ...props }: CardFooterProps) {
  return (
    <div className={`hs-card__footer ${className}`} {...props}>
      {children}
    </div>
  );
}
