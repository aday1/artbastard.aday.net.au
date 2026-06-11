/**
 * Lazy Loader Component
 * Provides lazy loading wrapper for components
 */

import React, { Suspense, ComponentType, LazyExoticComponent } from 'react';

interface LazyLoaderProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Lazy loader wrapper with suspense boundary
 */
export const LazyLoader: React.FC<LazyLoaderProps> = ({ 
  fallback = <div>Loading...</div>, 
  children 
}) => {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
};

/**
 * Create a lazy-loaded component with default fallback
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
): LazyExoticComponent<T> {
  const LazyComponent = React.lazy(importFn);
  
  return LazyComponent;
}

/**
 * Preload a lazy component
 */
export function preloadLazyComponent(
  importFn: () => Promise<{ default: ComponentType<any> }>
): void {
  importFn();
}

