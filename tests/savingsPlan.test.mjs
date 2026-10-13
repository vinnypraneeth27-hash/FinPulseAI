import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateSavingsPlan,
  extractMonthlyIncomeFromText
} from '../js/savingsPlan.js';

test('calculates selected savings target and three projections from income', () => {
  const plan = calculateSavingsPlan(10000, 4000, 20);
  assert.deepEqual(plan, {
    status: 'ready',
    monthlyIncome: 10000,
    monthlyExpenses: 4000,
    availableBalance: 6000,
    percentage: 20,
    monthlyTarget: 2000,
    monthlySavings: 2000,
    projections: { 3: 6000, 6: 12000, 12: 24000 }
  });
});

test('caps savings at positive available balance without claiming the full balance is spendable', () => {
  const plan = calculateSavingsPlan(10000, 9500, 20);
  assert.equal(plan.monthlyTarget, 2000);
  assert.equal(plan.monthlySavings, 500);
  assert.equal(plan.projections[6], 3000);
});

test('does not recommend a positive target when expenses meet or exceed income', () => {
  const deficit = calculateSavingsPlan(10000, 10500, 10);
  assert.equal(deficit.status, 'expenses_exceed_income');
  assert.equal(deficit.monthlySavings, 0);
  assert.equal(deficit.projections[12], 0);

  const breakEven = calculateSavingsPlan(10000, 10000, 30);
  assert.equal(breakEven.status, 'no_available_balance');
  assert.equal(breakEven.monthlySavings, 0);
});

test('reports missing income and rejects invalid expenses or savings percentages', () => {
  assert.equal(calculateSavingsPlan(null, 0, 20).status, 'missing_income');
  assert.throws(() => calculateSavingsPlan(1000, -1, 20), /non-negative/);
  assert.throws(() => calculateSavingsPlan(1000, 0, 15), /10, 20, or 30/);
});

test('extracts only an amount directly associated with income in chat messages', () => {
  assert.deepEqual(extractMonthlyIncomeFromText('I earn ₹10,000 per month. How much should I save?', 'USD'), {
    amount: 10000,
    currency: 'INR'
  });
  assert.deepEqual(extractMonthlyIncomeFromText('My income is 2.5k monthly', 'USD'), {
    amount: 2500,
    currency: 'USD'
  });
  assert.deepEqual(extractMonthlyIncomeFromText('My income is CAD 1,500 per month', 'INR'), {
    amount: 1500,
    currency: 'CAD'
  });
  assert.deepEqual(extractMonthlyIncomeFromText('I earn CA$1,500 monthly', 'USD'), {
    amount: 1500,
    currency: 'CAD'
  });
  assert.equal(extractMonthlyIncomeFromText('How much should I save in 6 months?', 'INR'), null);
});
