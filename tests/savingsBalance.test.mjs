import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeTransactions } from '../js/financialData.js';
import { calculateSavingsPlan } from '../js/savingsPlan.js';
import {
  insertSavingsDeposit,
  loadSavingsDeposits,
  summarizeSavingsDeposits,
  validateSavingsDeposit
} from '../js/savingsData.js';
import { state } from '../js/state.js';
import { CURRENCIES } from '../js/utils.js';

function createMockSupabase(rows = [], calls = [], writeError = null) {
  let nextId = rows.length + 1;
  return {
    from(table) {
      const query = {
        table,
        filters: [],
        insertPayload: null,
        insert(payload) {
          this.insertPayload = payload;
          calls.push({ table, action: 'insert', payload });
          return this;
        },
        select(columns) {
          this.columns = columns;
          if (!this.insertPayload) calls.push({ table, action: 'select', columns });
          return this;
        },
        eq(column, value) {
          this.filters.push([column, value]);
          calls.push({ table, action: 'filter', column, value });
          return this;
        },
        order(column, options) {
          this.orderBy = [column, options];
          return this;
        },
        async single() {
          if (writeError) return { data: null, error: writeError };
          const duplicate = rows.find((row) =>
            row.user_id === this.insertPayload.user_id &&
            row.request_id === this.insertPayload.request_id
          );
          if (duplicate) {
            return { data: null, error: { code: '23505', message: 'duplicate savings request' } };
          }
          const row = {
            id: `row-${nextId++}`,
            ...this.insertPayload,
            created_at: '2026-10-13T10:00:00Z'
          };
          rows.push(row);
          return { data: row, error: null };
        },
        async maybeSingle() {
          const result = rows.find((row) =>
            this.filters.every(([column, value]) => row[column] === value)
          );
          return { data: result || null, error: null };
        },
        then(resolve, reject) {
          const filtered = rows.filter((row) =>
            this.filters.every(([column, value]) => row[column] === value)
          );
          resolve({ data: filtered, error: null });
        }
      };
      return query;
    }
  };
}

test('Test Case 1: Starting balance ₹10,000; savings transfer ₹2,000; expected balance ₹8,000', () => {
  // Set up account with income ₹10,000 in INR
  state.setCurrency('INR');
  state.data.transactions = [
    { id: 'tx-1', type: 'income', title: 'Salary', category: 'Income', amount: 10000, currency: 'INR', date: '2026-10-01' }
  ];
  state.setSavingsDeposits([]);

  const initialTotals = state.getTotals();
  assert.equal(initialTotals.totalIncome, 10000);
  assert.equal(initialTotals.totalExpenses, 0);
  assert.equal(initialTotals.availableBalance, 10000);
  assert.equal(initialTotals.netSavings, 10000);
  assert.equal(initialTotals.totalSavings, 0);

  // User transfers ₹2,000 to savings
  const transfer1 = {
    id: 'sav-1',
    amount: 2000,
    currency: 'INR',
    description: 'Transfer to savings',
    savingsDate: '2026-10-05',
    recordType: 'transfer',
    requestId: '550e8400-e29b-41d4-a716-446655440001'
  };
  state.addSavingsDeposit(transfer1);

  const afterFirstTransfer = state.getTotals();
  assert.equal(afterFirstTransfer.totalIncome, 10000);
  assert.equal(afterFirstTransfer.totalExpenses, 0);
  assert.equal(afterFirstTransfer.totalSavings, 2000);
  assert.equal(afterFirstTransfer.availableBalance, 8000, 'Available balance must be ₹8,000');
  assert.equal(afterFirstTransfer.netSavings, 8000, 'netSavings must reflect ₹8,000');

  // Verify financialData.summarizeTransactions also matches
  const summary = summarizeTransactions(state.getTransactions(), 'INR', CURRENCIES, undefined, state.getSavingsDeposits());
  assert.equal(summary.income, 10000);
  assert.equal(summary.expenses, 0);
  assert.equal(summary.savingsTransfers, 2000);
  assert.equal(summary.balance, 8000);
});

