/* Tabs.tsx — design.md §87 */

import { type ReactNode, useState } from 'react';

interface Tab {
  key: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  defaultKey?: string;
  className?: string;
  onChange?: (key: string) => void;
}

export function Tabs({ tabs, defaultKey, className = '', onChange }: TabsProps) {
  const [active, setActive] = useState(defaultKey ?? tabs[0]?.key ?? '');

  const handleChange = (key: string) => {
    setActive(key);
    onChange?.(key);
  };

  return (
    <div className={className}>
      <div className="hs-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`hs-tabs__tab ${active === tab.key ? 'hs-tabs__tab--active' : ''}`}
            role="tab"
            aria-selected={active === tab.key}
            disabled={tab.disabled}
            onClick={() => handleChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 'var(--space-4) 0' }} role="tabpanel">
        {tabs.find((t) => t.key === active)?.content}
      </div>
    </div>
  );
}
