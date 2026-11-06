import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateFinancialHealthAssessment,
  FINANCIAL_HEALTH_COMPONENTS,
  getFinancialHealthScoreLabel
} from '../js/financialHealthScore.js';

function transaction(type, amount, date, currency = 'INR', category = 'Food') {
  return {
    transaction_type: type,
    amount,
    expense_date: date,
    currency,
    category
  };
}

function budget(category, amount, month = '2026-10', currency = 'INR') {
  return { category, amount, currency, period_start: `${month}-01` };
}

function assess(overrides = {}) {
  return calculateFinancialHealthAssessment({
    expenses: [],
    savings: [],
    budgets: [],
    dataCompleteness: { expenses: true, savings: true, budgets: true },
    currency: 'INR',
    assessmentMonth: '2026-10',
    dateLimit: '2026-10-31',
    ...overrides
  });
}

const income = transaction('income', 1000, '2026-10-02');

test('uses only the three simplified indicators and their approved weights', () => {
  assert.deepEqual(FINANCIAL_HEALTH_COMPONENTS, [
    { key: 'spending_control', label: 'Spending Control', weight: 40 },
    { key: 'saving_habits', label: 'Saving Habits', weight: 30 },
    { key: 'budget_management', label: 'Budget Management', weight: 30 }
  ]);
  const result = assess();
  assert.deepEqual(Object.keys(result.component_scores), [
    'spending_control', 'saving_habits', 'budget_management'
  ]);
  assert.equal(result.score, null);
  assert.equal(result.available_weight, 0);
  assert.equal(result.coverage_percentage, 0);
  assert.equal(result.available_component_count, 0);
});

test('scores spending against actual matching-month and matching-currency income/expenses', () => {
  const result = assess({
    expenses: [
      income,
      transaction('expense', 500, '2026-10-03'),
      transaction('expense', 900, '2026-09-30'),
      transaction('refund', 100, '2026-10-04')
    ]
  });
  const spending = result.component_scores.spending_control;
  assert.equal(spending.available, true);
  assert.equal(spending.weight, 40);
  assert.equal(spending.earned, 40);
  assert.equal(spending.metrics.monthlyIncome, 1000);
  assert.equal(spending.metrics.monthlyExpenses, 500);
  assert.equal(spending.metrics.qualifyingIncomeRecords, 1);
  assert.equal(spending.metrics.qualifyingExpenseRecords, 1);
  assert.equal(spending.metrics.expenseRatio, 50);
});

test('applies spending-control point tiers at every ratio boundary', () => {
  const cases = [
    [50, 40],
    [50.01, 32],
    [70, 32],
    [70.01, 19],
    [90, 19],
    [90.01, 8],
    [100, 8],
    [100.01, 0]
  ];
  for (const [ratio, earned] of cases) {
    const result = assess({
      expenses: [transaction('income', 100, '2026-10-02'), transaction('expense', ratio, '2026-10-03')]
    });
    assert.equal(result.component_scores.spending_control.earned, earned, `${ratio}%`);
  }
});

test('a verified empty expense result is zero spending, while missing income is insufficient', () => {
  const zeroExpenses = assess({ expenses: [income] });
  assert.equal(zeroExpenses.component_scores.spending_control.available, true);
  assert.equal(zeroExpenses.component_scores.spending_control.metrics.monthlyExpenses, 0);
  assert.equal(zeroExpenses.component_scores.spending_control.earned, 40);

  const noIncome = assess({
    expenses: [transaction('expense', 100, '2026-10-03')]
  });
  assert.equal(noIncome.component_scores.spending_control.available, false);
  assert.match(noIncome.component_scores.spending_control.reason, /No current-month income record/);
});

test('marks spending and savings unavailable for incomplete transaction reads', () => {
  const result = assess({
    expenses: [income],
    dataCompleteness: { expenses: false, savings: true, budgets: true }
  });
  assert.equal(result.component_scores.spending_control.available, false);
  assert.equal(result.component_scores.saving_habits.available, false);
  assert.match(result.component_scores.spending_control.reason, /query did not complete/);
});

