import React from 'react';
import * as Icons from 'lucide-react';
import type { LucideProps } from 'lucide-react';

// Define LucideIconProps to include all common Lucide icon properties
interface LucideIconProps {
  name: keyof typeof Icons;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  [key: string]: any; // Allow any other props to be passed through
}

/**
 * A wrapper component for Lucide icons that safely handles the className property.
 * This solves the "Cannot read properties of undefined (reading 'className')" error.
 */
export const LucideIcon = ({ 
  name, 
  size = 24, 
  color, 
  strokeWidth = 1.5,
  className,
  ...restProps 
}: LucideIconProps) => {
  // Get the icon component from the imported Icons
  const IconComponent = Icons[name] as React.ComponentType<LucideProps>;
  
  if (!IconComponent) {
    console.error(`Icon "${String(name)}" does not exist in lucide-react package.`);
    console.log('Available icons:', Object.keys(Icons).slice(0, 20).join(', ') + '...');
    return <span className={className}>❓</span>;
  }

  try {
    // The span wrapper prevents the className error by being applied to the span instead
    return (
      <span className={className}>
        {/* Use TypeScript casting to avoid JSX type issues */}
        <IconComponent 
          size={size} 
          color={color} 
          strokeWidth={strokeWidth}
          {...restProps} 
        />
      </span>
    );
  } catch (error) {
    console.error(`Error rendering icon "${String(name)}":`, error);
    return <span className={className}>⚠️</span>;
  }
};

/**
 * Helper function to wrap any Lucide icon component in a span with className
 * Use this when you have a direct reference to an icon component
 */
export const wrapLucideIcon = (
  IconComponent: React.ComponentType<any>,
  props: { className?: string; size?: number; color?: string; strokeWidth?: number; [key: string]: any }
) => {
  const { className, ...iconProps } = props;
  return (
    <span className={className}>
      <IconComponent {...iconProps} />
    </span>
  );
};

export default LucideIcon;