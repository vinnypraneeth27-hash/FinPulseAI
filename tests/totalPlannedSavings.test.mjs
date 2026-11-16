import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateGoalMonthlyContribution,
  calculateTotalPlannedSavings,
  AppState
} from '../js/state.js';

test('Goal monthly savings remains fixed unless target or duration is edited', () => {
  const state = new AppState();
  const goal = {
    id: 'g1',
    targetAmount: 1500000,
    currentAmount: 0,
    initialSavedAmount: 0,
    duration: 24,
    durationUnit: 'months',
    targetDate: '2028-11-16',
    monthlyContribution: 62500
  };
  const otherGoal = {
    id: 'g2',
    targetAmount: 120000,
    currentAmount: 12000,
    duration: 12,
    durationUnit: 'months',
    targetDate: '2027-11-16'
  };
  state.data.savingsGoals = [goal, otherGoal];

  assert.equal(calculateGoalMonthlyContribution(goal), 62500);
  assert.equal(calculateGoalMonthlyContribution(otherGoal), 9000);

  const transaction = state.addTransaction({
    type: 'income',
    amount: 100000,
    title: 'Salary'
  });
  assert.equal(calculateGoalMonthlyContribution(goal), 62500);

  state.updateTransaction({ ...transaction, amount: 125000 });
  assert.equal(calculateGoalMonthlyContribution(goal), 62500);

  const expense = state.addTransaction({
    type: 'expense',
    amount: 30000,
    title: 'Rent'
  });
  assert.equal(calculateGoalMonthlyContribution(goal), 62500);

  state.updateTransaction({ ...expense, amount: 35000 });
  assert.equal(calculateGoalMonthlyContribution(goal), 62500);

  state.deleteTransaction(expense.id);
  assert.equal(calculateGoalMonthlyContribution(goal), 62500);

  state.deleteTransaction(transaction.id);
  assert.equal(calculateGoalMonthlyContribution(goal), 62500);

  state.depositToGoal(goal.id, 100000);
  assert.equal(calculateGoalMonthlyContribution(goal), 62500);

  const persistedGoal = JSON.parse(JSON.stringify(goal));
  assert.equal(calculateGoalMonthlyContribution(persistedGoal), 62500);
  assert.equal(calculateGoalMonthlyContribution({
    ...goal,
    targetDate: '2030-11-16'
  }), 62500);
  assert.equal(calculateGoalMonthlyContribution({
    target_amount: 1500000,
    current_amount: 100000,
    initial_saved_amount: 0,
    duration: 24,
    duration_unit: 'months',
    monthly_contribution: 62500
  }), 62500);

  assert.equal(calculateGoalMonthlyContribution({
    targetAmount: 1800000,
    currentAmount: goal.currentAmount,
    initialSavedAmount: goal.initialSavedAmount,
    duration: 24,
    durationUnit: 'months'
  }), 75000);
  assert.equal(calculateGoalMonthlyContribution({
    targetAmount: 1500000,
    initialSavedAmount: goal.initialSavedAmount,
    duration: 30,
    durationUnit: 'months'
  }), 50000);
});

test('Total Planned Savings - Scenario 1: Create 3 goals (₹30k, ₹10k, ₹5k) -> Total = ₹45,000', () => {
  const goal1 = {
    id: 'goal-home',
    title: 'Dream Home',
    targetAmount: 300000,
    currentAmount: 0,
    duration: 10,
    durationUnit: 'months'
  };
  const goal2 = {
    id: 'goal-laptop',
    title: 'New Laptop',
    targetAmount: 60000,
    currentAmount: 0,
    duration: 6,
    durationUnit: 'months'
  };
  const goal3 = {
    id: 'goal-emergency',
    title: 'Emergency Fund',
    targetAmount: 60000,
    currentAmount: 0,
    duration: 12,
    durationUnit: 'months'
  };

  assert.equal(calculateGoalMonthlyContribution(goal1), 30000);
  assert.equal(calculateGoalMonthlyContribution(goal2), 10000);
  assert.equal(calculateGoalMonthlyContribution(goal3), 5000);

  const total = calculateTotalPlannedSavings([goal1, goal2, goal3]);
  assert.equal(total, 45000);
});

test('Total Planned Savings - Scenario 2: Add income and expense transactions -> Total remains ₹45,000', () => {
  const state = new AppState();
  state.data.savingsGoals = [
    { id: 'g1', title: 'Dream Home', targetAmount: 300000, currentAmount: 0, duration: 10, durationUnit: 'months' },
    { id: 'g2', title: 'New Laptop', targetAmount: 60000, currentAmount: 0, duration: 6, durationUnit: 'months' },
    { id: 'g3', title: 'Emergency Fund', targetAmount: 60000, currentAmount: 0, duration: 12, durationUnit: 'months' }
  ];

  assert.equal(state.getTotalPlannedSavings(), 45000);

  // Add new income transaction
  state.addTransaction({
    type: 'income',
    amount: 100000,
    category: 'Income',
    title: 'Monthly Salary'
  });

  // Add new expense transactions
  state.addTransaction({
    type: 'expense',
    amount: 30000,
    category: 'Housing & Utilities',
    title: 'Rent'
  });
  state.addTransaction({
    type: 'expense',
    amount: 15000,
    category: 'Food & Dining',
    title: 'Groceries'
  });

  // Total Planned Savings MUST remain ₹45,000
  assert.equal(state.getTotalPlannedSavings(), 45000);
});

