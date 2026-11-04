import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadUserBudgets, saveUserBudget } from '../js/budgetData.js';

function createBudgetClient(rows = [], calls = []) {
  let nextId = 1;
  return {
    from(table) {
      const query = { filters: [] };
      query.select = (fields) => {
        query.fields = fields;
        return query;
      };
      query.eq = (column, value) => {
        query.filters.push([column, value]);
        calls.push({ action: 'filter', table, column, value });
        return query;
      };
      query.order = (column, options) => {
        query.orderBy = [column, options];
        return query;
      };
      query.upsert = (payload, options) => {
        query.payload = payload;
        query.conflict = options.onConflict;
        calls.push({ action: 'upsert', table, payload, conflict: query.conflict });
        return query;
      };
      query.single = async () => {
        let row = rows.find((item) =>
          item.user_id === query.payload.user_id &&
          item.category === query.payload.category &&
          item.period_start === query.payload.period_start &&
          item.currency === query.payload.currency
        );
        if (row) Object.assign(row, query.payload);
        else {
          row = { id: `budget-${nextId++}`, ...query.payload };
          rows.push(row);
        }
        return { data: row, error: null };
      };
      query.then = (resolve, reject) => {
        const result = rows.filter((row) =>
          query.filters.every(([column, value]) => row[column] === value)
        );
        return Promise.resolve({ data: result, error: null }).then(resolve, reject);
      };
      return query;
    }
  };
}

test('loads only the authenticated user budgets for one calendar month', async () => {
  const rows = [
    { id: 'a1', user_id: 'user-a', category: 'Housing', amount: 1200, currency: 'USD', period_start: '2026-10-01', is_essential: true },
    { id: 'a3', user_id: 'user-a', category: 'Housing', amount: 1100, currency: 'EUR', period_start: '2026-10-01', is_essential: true },
    { id: 'b1', user_id: 'user-b', category: 'Housing', amount: 900, currency: 'USD', period_start: '2026-10-01', is_essential: true },
    { id: 'a2', user_id: 'user-a', category: 'Food', amount: 300, currency: 'USD', period_start: '2026-09-01', is_essential: true }
  ];
  const calls = [];
  const budgets = await loadUserBudgets(createBudgetClient(rows, calls), 'user-a', '2026-10-01');

  assert.deepEqual(budgets.map(({ id }) => id), ['a1', 'a3']);
  assert.equal(budgets[0].isEssential, true);
  assert.ok(calls.some((call) => call.column === 'user_id' && call.value === 'user-a'));
  await assert.rejects(loadUserBudgets(createBudgetClient(), '', '2026-10-01'), /authenticated user/);
});

test('upserts budgets by authenticated owner, category, month, and currency', async () => {
  const rows = [
    { id: 'eur', user_id: 'user-a', category: 'Housing', amount: 1100, currency: 'EUR', period_start: '2026-10-01', is_essential: true },
    { id: 'usd', user_id: 'user-a', category: 'Housing', amount: 1200, currency: 'USD', period_start: '2026-10-01', is_essential: false }
  ];
  const calls = [];
  const saved = await saveUserBudget(createBudgetClient(rows, calls), 'user-a', {
    category: 'Housing',
    amount: 1500,
    currency: 'USD',
    periodStart: '2026-10-01',
    isEssential: true
  });

  assert.equal(saved.userId, 'user-a');
  assert.equal(saved.isEssential, true);
  assert.equal(saved.period_start, '2026-10-01');
  const upsert = calls.find((call) => call.action === 'upsert');
  assert.equal(upsert.conflict, 'user_id,category,period_start,currency');
  assert.equal(Object.hasOwn(upsert.payload, 'updated_at'), false);
  assert.equal(rows.find((row) => row.currency === 'USD').amount, 1500);
  assert.equal(rows.find((row) => row.currency === 'EUR').amount, 1100);
  assert.equal(rows[0].user_id, 'user-a');
  await assert.rejects(saveUserBudget(createBudgetClient(), '', {
    category: 'Housing', amount: 1, currency: 'USD', periodStart: '2026-10-01'
  }), /authenticated user/);
});

test('migration declares currency-aware budget uniqueness, server timestamps, and score status consistency', async () => {
  const sql = await readFile(new URL('../supabase/financial_health_score.sql', import.meta.url), 'utf8');

  assert.match(sql, /unique \(user_id, category, period_start, currency\)/i);
  assert.match(sql, /finpulse_user_budgets_updated_at[\s\S]*?before update on public\.user_budgets/i);
  assert.match(sql, /new\.updated_at := pg_catalog\.now\(\)/i);
  assert.match(sql, /financial_health_scores_status_score_consistency_check[\s\S]*?status = 'ready' and score is not null[\s\S]*?status = 'insufficient_data' and score is null/i);
  assert.match(sql, /financial_health_scores_available_weight_range_check[\s\S]*?available_weight >= 0 and available_weight <= 100/i);
  assert.match(sql, /check \(record_type in \('contribution', 'transfer', 'withdrawal'\)\)/i);
  assert.doesNotMatch(sql, /update public\.expenses[\s\S]*?set currency/i);
  assert.doesNotMatch(sql, /update public\.savings[\s\S]*?set is_emergency/i);
});