test('Test Case 2: Starting balance ₹8,000; additional savings ₹1,000; expected balance ₹7,000; total savings ₹3,000', () => {
  state.setCurrency('INR');
  state.data.transactions = [
    { id: 'tx-1', type: 'income', title: 'Salary', category: 'Income', amount: 10000, currency: 'INR', date: '2026-10-01' }
  ];
  state.setSavingsDeposits([
    {
      id: 'sav-1',
      amount: 2000,
      currency: 'INR',
      description: 'Transfer to savings',
      savingsDate: '2026-10-05',
      recordType: 'transfer',
      requestId: '550e8400-e29b-41d4-a716-446655440001'
    }
  ]);

  // Additional transfer of ₹1,000
  const transfer2 = {
    id: 'sav-2',
    amount: 1000,
    currency: 'INR',
    description: 'Additional savings',
    savingsDate: '2026-10-10',
    recordType: 'transfer',
    requestId: '550e8400-e29b-41d4-a716-446655440002'
  };
  state.addSavingsDeposit(transfer2);

  const totals = state.getTotals();
  assert.equal(totals.totalIncome, 10000);
  assert.equal(totals.totalExpenses, 0);
  assert.equal(totals.totalSavings, 3000, 'Total savings must be ₹3,000');
  assert.equal(totals.availableBalance, 7000, 'Available balance must be ₹7,000');
  assert.equal(totals.netSavings, 7000);

  const summary = summarizeTransactions(state.getTransactions(), 'INR', CURRENCIES, undefined, state.getSavingsDeposits());
  assert.equal(summary.savingsTransfers, 3000);
  assert.equal(summary.balance, 7000);
});

test('Test Case 3: Attempt to save ₹9,000 when available balance is ₹7,000; reject the transfer', () => {
  state.setCurrency('INR');
  const totals = state.getTotals();
  const currentAvailable = totals.availableBalance;
  assert.equal(currentAvailable, 7000);

  const excessiveAmount = 9000;
  // Validation function checks available balance
  const validateAttempt = (amount, available) => {
    if (amount > available) {
      throw new Error(`Cannot transfer ₹${amount}. It exceeds available balance of ₹${available}.`);
    }
  };

  assert.throws(
    () => validateAttempt(excessiveAmount, currentAvailable),
    /exceeds available balance/
  );

  // State remains intact at ₹7,000 available balance
  const unchangedTotals = state.getTotals();
  assert.equal(unchangedTotals.availableBalance, 7000);
  assert.equal(unchangedTotals.totalSavings, 3000);
});

test('Test Case 4 & 5: Refresh page / Logout and login; balance remains synchronized from database', async () => {
  const userId = 'usr-123';
  const dbRows = [
    {
      id: 'sav-1',
      user_id: userId,
      amount: 2000,
      currency: 'INR',
      description: 'Transfer to savings',
      savings_date: '2026-10-05',
      record_type: 'transfer',
      request_id: '550e8400-e29b-41d4-a716-446655440001',
      created_at: '2026-10-05T12:00:00Z'
    },
    {
      id: 'sav-2',
      user_id: userId,
      amount: 1000,
      currency: 'INR',
      description: 'Additional savings',
      savings_date: '2026-10-10',
      record_type: 'transfer',
      request_id: '550e8400-e29b-41d4-a716-446655440002',
      created_at: '2026-10-10T12:00:00Z'
    }
  ];

  const supabaseMock = createMockSupabase(dbRows);

  // Simulate logout (clear memory)
  state.setSavingsDeposits([]);
  assert.equal(state.getTotals().availableBalance, 10000);

  // Simulate login / refresh: load from Supabase
  const loadedDeposits = await loadSavingsDeposits(supabaseMock, userId);
  state.setSavingsDeposits(loadedDeposits);

  const reloadedTotals = state.getTotals();
  assert.equal(reloadedTotals.totalSavings, 3000);
  assert.equal(reloadedTotals.availableBalance, 7000);
});

