/**
 * Accessibility Utilities
 * Provides helpers for ARIA labels, keyboard navigation, screen reader support
 */

/**
 * Generate ARIA label for DMX channel
 */
export function getChannelAriaLabel(
  channelIndex: number,
  value: number,
  channelName?: string,
  fixtureName?: string
): string {
  const channelNum = channelIndex + 1;
  const percent = Math.round((value / 255) * 100);
  const name = channelName || `Channel ${channelNum}`;
  const fixture = fixtureName ? ` of ${fixtureName}` : '';
  
  return `${name}${fixture}, ${percent} percent, DMX channel ${channelNum}`;
}

/**
 * Generate ARIA label for button with action
 */
export function getButtonAriaLabel(
  action: string,
  target?: string,
  state?: string
): string {
  let label = action;
  if (target) {
    label += ` ${target}`;
  }
  if (state) {
    label += `, ${state}`;
  }
  return label;
}

/**
 * Generate ARIA live region announcement
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Keyboard navigation helpers
 */
export interface KeyboardNavigationOptions {
  onEnter?: () => void;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  onPageUp?: () => void;
  onPageDown?: () => void;
  onTab?: () => void;
  onShiftTab?: () => void;
  preventDefault?: boolean;
}

/**
 * Handle keyboard navigation
 */
export function handleKeyboardNavigation(
  event: React.KeyboardEvent,
  options: KeyboardNavigationOptions
): boolean {
  const {
    onEnter,
    onEscape,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onHome,
    onEnd,
    onPageUp,
    onPageDown,
    onTab,
    onShiftTab,
    preventDefault = true
  } = options;

  let handled = false;

  switch (event.key) {
    case 'Enter':
    case ' ':
      if (onEnter) {
        onEnter();
        handled = true;
      }
      break;
    case 'Escape':
      if (onEscape) {
        onEscape();
        handled = true;
      }
      break;
    case 'ArrowUp':
      if (onArrowUp) {
        onArrowUp();
        handled = true;
      }
      break;
    case 'ArrowDown':
      if (onArrowDown) {
        onArrowDown();
        handled = true;
      }
      break;
    case 'ArrowLeft':
      if (onArrowLeft) {
        onArrowLeft();
        handled = true;
      }
      break;
    case 'ArrowRight':
      if (onArrowRight) {
        onArrowRight();
        handled = true;
      }
      break;
    case 'Home':
      if (onHome) {
        onHome();
        handled = true;
      }
      break;
    case 'End':
      if (onEnd) {
        onEnd();
        handled = true;
      }
      break;
    case 'PageUp':
      if (onPageUp) {
        onPageUp();
        handled = true;
      }
      break;
    case 'PageDown':
      if (onPageDown) {
        onPageDown();
        handled = true;
      }
      break;
    case 'Tab':
      if (event.shiftKey && onShiftTab) {
        onShiftTab();
        handled = true;
      } else if (onTab) {
        onTab();
        handled = true;
      }
      break;
  }

  if (handled && preventDefault) {
    event.preventDefault();
    event.stopPropagation();
  }

  return handled;
}

/**
 * Focus management
 */
export function focusElement(selector: string | HTMLElement): boolean {
  const element = typeof selector === 'string' 
    ? document.querySelector(selector) as HTMLElement
    : selector;
  
  if (element && typeof element.focus === 'function') {
    element.focus();
    return true;
  }
  return false;
}

/**
 * Trap focus within a container
 */
export function createFocusTrap(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleTab);
  firstElement?.focus();

  return () => {
    container.removeEventListener('keydown', handleTab);
  };
}

/**
 * High contrast mode detection
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Reduced motion detection
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Generate unique ID for ARIA relationships
 */
let idCounter = 0;
export function generateAriaId(prefix: string = 'aria'): string {
  return `${prefix}-${++idCounter}-${Date.now()}`;
}

