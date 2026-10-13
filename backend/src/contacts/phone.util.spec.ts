import { normalizePhone, phoneDigits } from './phone.util';

describe('phone utils', () => {
  it('extracts digits', () => {
    expect(phoneDigits('(220) 454-6754')).toBe('2204546754');
  });

  it.each([
    ['2204546754', '220-454-6754'],
    ['(220) 454-6754', '220-454-6754'],
    ['220.454.6754', '220-454-6754'],
    ['  220 454 6754 ', '220-454-6754'],
  ])('formats 10-digit number %p as %p', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('keeps international numbers as entered, collapsing whitespace', () => {
    expect(normalizePhone(' +44  20 7946 0958 ')).toBe('+44 20 7946 0958');
  });
});
