import assert from 'node:assert/strict';
import test from 'node:test';
import {
  insertSavingsDeposit,
  loadSavingsDeposits,
  summarizeSavingsDeposits,
  validateSavingsDeposit
} from '../js/savingsData.js';

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
            id: `test-row-${nextId++}`,
            ...this.insertPayload,
            created_at: '2026-10-12T12:00:00Z'
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
          const result = rows.filter((row) => this.filters.every(([column, value]) => row[column] === value));
          return Promise.resolve({ data: result, error: null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
}

const validDeposit = {
  amount: 6000,
  currency: 'INR',
  description: 'BudgetBot savings deposit',
  savingsDate: '2026-10-12',
  recordType: 'contribution',
  requestId: '6a75082f-b78e-48eb-895c-ad91c8dd99f1'
};

test('validates savings amount, currency, description, date, type, and request id before database access', async () => {
  const calls = [];
  const client = createMockSupabase([], calls);

  assert.throws(() => validateSavingsDeposit({ ...validDeposit, amount: 0 }), /greater than zero/);
  assert.throws(() => validateSavingsDeposit({ ...validDeposit, amount: -500 }), /greater than zero/);
  assert.throws(() => validateSavingsDeposit({ ...validDeposit, amount: Number.NaN }), /greater than zero/);
  assert.throws(() => validateSavingsDeposit({ ...validDeposit, amount: Number.POSITIVE_INFINITY }), /greater than zero/);
  assert.throws(() => validateSavingsDeposit({ ...validDeposit, currency: 'XXX' }), /not supported/);
  assert.throws(() => validateSavingsDeposit({ ...validDeposit, savingsDate: '2026-02-30' }), /valid YYYY-MM-DD date/);
  assert.throws(() => validateSavingsDeposit({ ...validDeposit, recordType: 'expense' }), /record type/);
  assert.throws(() => validateSavingsDeposit({ ...validDeposit, requestId: 'invalid' }), /valid UUID/);
  await assert.rejects(insertSavingsDeposit(client, '', validDeposit), /authenticated user/);
  await assert.rejects(insertSavingsDeposit(client, 'user-a', { ...validDeposit, amount: -500 }), /greater than zero/);
  await assert.rejects(insertSavingsDeposit(client, 'user-a', { ...validDeposit, amount: 0 }), /greater than zero/);
  assert.deepEqual(calls, []);
});

test('inserts only into savings for the authenticated owner and reads after a fresh client is created', async () => {
  const rows = [];
  const calls = [];
  const firstClient = createMockSupabase(rows, calls);
  const saved = await insertSavingsDeposit(firstClient, 'user-a', validDeposit);

  assert.equal(saved.userId, 'user-a');
  assert.equal(saved.amount, 6000);
  assert.equal(saved.currency, 'INR');
  assert.equal(saved.recordType, 'contribution');
  assert.deepEqual(calls.find((call) => call.action === 'insert'), {
    table: 'savings',
    action: 'insert',
    payload: {
      user_id: 'user-a',
      amount: 6000,
      currency: 'INR',
      description: 'BudgetBot savings deposit',
      savings_date: '2026-10-12',
      record_type: 'contribution',
      request_id: '6a75082f-b78e-48eb-895c-ad91c8dd99f1'
    }
  });

  const retry = await insertSavingsDeposit(firstClient, 'user-a', validDeposit);
  assert.equal(retry.id, saved.id);
  assert.equal(rows.length, 1);
  await assert.rejects(
    insertSavingsDeposit(firstClient, 'user-a', { ...validDeposit, amount: 5000 }),
    /already used for a different record/
  );
  assert.equal(rows.length, 1);

  rows.push({
    id: 'another-users-row',
    user_id: 'user-b',
    amount: 900,
    currency: 'INR',
    description: 'Private record',
    savings_date: '2026-10-11',
    record_type: 'transfer',
    request_id: null,
    created_at: '2026-10-11T12:00:00Z'
  });
  const refreshedClient = createMockSupabase(rows, calls);
  const afterRefresh = await loadSavingsDeposits(refreshedClient, 'user-a');

  assert.equal(afterRefresh.length, 1);
  assert.equal(afterRefresh[0].id, saved.id);
  assert.equal(afterRefresh[0].amount, 6000);
  assert.ok(calls.some((call) => call.action === 'filter' && call.column === 'user_id' && call.value === 'user-a'));
  assert.ok(calls.every((call) => call.table === 'savings'));
  assert.equal((await loadSavingsDeposits(refreshedClient, 'user-b')).length, 1);

  const summary = summarizeSavingsDeposits(afterRefresh, 'INR', { INR: { rate: 83.5 } }, '2026-10');
  assert.deepEqual(summary, { total: 6000, monthlyTotal: 6000, count: 1 });
});

test('does not claim a savings insert succeeded when Supabase RLS rejects it', async () => {
  const client = createMockSupabase([], [], {
    message: 'new row violates row-level security policy'
  });
  await assert.rejects(
    insertSavingsDeposit(client, 'user-a', validDeposit),
    /row-level security policy/
  );
});
