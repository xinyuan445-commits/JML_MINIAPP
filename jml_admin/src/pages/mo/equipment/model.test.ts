import { capacityLabel, displayDecimal } from './model';

test('finite, unlimited and incomplete standards have separate labels', () => {
  expect(
    capacityLabel({
      capacity_mode: 'finite',
      quantity: '400',
      unit: '件',
      period: 'day',
      effective_hours: '8',
    }),
  ).toBe('400件/天');
  expect(capacityLabel({ capacity_mode: 'unlimited' })).toBe('无限产能');
  expect(
    capacityLabel({
      capacity_mode: 'finite',
      quantity: '400',
      unit: '件',
      period: 'day',
    }),
  ).toBe('待补');
});

test('formatting keeps unknowns and tiny positive values distinct from zero', () => {
  expect(displayDecimal(null)).toBe('—');
  expect(displayDecimal('0')).toBe('0');
  expect(displayDecimal('0.00000000048')).toBe('<0.0001');
  expect(displayDecimal('1.200000')).toBe('1.2');
});
