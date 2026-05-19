import React from 'react';

export interface RackModuleProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export const RackModule: React.FC<RackModuleProps> = ({
  title,
  actions,
  children,
  className = '',
  bodyClassName = '',
}) => (
  <section className={`ab-rack-module ${className}`.trim()}>
    <header className="ab-rack-module__head">
      <div className="ab-rack-module__title">{title}</div>
      {actions ? <div className="ab-rack-module__actions">{actions}</div> : null}
    </header>
    <div className={`ab-rack-module__body ${bodyClassName}`.trim()}>{children}</div>
  </section>
);
