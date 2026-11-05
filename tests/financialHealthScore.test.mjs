import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateFinancialHealthAssessment,
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

function budget(category, amount, month = '2026-10', currency = 'INR', isEssential = false) {
  return {
    category,
    amount,
    currency,
    period_start: `${month}-01`,
    is_essential: isEssential
  };
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

function currentIncomeExpense(income = 1000, expenses = 500) {
  return [
    transaction('income', income, '2026-10-02'),
    transaction('expense', expenses, '2026-10-03')
  ];
}

function previousThreePositiveMonths() {
  return [
    transaction('income', 1000, '2026-07-02'),
    transaction('expense', 500, '2026-07-03'),
    transaction('income', 1000, '2026-08-02'),
    transaction('expense', 500, '2026-08-03'),
    transaction('income', 1000, '2026-09-02'),
    transaction('expense', 500, '2026-09-03')
  ];
}

function previousThreeEssentialBudgets() {
  return [
    budget('Rent', 1000, '2026-09', 'INR', true),
    budget('Rent', 1000, '2026-08', 'INR', true),
    budget('Rent', 1000, '2026-07', 'INR', true)
  ];
}

test('no financial data returns insufficient data without zero-valued components', () => {
  const result = assess();

  assert.equal(result.score, null);
  assert.equal(result.label, 'Insufficient Data');
  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.component_scores.financial_consistency.available, true);
  assert.equal(result.component_scores.financial_consistency.earned, 0);
  assert.equal(result.available_weight, 15);
  assert.equal(result.coverage_percentage, 15);
  assert.match(result.insufficient_data_reason, /15% weight across 1 of 5 indicators/);
  assert.match(result.insufficient_data_reason, /Emergency Preparedness: A complete, verified emergency savings opening balance and movement history is unavailable/);
});

test('marks components unavailable when their underlying query did not complete', () => {
  const result = assess({
    expenses: currentIncomeExpense(),
    dataCompleteness: { expenses: false, savings: true, budgets: true }
  });
  assert.equal(result.component_scores.spending_control.available, false);
  assert.equal(result.component_scores.financial_consistency.available, false);
});

test('income and expense data alone is insufficient to publish a score', () => {
  const result = assess({
    expenses: [
      ...currentIncomeExpense(),
      ...previousThreePositiveMonths()
    ],
    dataCompleteness: { expenses: true, savings: false, budgets: false }
  });

  assert.equal(result.component_scores.spending_control.earned, 25);
  assert.equal(result.component_scores.financial_consistency.earned, 15);
  assert.equal(result.available_weight, 40);
  assert.equal(result.score, null);
});

test('applies the approved Spending Control thresholds at every boundary', () => {
  const cases = [
    [50, 25],
    [50.01, 20],
    [70, 20],
    [70.01, 12],
    [90, 12],
    [90.01, 5],
    [100, 5],
    [100.01, 0]
  ];

  for (const [expenseAmount, expected] of cases) {
    const result = assess({
      expenses: currentIncomeExpense(100, expenseAmount)
    });
    assert.equal(result.component_scores.spending_control.earned, expected, `${expenseAmount}%`);
  }
});

test('counts genuine savings contributions and excludes internal transfers', () => {
  const result = assess({
    expenses: currentIncomeExpense(1000, 500),
    savings: [
      { amount: 150, currency: 'INR', savings_date: '2026-10-04', record_type: 'contribution' },
      { amount: 900, currency: 'INR', savings_date: '2026-10-05', record_type: 'transfer' }
    ]
  });
  assert.equal(result.component_scores.saving_habits.metrics.genuineContributions, 150);
  assert.equal(result.component_scores.saving_habits.metrics.savingsRate, 15);
  assert.equal(result.component_scores.saving_habits.earned, 20);

  const transferOnly = assess({
    expenses: currentIncomeExpense(),
    savings: [
      { amount: 200, currency: 'INR', savings_date: '2026-10-04', record_type: 'transfer' }
    ]
  });
  assert.equal(transferOnly.component_scores.saving_habits.earned, 0);
  assert.equal(transferOnly.component_scores.saving_habits.metrics.genuineContributions, 0);
});