test('scores savings from genuine contributions only; transfers and withdrawals do not add savings', () => {
  const result = assess({
    expenses: [income],
    savings: [
      { amount: 200, currency: 'INR', savings_date: '2026-10-04', record_type: 'contribution' },
      { amount: 500, currency: 'INR', savings_date: '2026-10-05', record_type: 'transfer' },
      { amount: 300, currency: 'INR', savings_date: '2026-10-06', record_type: 'withdrawal' }
    ]
  });
  const savings = result.component_scores.saving_habits;
  assert.equal(savings.available, true);
  assert.equal(savings.weight, 30);
  assert.equal(savings.earned, 30);
  assert.equal(savings.metrics.genuineContributions, 200);
  assert.equal(savings.metrics.qualifyingContributionRecords, 1);
  assert.equal(savings.metrics.savingsRate, 20);
});

test('applies saving-habits point tiers at every savings-rate boundary', () => {
  const cases = [
    [0, 0],
    [0.01, 6],
    [4.99, 6],
    [5, 12],
    [9.99, 12],
    [10, 18],
    [14.99, 18],
    [15, 24],
    [19.99, 24],
    [20, 30]
  ];
  for (const [rate, earned] of cases) {
    const savings = rate === 0
      ? []
      : [{ amount: rate * 10, currency: 'INR', savings_date: '2026-10-04', record_type: 'contribution' }];
    const result = assess({ expenses: [income], savings });
    assert.equal(result.component_scores.saving_habits.earned, earned, `${rate}%`);
  }
});

test('a successful savings query with no contributions scores zero instead of unavailable', () => {
  const result = assess({
    expenses: [income],
    savings: [
      { amount: 50, currency: 'INR', savings_date: '2026-10-04', record_type: 'transfer' },
      { amount: 10, currency: 'INR', savings_date: '2026-10-05', record_type: 'withdrawal' }
    ]
  });
  assert.equal(result.component_scores.saving_habits.available, true);
  assert.equal(result.component_scores.saving_habits.earned, 0);
  assert.equal(result.component_scores.saving_habits.metrics.genuineContributions, 0);
});

test('marks saving habits unavailable without positive compatible income or complete savings reads', () => {
  const noIncome = assess({
    savings: [{ amount: 100, currency: 'INR', savings_date: '2026-10-04', record_type: 'contribution' }]
  });
  assert.equal(noIncome.component_scores.saving_habits.available, false);

  const incompleteSavings = assess({
    expenses: [income],
    dataCompleteness: { expenses: true, savings: false, budgets: true }
  });
  assert.equal(incompleteSavings.component_scores.saving_habits.available, false);
  assert.match(incompleteSavings.component_scores.saving_habits.reason, /Savings query did not complete/);
});

test('marks budget management unavailable without a valid matching-month budget', () => {
  const result = assess({
    expenses: [income, transaction('expense', 300, '2026-10-03')]
  });
  assert.equal(result.component_scores.budget_management.available, false);
  assert.equal(result.component_scores.budget_management.weight, 30);
  assert.match(result.component_scores.budget_management.reason, /No valid current-month budget/);
});

test('scores spending against total current-month category budgets and matching expense records', () => {
  const result = assess({
    expenses: [
      income,
      transaction('expense', 600, '2026-10-03', 'INR', 'Food'),
      transaction('expense', 300, '2026-10-04', 'INR', 'Travel'),
      transaction('expense', 400, '2026-10-05', 'INR', 'Unbudgeted')
    ],
    budgets: [budget('Food', 500), budget('Travel', 500)]
  });
  const component = result.component_scores.budget_management;
  assert.equal(component.available, true);
  assert.equal(component.earned, 24);
  assert.equal(component.metrics.totalMatchedSpending, 900);
  assert.equal(component.metrics.totalMatchedBudget, 1000);
  assert.equal(component.metrics.budgetUsage, 90);
  assert.equal(component.metrics.qualifyingExpenseRecords, 2);
});

