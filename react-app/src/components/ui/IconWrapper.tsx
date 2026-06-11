import React from 'react';

/**
 * Wraps any icon component with a span that handles className and other props safely.
 * This solves the "Cannot read properties of undefined (reading 'className')" error
 * that occurs with Lucide icons.
 * 
 * @param IconComponent The icon component to wrap
 * @param props Props to pass to the icon and wrapper
 * @returns The wrapped icon component
 */
export const IconWrapper = ({ 
  IconComponent, 
  className,
  size = 24,
  strokeWidth = 1.5,
  color,
  ...restProps 
}: {
  IconComponent: React.ComponentType<any>;
  className?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  [key: string]: any;
}) => {
  if (!IconComponent) {
    console.error('Invalid IconComponent provided to IconWrapper');
    return null;
  }
  
  // Safely apply className to a container span instead of directly to the icon
  return (
    <span className={className || undefined}>
      <IconComponent
        size={size}
        color={color}
        strokeWidth={strokeWidth}
        {...restProps}
      />
    </span>
  );
};

export default IconWrapper;
