import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyFinancialIntent,
  estimateNextMonthSpending,
  localDateKey,
  localMonthKey,
  normalizeTransactionDescription,
  summarizeTransactions,
  yesterdayDateKey
} from '../js/financialData.js';
import { loadExpensesForDate } from '../js/transactionData.js';

const currencies = {
  USD: { rate: 1 },
  INR: { rate: 83.5 }
};

test('classifies inquiries and advice separately from transaction intents', () => {
  assert.equal(classifyFinancialIntent('Hello'), 'greeting');
  assert.equal(classifyFinancialIntent('What is my current balance?'), 'balance_inquiry');
  assert.equal(classifyFinancialIntent('How much money do I currently have?'), 'balance_inquiry');
  assert.equal(classifyFinancialIntent('How much did I spend this month?'), 'monthly_expense_inquiry');
  assert.equal(classifyFinancialIntent('How much income did I earn this month?'), 'monthly_income_inquiry');
  assert.equal(classifyFinancialIntent('How much income did I receive this month?'), 'monthly_income_inquiry');
  assert.equal(classifyFinancialIntent('How much have I saved?'), 'savings_inquiry');
  assert.equal(classifyFinancialIntent('Show my savings'), 'savings_inquiry');
  assert.equal(classifyFinancialIntent('How much have I saved this month?'), 'monthly_savings_inquiry');
  assert.equal(classifyFinancialIntent('Suggest me a budget saving pattern for this month'), 'budget_advice');
  assert.equal(classifyFinancialIntent('Suggest me best savings for this month'), 'savings_plan_inquiry');
  assert.equal(classifyFinancialIntent('How can I save ₹3000 this month?'), 'budget_advice');
  assert.equal(classifyFinancialIntent('Which category am I overspending on?'), 'budget_advice');
  assert.equal(classifyFinancialIntent('How much did I spend yesterday?'), 'yesterday_expense_inquiry');
  assert.equal(classifyFinancialIntent('Show my recent transactions'), 'recent_transactions_inquiry');
  assert.equal(classifyFinancialIntent('How much will I spend next month?'), 'future_spending_inquiry');
  assert.equal(classifyFinancialIntent('Predict my future expenses for next month'), 'future_spending_inquiry');
  assert.equal(classifyFinancialIntent('Add 6000 as savings'), 'savings_record_request');
  assert.equal(classifyFinancialIntent('How much should I save based on my monthly income?'), 'savings_plan_inquiry');
  assert.equal(classifyFinancialIntent('Suggest a savings plan for me'), 'savings_plan_inquiry');
  assert.equal(classifyFinancialIntent('How much can I save in six months?'), 'savings_plan_inquiry');
  assert.equal(classifyFinancialIntent('Add my recommended savings'), 'savings_record_request');
  assert.equal(classifyFinancialIntent('Add ₹2,000 to my savings'), 'savings_record_request');
  assert.equal(classifyFinancialIntent('I saved ₹500 today'), 'savings_record_request');
  assert.equal(classifyFinancialIntent('Show my savings progress'), 'savings_progress_inquiry');
  assert.equal(classifyFinancialIntent('I spent 6000 on food'), 'general');
});

test('uses local calendar dates and safe transaction description fallbacks', () => {
  assert.equal(localDateKey(new Date(2026, 0, 1, 0, 5)), '2026-01-01');
  assert.equal(yesterdayDateKey(new Date(2026, 0, 1, 0, 5)), '2025-12-31');
  assert.equal(normalizeTransactionDescription(undefined), 'Transaction');
  assert.equal(normalizeTransactionDescription(null), 'Transaction');
  assert.equal(normalizeTransactionDescription(' undefined '), 'Transaction');
  assert.equal(normalizeTransactionDescription('null'), 'Transaction');
  assert.equal(normalizeTransactionDescription('Groceries'), 'Groceries');
});

