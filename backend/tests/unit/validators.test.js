import { validatePhone, formatToE164 } from '../../utils/validators.js';

describe('Phone Validator Utility', () => {
  test('should validate correct mobile numbers', () => {
    expect(validatePhone('11999998888')).toBe(true);
    expect(validatePhone('(11) 99999-8888')).toBe(true);
  });

  test('should validate correct landline numbers', () => {
    expect(validatePhone('1133334444')).toBe(true);
  });

  test('should reject invalid lengths', () => {
    expect(validatePhone('11999')).toBe(false); // Too short
    expect(validatePhone('1199999888888')).toBe(false); // Too long
  });

  test('should reject empty or null', () => {
    expect(validatePhone('')).toBe(false);
    expect(validatePhone(null)).toBe(false);
  });

  test('should format to E164', () => {
    expect(formatToE164('11999998888')).toBe('+5511999998888');
  });
});
