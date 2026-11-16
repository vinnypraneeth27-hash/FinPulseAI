import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatLocalizedAmount,
  formatLocalizedAmountInput,
  parseLocalizedAmount
} from '../js/utils.js';

test('formats and parses goal amounts using Indian digit grouping', () => {
  const examples = [
    [1500, '1,500'],
    [15000, '15,000'],
    [150000, '1,50,000'],
    [1500000, '15,00,000'],
    [15000000, '1,50,00,000']
  ];

  for (const [amount, formatted] of examples) {
    assert.equal(formatLocalizedAmount(amount, 'INR'), formatted);
    assert.equal(
      formatLocalizedAmountInput(String(amount), 'INR').value,
      formatted
    );
    assert.equal(parseLocalizedAmount(formatted, 'INR'), amount);
  }
});

test('uses the selected currency locale and preserves decimal values', () => {
  assert.equal(formatLocalizedAmount(1500000.5, 'EUR'), '1.500.000,5');
  assert.equal(parseLocalizedAmount('1.500.000,50', 'EUR'), 1500000.5);
  assert.equal(parseLocalizedAmount('1,500,000.50', 'USD'), 1500000.5);
});

test('keeps the caret usable while grouping typed or edited digits', () => {
  const typed = formatLocalizedAmountInput('1500000', 'INR', 'INR', 7);
  assert.deepEqual(typed, { value: '15,00,000', caretPosition: 9 });

  const edited = formatLocalizedAmountInput('1,0,000', 'INR', 'INR', 3);
  assert.equal(edited.value, '10,000');
  assert.ok(edited.caretPosition <= edited.value.length);
});

test('reformats an existing value when its currency locale changes', () => {
  const reformatted = formatLocalizedAmountInput(
    '15,00,000',
    'INR',
    'EUR',
    9
  );
  assert.equal(reformatted.value, '1.500.000');
  assert.equal(parseLocalizedAmount(reformatted.value, 'EUR'), 1500000);
});
