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
      <span style={{ flex: 1 }}>Housing Society Management</span>
      <span style={{ flex: 1, textAlign: 'center' }}>
        Designed by:{' '}
        <a href="https://mk9.in" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 'var(--weight-medium)' }}>
          MAMK
        </a>
      </span>
      <span style={{ flex: 1, textAlign: 'right' }}>{version ? `v${version}` : ''}</span>
    </footer>
  );
}