test('applies budget-management point tiers at every usage boundary', () => {
  const cases = [
    [80, 30],
    [80.01, 24],
    [100, 24],
    [100.01, 15],
    [110, 15],
    [110.01, 8],
    [125, 8],
    [125.01, 0]
  ];
  for (const [usage, earned] of cases) {
    const result = assess({
      expenses: [transaction('expense', usage, '2026-10-03')],
      budgets: [budget('Food', 100)]
    });
    assert.equal(result.component_scores.budget_management.earned, earned, `${usage}%`);
  }
});

test('does not score known empty expenses as zero when unknown-currency expenses exist', () => {
  const result = assess({
    expenses: [
      income,
      { ...transaction('expense', 200, '2026-10-03'), currency: null }
    ],
    budgets: [budget('Food', 500)]
  });
  assert.equal(result.component_scores.spending_control.available, false);
  assert.match(result.component_scores.spending_control.reason, /unknown currency/);
  assert.equal(result.component_scores.budget_management.available, false);
});

test('marks indicators unavailable instead of treating mismatched-currency spending as zero', () => {
  const result = assess({
    expenses: [
      income,
      transaction('expense', 400, '2026-10-05', 'USD'),
      transaction('income', 500, '2026-10-06', 'USD')
    ],
    budgets: [budget('Food', 500)]
  });
  assert.equal(result.component_scores.spending_control.available, false);
  assert.match(result.component_scores.spending_control.reason, /different currency/);
  assert.equal(result.component_scores.budget_management.available, false);
  assert.match(result.component_scores.budget_management.reason, /different currency/);
  assert.equal(result.component_scores.saving_habits.available, false);
});

test('excludes out-of-assessment-month rows from score inputs', () => {
  const result = assess({
    expenses: [income, transaction('expense', 100, '2026-11-01')],
    budgets: [budget('Food', 500)]
  });
  assert.equal(result.component_scores.spending_control.metrics.monthlyExpenses, 0);
  assert.equal(result.component_scores.spending_control.metrics.qualifyingExpenseRecords, 0);
  assert.equal(result.component_scores.budget_management.metrics.totalMatchedSpending, 0);
});

test('normalizes scores to available weights when budget is absent', () => {
  const result = assess({
    expenses: [income],
    savings: [{ amount: 200, currency: 'INR', savings_date: '2026-10-04', record_type: 'contribution' }]
  });
  assert.equal(result.component_scores.spending_control.earned, 40);
  assert.equal(result.component_scores.saving_habits.earned, 30);
  assert.equal(result.component_scores.budget_management.available, false);
  assert.equal(result.available_weight, 70);
  assert.equal(result.coverage_percentage, 70);
  assert.equal(result.score, 100);
});

test('returns insufficient data when fewer than two indicators or less than 60 weight are available', () => {
  const oneIndicator = assess({
    expenses: [],
    budgets: [budget('Food', 500)]
  });
  assert.equal(oneIndicator.component_scores.budget_management.available, true);
  assert.equal(oneIndicator.score, null);
  assert.equal(oneIndicator.available_weight, 30);
  assert.match(oneIndicator.insufficient_data_reason, /at least 2 available indicators/);
});

test('requires current-month matching profile-currency income for savings and spending', () => {
  const result = assess({
    expenses: [transaction('income', 1000, '2026-10-01', 'USD')],
    savings: [],
    budgets: [budget('Food', 500)]
  });
  assert.equal(result.component_scores.spending_control.available, false);
  assert.equal(result.component_scores.saving_habits.available, false);
  assert.equal(result.available_weight, 30);
});

test('uses the requested score interpretation categories and boundaries', () => {
  const cases = [
    [90, 'Excellent'],
    [75, 'Very Good'],
    [60, 'Good'],
    [40, 'Needs Improvement'],
    [39, 'Needs Attention']
  ];
  for (const [score, label] of cases) assert.equal(getFinancialHealthScoreLabel(score), label);
});

test('rejects invalid assessment months and date limits', () => {
  assert.throws(() => assess({ assessmentMonth: '2026-13' }), /YYYY-MM/);
  assert.throws(() => assess({ dateLimit: '2026-11-01' }), /Assessment date limit/);
});