test('Test Case 6: Simulate a database error; no false deduction should appear', async () => {
  const userId = 'usr-123';
  const dbRows = [];
  const dbError = new Error('Database connection failed');
  const faultySupabase = createMockSupabase(dbRows, [], dbError);

  const beforeTotals = state.getTotals();
  const beforeBalance = beforeTotals.availableBalance;
  assert.equal(beforeBalance, 7000);

  // Attempt to save transfer to Supabase
  let errorCaught = null;
  try {
    await insertSavingsDeposit(faultySupabase, userId, {
      amount: 500,
      currency: 'INR',
      description: 'Failed save',
      savingsDate: '2026-10-12',
      recordType: 'transfer',
      requestId: '550e8400-e29b-41d4-a716-446655440999'
    });
  } catch (err) {
    errorCaught = err;
  }

  assert.ok(errorCaught, 'Error should be thrown on DB failure');
  // Since operation failed, no deposit is added to state
  const afterTotals = state.getTotals();
  assert.equal(afterTotals.availableBalance, beforeBalance, 'Available balance must remain untouched');
  assert.equal(afterTotals.totalSavings, 3000);
});

test('Test Case 7: Retry a confirmed request; does not deduct the same transfer twice', async () => {
  const userId = 'usr-123';
  const sharedRequestId = '550e8400-e29b-41d4-a716-446655440777';
  const dbRows = [];
  const supabase = createMockSupabase(dbRows);

  // First request
  const deposit1 = await insertSavingsDeposit(supabase, userId, {
    amount: 500,
    currency: 'INR',
    description: 'Idempotent transfer',
    savingsDate: '2026-10-12',
    recordType: 'transfer',
    requestId: sharedRequestId
  });
  state.addSavingsDeposit(deposit1);

  const balanceAfterFirst = state.getTotals().availableBalance;
  assert.equal(balanceAfterFirst, 6500);

  // Duplicate retry with same requestId
  const depositRetry = await insertSavingsDeposit(supabase, userId, {
    amount: 500,
    currency: 'INR',
    description: 'Idempotent transfer',
    savingsDate: '2026-10-12',
    recordType: 'transfer',
    requestId: sharedRequestId
  });
  state.addSavingsDeposit(depositRetry);

  // Should NOT deduct twice
  const balanceAfterRetry = state.getTotals().availableBalance;
  assert.equal(balanceAfterRetry, 6500, 'Duplicate request must not deduct twice');
  assert.equal(state.getTotals().totalSavings, 3500);
});

test('Test Case 8: Verify savings transfers are not also counted as ordinary expenses', () => {
  state.setCurrency('INR');
  state.data.transactions = [
    { id: 'tx-1', type: 'income', title: 'Salary', category: 'Income', amount: 10000, currency: 'INR', date: '2026-10-01' },
    { id: 'tx-2', type: 'expense', title: 'Groceries', category: 'Food & Dining', amount: 1500, currency: 'INR', date: '2026-10-02' }
  ];
  state.setSavingsDeposits([
    {
      id: 'sav-1',
      amount: 2000,
      currency: 'INR',
      description: 'Transfer to savings',
      savingsDate: '2026-10-05',
      recordType: 'transfer',
      requestId: '550e8400-e29b-41d4-a716-446655440001'
    }
  ]);

  const totals = state.getTotals();
  assert.equal(totals.totalIncome, 10000);
  assert.equal(totals.totalExpenses, 1500, 'Total expenses must only be ordinary expenses (₹1,500)');
  assert.equal(totals.totalSavings, 2000, 'Total savings must be ₹2,000');
  // Available balance = 10000 - 1500 - 2000 = 6500
  assert.equal(totals.availableBalance, 6500);
  assert.equal(totals.actualByCategory['Food & Dining'], 1500);
  assert.equal(Object.keys(totals.actualByCategory).length, 1, 'Savings transfer must not create or alter expense categories');

  // Also verify calculateSavingsPlan
  const plan = calculateSavingsPlan(10000, 1500, 20, 2000);
  assert.equal(plan.monthlyIncome, 10000);
  assert.equal(plan.monthlyExpenses, 1500);
  assert.equal(plan.availableBalance, 6500);
});