test('queries only the authenticated user’s expense rows for the exact local date', async () => {
  const calls = [];
  const client = {
    from(table) {
      calls.push(['from', table]);
      const query = {
        select(columns) {
          calls.push(['select', columns]);
          return this;
        },
        eq(column, value) {
          calls.push(['eq', column, value]);
          return this;
        },
        then(resolve) {
          return Promise.resolve({
            data: [{ user_id: 'user-a', transaction_type: 'expense', expense_date: '2026-10-11', amount: 500 }],
            error: null
          }).then(resolve);
        }
      };
      return query;
    }
  };

  const rows = await loadExpensesForDate(client, 'user-a', '2026-10-11');
  assert.equal(rows.length, 1);
  assert.deepEqual(calls, [
    ['from', 'expenses'],
    ['select', '*'],
    ['eq', 'user_id', 'user-a'],
    ['eq', 'transaction_type', 'expense'],
    ['eq', 'expense_date', '2026-10-11']
  ]);
  await assert.rejects(loadExpensesForDate(client, '', '2026-10-11'), /authenticated user/);
  await assert.rejects(loadExpensesForDate(client, 'user-a', '2026-02-30'), /valid calendar date/);
  const failedClient = {
    from: () => ({
      select() { return this; },
      eq() { return this; },
      then(resolve) { return Promise.resolve({ data: null, error: { message: 'database unavailable' } }).then(resolve); }
    })
  };
  await assert.rejects(loadExpensesForDate(failedClient, 'user-a', '2026-10-11'), /database unavailable/);
});

test('calculates all-time and local-month totals with currency conversion', () => {
  const now = new Date(2026, 9, 12, 12);
  const month = localMonthKey(now);
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 12);
  const previousMonthKey = localMonthKey(previousMonth);
  const transactions = [
    { amount: 100, currency: 'USD', type: 'income', date: `${month}-01` },
    { amount: 6000, currency: 'INR', type: 'expense', category: 'Food & Dining', date: `${month}-02` },
    { amount: 900, currency: 'INR', type: 'expense', category: 'Housing & Utilities', date: `${previousMonthKey}-28` },
    { amount: 400, currency: 'INR', type: 'savings', date: `${month}-03` }
  ];

  const totals = summarizeTransactions(transactions, 'INR', currencies, now);
  assert.equal(totals.income, 8350);
  assert.equal(totals.expenses, 6900);
  assert.equal(totals.balance, 1450);
  assert.equal(totals.monthlyIncome, 8350);
  assert.equal(totals.monthlyExpenses, 6000);
  assert.equal(totals.monthlyBalance, 2350);
  assert.deepEqual(totals.monthlyCategoryExpenses, { 'Food & Dining': 6000 });

  const refreshedTotals = summarizeTransactions(transactions, 'INR', currencies, now);
  assert.equal(refreshedTotals.balance, totals.balance);
  assert.equal(refreshedTotals.monthlyExpenses, totals.monthlyExpenses);
});

test('estimates next-month expenses from a clearly labeled current-month run rate', () => {
  const now = new Date(2026, 9, 12, 12);
  const month = localMonthKey(now);
  const estimate = estimateNextMonthSpending([
    { amount: 1200, currency: 'INR', type: 'expense', date: `${month}-03` },
    { amount: 600, currency: 'INR', type: 'expense', date: `${month}-10` },
    { amount: 5000, currency: 'INR', type: 'income', date: `${month}-04` },
    { amount: 900, currency: 'INR', type: 'expense', date: '2026-09-28' }
  ], 'INR', currencies, now);

  assert.deepEqual(estimate, {
    amount: 4500,
    observedMonth: '2026-10',
    observedExpenses: 1800,
    elapsedDays: 12,
    nextMonthDays: 30
  });
  assert.equal(estimateNextMonthSpending([], 'INR', currencies, now), null);
});

test('returns zero only for successfully loaded empty data and excludes unsupported types', () => {
  const now = new Date(2026, 9, 12, 12);
  const empty = summarizeTransactions([], 'INR', currencies, now);
  assert.equal(empty.transactionCount, 0);
  assert.equal(empty.monthlyExpenses, 0);

  const invalid = summarizeTransactions([
    { amount: 6000, type: 'transfer', date: '2026-10-02' }
  ], 'INR', currencies, now);
  assert.equal(invalid.expenses, 0);
  assert.equal(invalid.monthlyExpenses, 0);
});
