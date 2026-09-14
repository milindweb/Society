/* Breadcrumb.tsx — design.md §87 */

interface BreadcrumbItem {
  label: string;
  route?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav className={`hs-breadcrumb ${className}`} aria-label="Breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i}>
            {i > 0 && <span className="hs-breadcrumb__separator" style={{ margin: '0 var(--space-1)' }}>›</span>}
            {isLast || !item.route ? (
              <span className="hs-breadcrumb__current">{item.label}</span>
            ) : (
              <button
                className="hs-breadcrumb__link"
                onClick={item.onClick}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
              >
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