test('scores zero expenses and zero contributions when those empty results are complete', () => {
  const result = assess({
    expenses: [transaction('income', 1000, '2026-10-02')],
    savings: [],
    dataCompleteness: { expenses: true, savings: true, budgets: true }
  });
  assert.equal(result.component_scores.spending_control.available, true);
  assert.equal(result.component_scores.spending_control.metrics.monthlyExpenses, 0);
  assert.equal(result.component_scores.spending_control.earned, 25);
  assert.equal(result.component_scores.saving_habits.available, true);
  assert.equal(result.component_scores.saving_habits.metrics.genuineContributions, 0);
  assert.equal(result.component_scores.saving_habits.earned, 0);
});

test('does not turn a failed savings query into a zero-contribution score', () => {
  const result = assess({
    expenses: currentIncomeExpense(),
    dataCompleteness: { expenses: true, savings: false, budgets: true }
  });
  assert.equal(result.component_scores.saving_habits.available, false);
  assert.match(result.component_scores.saving_habits.reason, /query did not complete/);
});

test('applies exact Saving Habits lower-tier thresholds', () => {
  const cases = [
    [0, 0],
    [0.01, 5],
    [4.99, 5],
    [5, 10],
    [9.99, 10],
    [10, 15],
    [14.99, 15],
    [15, 20],
    [19.99, 20],
    [20, 25]
  ];

  for (const [contribution, expected] of cases) {
    const result = assess({
      expenses: currentIncomeExpense(100, 50),
      savings: [
        { amount: contribution || 1, currency: 'INR', savings_date: '2026-10-04', record_type: contribution ? 'contribution' : 'transfer' }
      ]
    });
    assert.equal(result.component_scores.saving_habits.earned, expected, `${contribution}%`);
  }
});

test('does not make the Saving Habits component available without reliable savings activity', () => {
  const result = assess({
    expenses: currentIncomeExpense(),
    dataCompleteness: { expenses: true, savings: false, budgets: true }
  });
  assert.equal(result.component_scores.saving_habits.available, false);
});

test('averages essential expenses across all three completed months and subtracts emergency withdrawals', () => {
  const result = assess({
    expenses: [
      ...currentIncomeExpense(1000, 500),
      transaction('expense', 1000, '2026-08-10', 'INR', 'Rent'),
      transaction('expense', 2000, '2026-07-10', 'INR', 'Rent'),
      transaction('expense', 7000, '2026-09-10', 'INR', 'Food')
    ],
    budgets: [...previousThreeEssentialBudgets(), budget('Food', 800, '2026-09')],
    emergencySavingsHistoryComplete: true,
    savings: [
      { amount: 6000, currency: 'INR', savings_date: '2026-07-01', record_type: 'contribution', is_emergency: true },
      { amount: 1000, currency: 'INR', savings_date: '2026-10-10', record_type: 'withdrawal', is_emergency: true },
      { amount: 9000, currency: 'INR', savings_date: '2026-10-11', record_type: 'transfer', is_emergency: true },
      { amount: 9000, currency: 'INR', savings_date: '2026-10-12', record_type: 'contribution', is_emergency: false }
    ]
  });

  const component = result.component_scores.emergency_preparedness;
  assert.equal(component.metrics.emergencyBalance, 5000);
  assert.equal(component.metrics.essentialMonthlyExpenses, 1000);
  assert.deepEqual(component.metrics.monthlyEssentialExpenses, [
    { month: '2026-09', expenses: 0 },
    { month: '2026-08', expenses: 1000 },
    { month: '2026-07', expenses: 2000 }
  ]);
  assert.equal(component.metrics.coverageMonths, 5);
  assert.equal(component.earned, 12);
});

test('treats missing emergency identification as unavailable, not zero coverage', () => {
  const result = assess({
    expenses: [
      ...currentIncomeExpense(),
      transaction('expense', 1000, '2026-10-10', 'INR', 'Rent')
    ],
    budgets: previousThreeEssentialBudgets(),
    savings: []
  });

  assert.equal(result.component_scores.emergency_preparedness.available, false);
});

test('marks emergency preparedness unavailable when any completed month lacks essential budgets', () => {
  const result = assess({
    expenses: [
      transaction('expense', 1000, '2026-09-10', 'INR', 'Rent'),
      transaction('expense', 1000, '2026-08-10', 'INR', 'Rent')
    ],
    budgets: [
      budget('Rent', 1000, '2026-09', 'INR', true),
      budget('Rent', 1000, '2026-08', 'INR', true)
    ],
    emergencySavingsHistoryComplete: true,
    savings: [
      { amount: 3000, currency: 'INR', savings_date: '2026-07-01', record_type: 'contribution', is_emergency: true }
    ]
  });
  assert.equal(result.component_scores.emergency_preparedness.available, false);
  assert.match(result.component_scores.emergency_preparedness.reason, /2026-07/);
});

