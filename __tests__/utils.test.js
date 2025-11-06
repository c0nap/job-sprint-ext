/**
 * Unit tests for utility functions
 */

const {
  isValidEmail,
  isValidPhone,
  sanitizeText,
  formatDate,
  deepClone,
  debounce,
  generateId
} = require('../utils');

describe('Utility Functions', () => {
  describe('isValidEmail', () => {
    test('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    test('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    test('should validate correct phone numbers', () => {
      expect(isValidPhone('1234567890')).toBe(true);
      expect(isValidPhone('(123) 456-7890')).toBe(true);
      expect(isValidPhone('123-456-7890')).toBe(true);
    });

    test('should reject invalid phone numbers', () => {
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('abcdefghij')).toBe(false);
    });
  });

  describe('sanitizeText', () => {
    test('should trim and normalize whitespace', () => {
      expect(sanitizeText('  hello   world  ')).toBe('hello world');
      expect(sanitizeText('test\n\nmultiple\n\nlines')).toBe('test multiple lines');
    });
  });

  describe('formatDate', () => {
    test('should format timestamp correctly', () => {
      const timestamp = new Date('2024-01-01T12:00:00').getTime();
      const formatted = formatDate(timestamp);
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('2024');
    });
  });

  describe('deepClone', () => {
    test('should create independent copy of object', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = deepClone(original);

      cloned.b.c = 3;

      expect(original.b.c).toBe(2);
      expect(cloned.b.c).toBe(3);
    });
  });

  describe('debounce', () => {
    // Use fake timers for predictable timing control
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('should delay function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);

      debouncedFn();

      // Function should not be called immediately
      expect(mockFn).not.toHaveBeenCalled();

      // Fast-forward time by 500ms
      jest.advanceTimersByTime(500);

      // Function should now be called
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should cancel previous call when invoked again within wait time', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);

      // Call three times in quick succession
      debouncedFn();
      jest.advanceTimersByTime(100);
      debouncedFn();
      jest.advanceTimersByTime(100);
      debouncedFn();

      // Function should not be called yet
      expect(mockFn).not.toHaveBeenCalled();

      // Fast-forward to complete the last debounce
      jest.advanceTimersByTime(500);

      // Function should be called only once (last call)
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should pass arguments to debounced function', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);

      debouncedFn('test', 123, { key: 'value' });
      jest.advanceTimersByTime(500);

      expect(mockFn).toHaveBeenCalledWith('test', 123, { key: 'value' });
    });

    test('should handle multiple arguments correctly', () => {
      const mockFn = jest.fn((a, b, c) => a + b + c);
      const debouncedFn = debounce(mockFn, 500);

      debouncedFn(1, 2, 3);
      jest.advanceTimersByTime(500);

      expect(mockFn).toHaveBeenCalledWith(1, 2, 3);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should use most recent arguments when called multiple times', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);

      debouncedFn('first');
      jest.advanceTimersByTime(100);
      debouncedFn('second');
      jest.advanceTimersByTime(100);
      debouncedFn('third');

      jest.advanceTimersByTime(500);

      // Should be called with the last set of arguments
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('third');
    });

    test('should work with different wait times', () => {
      const mockFn = jest.fn();
      const debouncedShort = debounce(mockFn, 100);
      const debouncedLong = debounce(mockFn, 1000);

      debouncedShort('short');
      debouncedLong('long');

      // After 100ms, short should be called
      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('short');

      // After another 900ms (total 1000ms), long should be called
      jest.advanceTimersByTime(900);
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('long');
    });

    test('should allow function to be called again after wait period', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);

      // First call
      debouncedFn('first');
      jest.advanceTimersByTime(500);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('first');

      // Second call after wait period
      debouncedFn('second');
      jest.advanceTimersByTime(500);
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('second');
    });

    test('should handle rapid consecutive calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);

      // Simulate rapid typing (10 calls in 100ms)
      for (let i = 0; i < 10; i++) {
        debouncedFn(i);
        jest.advanceTimersByTime(10);
      }

      // Function should not be called yet
      expect(mockFn).not.toHaveBeenCalled();

      // Wait for debounce to complete
      jest.advanceTimersByTime(500);

      // Should be called only once with last value
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(9);
    });

    test('should handle empty arguments', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);

      debouncedFn();
      jest.advanceTimersByTime(500);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith();
    });

    test('should work with functions that return values', () => {
      const mockFn = jest.fn((x) => x * 2);
      const debouncedFn = debounce(mockFn, 500);

      debouncedFn(5);
      jest.advanceTimersByTime(500);

      expect(mockFn).toHaveBeenCalledWith(5);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateId', () => {
    test('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });
});
