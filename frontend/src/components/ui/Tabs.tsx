/* Tabs.tsx — design.md §87 */

import { type ReactNode, useEffect, useState } from 'react';

interface Tab {
  key: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  /** Initial selection. Ignored once `selectedKey` is supplied. */
  defaultKey?: string;
  /** Controlled selection.
   *
   * Tabs normally own their selection. A caller whose tab list is driven by the
   * URL (Settings, where a section is linkable and the back button must work)
   * cannot use internal state alone: navigating to a section directly would
   * leave the wrong tab highlighted. Passing `selectedKey` keeps the two in
   * step, and the effect below re-syncs after such a navigation. */
  selectedKey?: string;
  className?: string;
  onChange?: (key: string) => void;
}

export function Tabs({ tabs, defaultKey, selectedKey, className = '', onChange }: TabsProps) {
  const [active, setActive] = useState(selectedKey ?? defaultKey ?? tabs[0]?.key ?? '');

  /* Follow an external selection change (a route parameter, typically). */
  useEffect(() => {
    if (selectedKey !== undefined) { setActive(selectedKey); }
  }, [selectedKey]);

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
