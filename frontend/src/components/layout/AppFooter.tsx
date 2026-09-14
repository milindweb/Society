/* AppFooter.tsx — design.md §87: compact footer */

interface AppFooterProps {
  version?: string;
  className?: string;
}

export function AppFooter({ version, className = '' }: AppFooterProps) {
  return (
    <footer
      className={`hs-footer hs-no-print ${className}`}
      style={{
        height: 'var(--footer-h)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-4)',
        borderTop: '1px solid var(--color-border)',
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-muted)',
        background: 'var(--color-surface)',
      }}
    >
      <span>Housing Society Management</span>
      {version && <span>v{version}</span>}
    </footer>
  );
}
