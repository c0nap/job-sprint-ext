/**
 * Unit tests for utility functions
 */

const {
  isValidEmail,
  isValidPhone,
  sanitizeText,
  formatDate,
  deepClone,
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