test('marks emergency preparedness unavailable when the essential-expense average is zero', () => {
  const result = assess({
    expenses: [],
    budgets: previousThreeEssentialBudgets(),
    emergencySavingsHistoryComplete: true,
    savings: [
      { amount: 1000, currency: 'INR', savings_date: '2026-09-05', record_type: 'contribution', is_emergency: true }
    ]
  });

  assert.equal(result.component_scores.emergency_preparedness.available, false);
  assert.equal(result.component_scores.emergency_preparedness.metrics.average, 0);
});

test('keeps emergency preparedness unavailable when a required essential expense has a different currency', () => {
  const result = assess({
    expenses: [
      transaction('expense', 1000, '2026-09-10', 'USD', 'Rent'),
      transaction('expense', 1000, '2026-08-10', 'INR', 'Rent'),
      transaction('expense', 1000, '2026-07-10', 'INR', 'Rent')
    ],
    budgets: previousThreeEssentialBudgets(),
    emergencySavingsHistoryComplete: true,
    savings: [
      { amount: 3000, currency: 'INR', savings_date: '2026-07-01', record_type: 'contribution', is_emergency: true }
    ]
  });

  assert.equal(result.component_scores.emergency_preparedness.available, false);
  assert.match(result.component_scores.emergency_preparedness.reason, /currency-compatible/);
});

test('requires complete expense, budget, and emergency history before calculating coverage', () => {
  const result = assess({
    expenses: [
      transaction('expense', 1000, '2026-09-10', 'INR', 'Rent'),
      transaction('expense', 1000, '2026-08-10', 'INR', 'Rent'),
      transaction('expense', 1000, '2026-07-10', 'INR', 'Rent')
    ],
    budgets: previousThreeEssentialBudgets(),
    dataCompleteness: { expenses: true, savings: true, budgets: false },
    emergencySavingsHistoryComplete: true,
    savings: [
      { amount: 3000, currency: 'INR', savings_date: '2026-07-01', record_type: 'contribution', is_emergency: true }
    ]
  });

  assert.equal(result.component_scores.emergency_preparedness.available, false);
});

test('scores a verified zero emergency balance against the three-month essential average', () => {
  const result = assess({
    expenses: [
      transaction('expense', 1000, '2026-09-10', 'INR', 'Rent'),
      transaction('expense', 1000, '2026-08-10', 'INR', 'Rent'),
      transaction('expense', 1000, '2026-07-10', 'INR', 'Rent')
    ],
    budgets: previousThreeEssentialBudgets(),
    emergencySavingsHistoryComplete: true,
    savings: [
      { amount: 1000, currency: 'INR', savings_date: '2026-09-05', record_type: 'contribution', is_emergency: true },
      { amount: 1000, currency: 'INR', savings_date: '2026-10-05', record_type: 'withdrawal', is_emergency: true }
    ]
  });

  assert.equal(result.component_scores.emergency_preparedness.metrics.emergencyBalance, 0);
  assert.equal(result.component_scores.emergency_preparedness.metrics.essentialMonthlyExpenses, 1000);
  assert.equal(result.component_scores.emergency_preparedness.earned, 2);
});

test('marks Budget Management unavailable if monthly budgets are absent', () => {
  const result = assess({ expenses: currentIncomeExpense() });
  assert.equal(result.component_scores.budget_management.available, false);
});

test('matches budgets by month and currency and excludes unbudgeted categories', () => {
  const result = assess({
    expenses: [
      transaction('income', 1000, '2026-10-02'),
      transaction('expense', 600, '2026-10-03', 'INR', 'Food'),
      transaction('expense', 2000, '2026-10-03', 'INR', 'Unbudgeted'),
      transaction('expense', 800, '2026-10-03', 'USD', 'Rent')
    ],
    budgets: [
      budget('Food', 1000),
      budget('Food', 1000, '2026-09'),
      budget('Rent', 1000, '2026-10', 'USD')
    ]
  });

  assert.equal(result.component_scores.budget_management.metrics.totalMatchedSpending, 600);
  assert.equal(result.component_scores.budget_management.metrics.totalMatchedBudget, 1000);
  assert.equal(result.component_scores.budget_management.metrics.budgetUsage, 60);
  assert.equal(result.component_scores.budget_management.earned, 20);
});

