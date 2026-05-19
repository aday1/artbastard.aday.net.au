/**
 * Tests for Input Validation Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateDmxValue,
  validateChannelIndex,
  validateUniverse,
  validateOscAddress,
  validateIpAddress,
  validatePort,
  sanitizeString,
  RateLimiter
} from '../../utils/inputValidation';

describe('Input Validation', () => {
  describe('validateDmxValue', () => {
    it('should accept valid DMX values', () => {
      expect(validateDmxValue(0).valid).toBe(true);
      expect(validateDmxValue(128).valid).toBe(true);
      expect(validateDmxValue(255).valid).toBe(true);
    });

    it('should reject values outside range', () => {
      expect(validateDmxValue(-1).valid).toBe(false);
      expect(validateDmxValue(256).valid).toBe(false);
      expect(validateDmxValue(1000).valid).toBe(false);
    });

    it('should reject non-integers', () => {
      expect(validateDmxValue(128.5).valid).toBe(false);
      expect(validateDmxValue('128').valid).toBe(false);
    });

    it('should reject non-numbers', () => {
      expect(validateDmxValue('abc').valid).toBe(false);
      expect(validateDmxValue(null).valid).toBe(false);
      expect(validateDmxValue(undefined).valid).toBe(false);
    });
  });

  describe('validateChannelIndex', () => {
    it('should accept valid channel indices', () => {
      expect(validateChannelIndex(0).valid).toBe(true);
      expect(validateChannelIndex(255).valid).toBe(true);
      expect(validateChannelIndex(511).valid).toBe(true);
    });

    it('should reject indices outside range', () => {
      expect(validateChannelIndex(-1).valid).toBe(false);
      expect(validateChannelIndex(512).valid).toBe(false);
    });
  });

  describe('validateUniverse', () => {
    it('should accept valid universe numbers', () => {
      expect(validateUniverse(0).valid).toBe(true);
      expect(validateUniverse(32767).valid).toBe(true);
    });

    it('should reject invalid universe numbers', () => {
      expect(validateUniverse(-1).valid).toBe(false);
      expect(validateUniverse(32768).valid).toBe(false);
    });
  });

  describe('validateOscAddress', () => {
    it('should accept valid OSC addresses', () => {
      expect(validateOscAddress('/test').valid).toBe(true);
      expect(validateOscAddress('/dmx/channel1').valid).toBe(true);
      expect(validateOscAddress('/1/fader1').valid).toBe(true);
    });

    it('should reject addresses not starting with /', () => {
      expect(validateOscAddress('test').valid).toBe(false);
      expect(validateOscAddress('dmx/channel1').valid).toBe(false);
    });

    it('should reject addresses with invalid characters', () => {
      expect(validateOscAddress('/test@invalid').valid).toBe(false);
      expect(validateOscAddress('/test space').valid).toBe(false);
    });
  });

  describe('validateIpAddress', () => {
    it('should accept valid IP addresses', () => {
      expect(validateIpAddress('192.168.1.1').valid).toBe(true);
      expect(validateIpAddress('127.0.0.1').valid).toBe(true);
      expect(validateIpAddress('255.255.255.255').valid).toBe(true);
    });

    it('should reject invalid IP formats', () => {
      expect(validateIpAddress('192.168.1').valid).toBe(false);
      expect(validateIpAddress('192.168.1.1.1').valid).toBe(false);
      expect(validateIpAddress('not.an.ip').valid).toBe(false);
    });

    it('should reject IPs with invalid octets', () => {
      expect(validateIpAddress('256.1.1.1').valid).toBe(false);
      expect(validateIpAddress('192.256.1.1').valid).toBe(false);
    });
  });

  describe('validatePort', () => {
    it('should accept valid ports', () => {
      expect(validatePort(1).valid).toBe(true);
      expect(validatePort(8000).valid).toBe(true);
      expect(validatePort(65535).valid).toBe(true);
    });

    it('should reject invalid ports', () => {
      expect(validatePort(0).valid).toBe(false);
      expect(validatePort(65536).valid).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).not.toContain('<');
      expect(sanitizeString('<script>alert("xss")</script>')).not.toContain('>');
    });

    it('should limit string length', () => {
      const longString = 'a'.repeat(2000);
      expect(sanitizeString(longString, 100).length).toBeLessThanOrEqual(100);
    });
  });

  describe('RateLimiter', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter(10, 1000);
      expect(limiter.isAllowed('test')).toBe(true);
    });

    it('should block requests over limit', () => {
      const limiter = new RateLimiter(2, 1000);
      expect(limiter.isAllowed('test')).toBe(true);
      expect(limiter.isAllowed('test')).toBe(true);
      expect(limiter.isAllowed('test')).toBe(false);
    });

    it('should reset after window', () => {
      const limiter = new RateLimiter(2, 1000);
      expect(limiter.isAllowed('test')).toBe(true);
      expect(limiter.isAllowed('test')).toBe(true);
      
      // Simulate time passing
      limiter.reset('test');
      expect(limiter.isAllowed('test')).toBe(true);
    });

    it('should track remaining requests', () => {
      const limiter = new RateLimiter(10, 1000);
      limiter.isAllowed('test');
      expect(limiter.getRemaining('test')).toBe(9);
    });
  });
});

