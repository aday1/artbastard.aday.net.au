import React from 'react';

export interface RackTab {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface RackTabStripProps {
  tabs: RackTab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}

export const RackTabStrip: React.FC<RackTabStripProps> = ({
  tabs,
  activeId,
  onChange,
  className = '',
  ariaLabel = 'Mode',
}) => (
  <div className={`ab-rack-tabstrip ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={tab.id === activeId}
        disabled={tab.disabled}
        className={`ab-rack-tab ${tab.id === activeId ? 'ab-rack-tab--active' : ''}`}
        onClick={() => onChange(tab.id)}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