test('applies exact Budget Management thresholds', () => {
  const cases = [
    [80, 20],
    [80.01, 16],
    [100, 16],
    [100.01, 10],
    [110, 10],
    [110.01, 5],
    [125, 5],
    [125.01, 0]
  ];

  for (const [actual, expected] of cases) {
    const result = assess({
      expenses: [
        transaction('income', 1000, '2026-10-02'),
        transaction('expense', actual, '2026-10-03', 'INR', 'Food')
      ],
      budgets: [budget('Food', 100)]
    });
    assert.equal(result.component_scores.budget_management.earned, expected, `${actual}%`);
  }
});

test('excludes unknown and mismatched currencies instead of converting them', () => {
  const result = assess({
    expenses: [
      transaction('income', 1000, '2026-10-02', 'USD'),
      { ...transaction('income', 1000, '2026-10-02'), currency: null },
      transaction('expense', 500, '2026-10-03', 'INR')
    ],
    savings: [
      { amount: 300, currency: 'USD', savings_date: '2026-10-04', record_type: 'contribution' }
    ]
  });
  assert.equal(result.component_scores.spending_control.available, false);
  assert.match(result.component_scores.spending_control.reason, /unknown currency/);
  assert.equal(result.component_scores.saving_habits.available, false);
  assert.match(result.component_scores.saving_habits.reason, /unknown currency/);
});

test('uses the previous three completed months and ignores the incomplete current month for consistency', () => {
  const result = assess({
    expenses: [
      ...currentIncomeExpense(1000, 1500),
      ...previousThreePositiveMonths()
    ]
  });

  assert.deepEqual(
    result.component_scores.financial_consistency.metrics.months.map((month) => month.month),
    ['2026-09', '2026-08', '2026-07']
  );
  assert.equal(result.component_scores.financial_consistency.earned, 15);
});

test('marks consistency unavailable when any completed month lacks either income or expense evidence', () => {
  const months = previousThreePositiveMonths().filter((row) => row.expense_date !== '2026-08-03');
  const result = assess({
    expenses: [...currentIncomeExpense(), ...months],
    dataCompleteness: { expenses: false, savings: true, budgets: true }
  });
  assert.equal(result.component_scores.financial_consistency.available, false);
});

test('calculates month boundaries across the year transition', () => {
  const result = assess({
    assessmentMonth: '2026-01',
    dateLimit: '2026-01-31',
    expenses: [
      transaction('income', 1000, '2025-10-02'),
      transaction('expense', 500, '2025-10-03'),
      transaction('income', 1000, '2025-11-02'),
      transaction('expense', 500, '2025-11-03'),
      transaction('income', 1000, '2025-12-02'),
      transaction('expense', 500, '2025-12-03')
    ]
  });

  assert.deepEqual(
    result.component_scores.financial_consistency.metrics.months.map((month) => month.month),
    ['2025-12', '2025-11', '2025-10']
  );
});

test('rejects invalid calendar dates and out-of-month date limits', () => {
  assert.throws(() => assess({ assessmentMonth: '2026-13' }), /YYYY-MM/);
  assert.throws(() => assess({ dateLimit: '2026-02-30' }), /YYYY-MM-DD/);
  assert.throws(() => assess({ assessmentMonth: '2026-10', dateLimit: '2026-09-30' }), /YYYY-MM-DD/);
});

test('requires at least 60% coverage and three available components before showing a score', () => {
  const result = assess({
    expenses: [
      ...currentIncomeExpense(),
      ...previousThreePositiveMonths()
    ],
    budgets: [budget('Food', 1000)],
    dataCompleteness: { expenses: true, savings: false, budgets: true }
  });

  assert.equal(result.available_component_count, 3);
  assert.equal(result.coverage_percentage, 60);
  assert.notEqual(result.score, null);

  const tooFew = assess({
    expenses: currentIncomeExpense(),
    dataCompleteness: { expenses: true, savings: false, budgets: false }
  });
  assert.equal(tooFew.available_component_count, 2);
  assert.equal(tooFew.score, null);
});

test('uses the exact approved score interpretation labels', () => {
  const cases = [
    [100, 'Excellent'],
    [90, 'Excellent'],
    [89, 'Healthy'],
    [75, 'Healthy'],
    [74, 'Fair'],
    [60, 'Fair'],
    [59, 'Developing'],
    [40, 'Developing'],
    [39, 'Needs Attention'],
    [0, 'Needs Attention']
  ];

  for (const [targetScore, expectedLabel] of cases) {
    assert.equal(getFinancialHealthScoreLabel(targetScore), expectedLabel);
  }
});
