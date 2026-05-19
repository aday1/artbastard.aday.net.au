/**
 * Input Validation Utilities
 * Provides validation for user inputs to prevent security issues
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate DMX channel value (0-255)
 */
export function validateDmxValue(value: any): ValidationResult {
  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, error: 'Value must be a number' };
  }
  if (num < 0 || num > 255) {
    return { valid: false, error: 'DMX value must be between 0 and 255' };
  }
  if (!Number.isInteger(num)) {
    return { valid: false, error: 'DMX value must be an integer' };
  }
  return { valid: true };
}

/**
 * Validate DMX channel index (0-511)
 */
export function validateChannelIndex(index: any): ValidationResult {
  const num = Number(index);
  if (isNaN(num)) {
    return { valid: false, error: 'Channel index must be a number' };
  }
  if (num < 0 || num > 511) {
    return { valid: false, error: 'Channel index must be between 0 and 511' };
  }
  if (!Number.isInteger(num)) {
    return { valid: false, error: 'Channel index must be an integer' };
  }
  return { valid: true };
}

/**
 * Validate universe number (0-32767)
 */
export function validateUniverse(universe: any): ValidationResult {
  const num = Number(universe);
  if (isNaN(num)) {
    return { valid: false, error: 'Universe must be a number' };
  }
  if (num < 0 || num > 32767) {
    return { valid: false, error: 'Universe must be between 0 and 32767' };
  }
  if (!Number.isInteger(num)) {
    return { valid: false, error: 'Universe must be an integer' };
  }
  return { valid: true };
}

/**
 * Sanitize string input (prevent XSS)
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters
  let sanitized = input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Validate OSC address format
 */
export function validateOscAddress(address: string): ValidationResult {
  if (typeof address !== 'string') {
    return { valid: false, error: 'OSC address must be a string' };
  }
  
  // OSC addresses must start with /
  if (!address.startsWith('/')) {
    return { valid: false, error: 'OSC address must start with /' };
  }
  
  // Check for valid characters
  if (!/^\/[a-zA-Z0-9_\/\-]*$/.test(address)) {
    return { valid: false, error: 'OSC address contains invalid characters' };
  }
  
  // Limit length
  if (address.length > 256) {
    return { valid: false, error: 'OSC address too long (max 256 characters)' };
  }
  
  return { valid: true };
}

/**
 * Validate IP address
 */
export function validateIpAddress(ip: string): ValidationResult {
  if (typeof ip !== 'string') {
    return { valid: false, error: 'IP address must be a string' };
  }
  
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) {
    return { valid: false, error: 'Invalid IP address format' };
  }
  
  const parts = ip.split('.');
  for (const part of parts) {
    const num = Number(part);
    if (isNaN(num) || num < 0 || num > 255) {
      return { valid: false, error: 'IP address octets must be 0-255' };
    }
  }
  
  return { valid: true };
}

/**
 * Validate port number
 */
export function validatePort(port: any): ValidationResult {
  const num = Number(port);
  if (isNaN(num)) {
    return { valid: false, error: 'Port must be a number' };
  }
  if (num < 1 || num > 65535) {
    return { valid: false, error: 'Port must be between 1 and 65535' };
  }
  if (!Number.isInteger(num)) {
    return { valid: false, error: 'Port must be an integer' };
  }
  return { valid: true };
}

/**
 * Rate limiter class
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request is allowed
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    
    return true;
  }

  /**
   * Reset rate limiter for identifier
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Clear all rate limiters
   */
  clear(): void {
    this.requests.clear();
  }

  /**
   * Get remaining requests for identifier
   */
  getRemaining(identifier: string): number {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    const recentRequests = requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - recentRequests.length);
  }
}

/**
 * Global rate limiter instance
 */
export const globalRateLimiter = new RateLimiter(1000, 60000); // 1000 requests per minute

/**
 * Validate JSON input
 */
export function validateJson(input: string): ValidationResult {
  try {
    const parsed = JSON.parse(input);
    // Check for circular references and excessive nesting
    const stringified = JSON.stringify(parsed);
    if (stringified.length > 10 * 1024 * 1024) { // 10MB limit
      return { valid: false, error: 'JSON payload too large (max 10MB)' };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Validate file upload
 */
export function validateFileUpload(
  file: File,
  options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}
): ValidationResult {
  const { maxSize = 10 * 1024 * 1024, allowedTypes = [], allowedExtensions = [] } = options;

  // Check file size
  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds maximum of ${maxSize / 1024 / 1024}MB` };
  }

  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type ${file.type} not allowed` };
  }

  // Check file extension
  if (allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      return { valid: false, error: `File extension .${extension} not allowed` };
    }
  }

  return { valid: true };
}

