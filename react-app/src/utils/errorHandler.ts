/**
 * Centralized error handling utilities
 */

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  timestamp: number;
  userAgent?: string;
  url?: string;
}

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: ErrorContext,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Logs error with context
 */
export function logError(error: Error | AppError, context?: Partial<ErrorContext>) {
  const errorContext: ErrorContext = {
    timestamp: Date.now(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    ...context
  };

  console.error('Application Error:', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    context: errorContext,
    ...(error instanceof AppError && {
      code: error.code,
      retryable: error.retryable
    })
  });

  // Send to error tracking service if available
  if (typeof window !== 'undefined' && (window as any).errorTracker) {
    (window as any).errorTracker.captureException(error, {
      contexts: { custom: errorContext }
    });
  }
}

/**
 * Creates a user-friendly error message
 */
export function getUserFriendlyMessage(error: Error | AppError): string {
  if (error instanceof AppError && error.code) {
    const messages: Record<string, string> = {
      'NETWORK_ERROR': 'Unable to connect to the server. Please check your internet connection.',
      'TIMEOUT': 'The request took too long. Please try again.',
      'UNAUTHORIZED': 'You are not authorized to perform this action.',
      'NOT_FOUND': 'The requested resource was not found.',
      'VALIDATION_ERROR': 'Please check your input and try again.',
      'SERVER_ERROR': 'The server encountered an error. Please try again later.',
      'DMX_ERROR': 'Failed to update DMX channels. Please check your connection.',
      'SCENE_ERROR': 'Failed to save or load scene. Please try again.',
      'FIXTURE_ERROR': 'Failed to update fixture. Please check the fixture configuration.'
    };
    return messages[error.code] || error.message;
  }
  return error.message || 'An unexpected error occurred. Please try again.';
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  context?: string
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        logError(lastError, { action: context || 'retry', component: 'errorHandler' });
        throw lastError;
      }
      
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, context);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Retry failed');
}

/**
 * Safe async wrapper that catches and logs errors
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    logError(error as Error, { action: context, component: 'safeAsync' });
    return null;
  }
}

/**
 * Creates a retryable error
 */
export function createRetryableError(
  message: string,
  code?: string,
  context?: Partial<ErrorContext>
): AppError {
  return new AppError(message, code, {
    timestamp: Date.now(),
    ...context
  }, true);
}

/**
 * Creates a non-retryable error
 */
export function createError(
  message: string,
  code?: string,
  context?: Partial<ErrorContext>
): AppError {
  return new AppError(message, code, {
    timestamp: Date.now(),
    ...context
  }, false);
}