test('Total Planned Savings - Scenario 3: Edit and delete income and expense transactions -> Total remains ₹45,000', () => {
  const state = new AppState();
  state.data.savingsGoals = [
    { id: 'g1', title: 'Dream Home', targetAmount: 300000, currentAmount: 0, duration: 10, durationUnit: 'months' },
    { id: 'g2', title: 'New Laptop', targetAmount: 60000, currentAmount: 0, duration: 6, durationUnit: 'months' },
    { id: 'g3', title: 'Emergency Fund', targetAmount: 60000, currentAmount: 0, duration: 12, durationUnit: 'months' }
  ];

  const tx = state.addTransaction({
    type: 'expense',
    amount: 5000,
    category: 'Shopping & Tech',
    title: 'Supplies'
  });

  assert.equal(state.getTotalPlannedSavings(), 45000);

  // Edit transaction
  state.updateTransaction({
    ...tx,
    amount: 12000
  });
  assert.equal(state.getTotalPlannedSavings(), 45000);

  // Delete transaction
  state.deleteTransaction(tx.id);
  assert.equal(state.getTotalPlannedSavings(), 45000);
});

test('Total Planned Savings - Scenario 4: Navigate between months and refresh dashboard -> Total remains ₹45,000', () => {
  const state = new AppState();
  state.data.savingsGoals = [
    { id: 'g1', title: 'Dream Home', targetAmount: 300000, currentAmount: 0, duration: 10, durationUnit: 'months' },
    { id: 'g2', title: 'New Laptop', targetAmount: 60000, currentAmount: 0, duration: 6, durationUnit: 'months' },
    { id: 'g3', title: 'Emergency Fund', targetAmount: 60000, currentAmount: 0, duration: 12, durationUnit: 'months' }
  ];

  // Simulating different selected months
  const months = ['2026-01', '2026-06', '2026-11', '2027-03'];
  for (const m of months) {
    assert.equal(state.getTotalPlannedSavings(), 45000, `Failed for month ${m}`);
  }

  // Simulating deposits made or budget allocation to goals (Rule 10)
  state.depositToGoal('g1', 30000);
  state.depositToGoal('g2', 10000);
  assert.equal(state.getTotalPlannedSavings(), 45000, 'Deposits must NOT modify planned monthly contribution');
});

test('Total Planned Savings - Scenario 5: Change goal monthly contribution from ₹10k to ₹15k -> Total becomes ₹50,000', () => {
  const state = new AppState();
  state.data.savingsGoals = [
    { id: 'g1', title: 'Dream Home', targetAmount: 300000, currentAmount: 0, duration: 10, durationUnit: 'months' },
    { id: 'g2', title: 'New Laptop', targetAmount: 60000, currentAmount: 0, duration: 6, durationUnit: 'months' }, // ₹10,000/mo
    { id: 'g3', title: 'Emergency Fund', targetAmount: 60000, currentAmount: 0, duration: 12, durationUnit: 'months' } // ₹5,000/mo
  ];

  assert.equal(state.getTotalPlannedSavings(), 45000);

  // Edit Goal 2: achievement duration from 6 months to 4 months (or target to 90,000)
  const g2 = state.data.savingsGoals.find(g => g.id === 'g2');
  g2.duration = 4; // 60,000 / 4 = 15,000/month

  assert.equal(calculateGoalMonthlyContribution(g2), 15000);
  assert.equal(state.getTotalPlannedSavings(), 50000);
});

test('Total Planned Savings - Scenario 6: Delete goal with ₹5,000 monthly contribution -> Total becomes ₹45,000', () => {
  const state = new AppState();
  state.data.savingsGoals = [
    { id: 'g1', title: 'Dream Home', targetAmount: 300000, currentAmount: 0, duration: 10, durationUnit: 'months' }, // ₹30,000/mo
    { id: 'g2', title: 'New Laptop', targetAmount: 60000, currentAmount: 0, duration: 4, durationUnit: 'months' },   // ₹15,000/mo
    { id: 'g3', title: 'Emergency Fund', targetAmount: 60000, currentAmount: 0, duration: 12, durationUnit: 'months' } // ₹5,000/mo
  ];

  assert.equal(state.getTotalPlannedSavings(), 50000);

  // Delete Goal 3 (Emergency Fund, ₹5,000/mo)
  state.data.savingsGoals = state.data.savingsGoals.filter(g => g.id !== 'g3');

  assert.equal(state.getTotalPlannedSavings(), 45000);
});
