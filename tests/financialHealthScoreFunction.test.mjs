import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createFinancialHealthScoreHandler } from '../netlify/functions/financial-health-score.js';

function request(body, token = 'verified-token') {
  return new Request('https://example.test/.netlify/functions/financial-health-score', {
    method: 'POST',
    headers: token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

function createClients({
  userId = 'user-a',
  authError = null,
  queryError = null,
  malformedTable = null,
  records = {},
  seedScores = []
} = {}) {
  const reads = [];
  const writes = [];
  const scoreRows = seedScores.map((row) => ({ ...row }));
  const rowsByTable = {
    expenses: [],
    savings: [],
    user_budgets: [],
    ...records
  };
  const userClient = {
    auth: {
      async getUser(token) {
        reads.push({ kind: 'verified-user', token });
        return authError
          ? { data: { user: null }, error: authError }
          : { data: { user: { id: userId } }, error: null };
      }
    },
    from(table) {
      const query = { filters: [] };
      query.select = () => query;
      query.eq = (column, value) => {
        query.filters.push([column, value]);
        reads.push({ table, column, value });
        return query;
      };
      query.order = () => query;
      query.range = async () => {
        if (queryError && (!queryError.table || queryError.table === table)) {
          return { data: null, error: queryError.error || new Error('query failed') };
        }
        if (malformedTable === table) return { data: null, error: null };
        const owner = query.filters.find(([column]) => column === 'user_id')?.[1];
        const data = (rowsByTable[table] || []).filter((row) => row.user_id === owner);
        return { data, error: null };
      };
      query.maybeSingle = async () => ({ data: { currency: 'USD' }, error: null });
      return query;
    }
  };
  const adminClient = {
    from(table) {
      const query = { filters: [], action: null };
      query.select = () => query;
      query.eq = (column, value) => {
        query.filters.push([column, value]);
        return query;
      };
      query.is = (column, value) => {
        query.filters.push([column, value]);
        return query;
      };
      query.order = () => query;
      query.limit = () => query;
      query.maybeSingle = async () => {
        const row = scoreRows.find((candidate) =>
          query.filters.every(([column, value]) => candidate[column] === value)
        );
        return { data: row ? { id: row.id } : null, error: null };
      };
      query.insert = (payload) => {
        query.action = 'insert';
        query.payload = payload;
        writes.push({ table, action: query.action, payload });
        return query;
      };
      query.update = (payload) => {
        query.action = 'update';
        query.payload = payload;
        writes.push({ table, action: query.action, payload, filters: query.filters });
        return query;
      };
      query.single = async () => {
        if (query.action === 'insert') {
          await new Promise((resolve) => setTimeout(resolve, 2));
          const duplicate = scoreRows.some((row) =>
            row.user_id === query.payload.user_id &&
            row.assessment_type === query.payload.assessment_type &&
            row.assessment_month === query.payload.assessment_month
          );
          if (duplicate) {
            return { data: null, error: { code: '23505', message: 'unique assessment identity' } };
          }
          const row = { id: `score-${scoreRows.length + 1}`, ...query.payload };
          scoreRows.push(row);
          return { data: row, error: null };
        }

        const row = scoreRows.find((candidate) =>
          query.filters.every(([column, value]) => candidate[column] === value)
        );
        if (!row) return { data: null, error: new Error('owner-scoped score row not found') };
        Object.assign(row, query.payload);
        return { data: row, error: null };
      };
      return query;
    }
  };

  return {
    reads,
    writes,
    scoreRows,
    createSupabaseClient(_url, key, options) {
      if (key === 'anon-key') {
        assert.match(options.global.headers.Authorization, /^Bearer verified-token$/);
        return userClient;
      }
      assert.equal(key, 'server-only-key');
      return adminClient;
    }
  };
}

const env = {
  SUPABASE_URL: 'https://example.invalid',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'server-only-key'
};

function handlerFor(clients, options = {}) {
  return createFinancialHealthScoreHandler({
    createSupabaseClient: clients.createSupabaseClient,
    env,
    now: () => new Date('2026-10-12T12:00:00.000Z'),
    ...options
  });
}

test('verifies the bearer token and returns only a server-calculated assessment', async () => {
  const clients = createClients();
  const response = await handlerFor(clients)(request({
    timeZone: 'UTC'
  }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.live.score, null);
  assert.match(result.live.insufficient_data_reason, /Insufficient data:/);
  assert.deepEqual(result.diagnostics.recordsRetrieved, {
    incomeRecords: 0,
    expenseRecords: 0,
    savingsRecords: 0,
    budgetRecords: 0,
    unrecognizedTransactionTypeRecords: 0
  });
  assert.equal(result.diagnostics.profileCurrencyAvailable, true);
  assert.equal(result.diagnostics.assessments.live.availableIndicators, 1);
  assert.equal(result.diagnostics.assessments.live.coveragePercentage, 15);
  assert.equal(clients.scoreRows.length, 2);
  assert.ok(clients.reads.some((entry) =>
    entry.kind === 'verified-user' && entry.token === 'verified-token'
  ));
  assert.ok(clients.reads.filter((entry) => entry.column === 'user_id').every((entry) => entry.value === 'user-a'));
});

test('uses SUPABASE_PUBLISHABLE_KEY when configured', async () => {
  const clients = createClients();
  const response = await createFinancialHealthScoreHandler({
    createSupabaseClient(url, key, options) {
      if (key === 'publishable-key') {
        return clients.createSupabaseClient(url, 'anon-key', options);
      }
      return clients.createSupabaseClient(url, key, options);
    },
    env: {
      ...env,
      SUPABASE_PUBLISHABLE_KEY: 'publishable-key'
    },
    now: () => new Date('2026-10-12T12:00:00.000Z')
  })(request({ timeZone: 'UTC' }));

  assert.equal(response.status, 200);
  assert.ok(clients.reads.some((entry) => entry.kind === 'verified-user'));
});

test('rejects request user ids and forged score fields', async () => {
  for (const body of [
    { timeZone: 'UTC', userId: 'user-b' },
    { timeZone: 'UTC', score: 100 }
  ]) {
    const clients = createClients();
    const response = await handlerFor(clients)(request(body));
    assert.equal(response.status, 400);
    assert.equal(clients.scoreRows.length, 0);
    assert.equal(clients.reads.filter((entry) => entry.table).length, 0);
  }
});

test('rejects invalid tokens before reading or writing user data', async () => {
  const clients = createClients({ authError: new Error('invalid token') });
  const response = await handlerFor(clients)(request({ timeZone: 'UTC' }));
  assert.equal(response.status, 401);
  assert.equal(clients.scoreRows.length, 0);
  assert.equal(clients.writes.length, 0);
});

test('treats successfully verified empty query results as zero activity', async () => {
  const clients = createClients({
    records: {
      expenses: [{
        user_id: 'user-a',
        amount: 1000,
        category: 'Income',
        expense_date: '2026-10-03',
        transaction_type: 'income',
        currency: 'USD'
      }],
      savings: [],
      user_budgets: []
    }
  });
  const response = await handlerFor(clients)(request({ timeZone: 'UTC' }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.live.component_scores.spending_control.earned, 25);
  assert.equal(result.live.component_scores.spending_control.metrics.monthlyExpenses, 0);
  assert.equal(result.live.component_scores.saving_habits.available, true);
  assert.equal(result.live.component_scores.saving_habits.metrics.genuineContributions, 0);
  assert.equal(result.live.component_scores.saving_habits.earned, 0);
  assert.deepEqual(result.diagnostics.recordsRetrieved, {
    incomeRecords: 1,
    expenseRecords: 0,
    savingsRecords: 0,
    budgetRecords: 0,
    unrecognizedTransactionTypeRecords: 0
  });
  assert.deepEqual(result.diagnostics.dataCompleteness, {
    expenses: true,
    savings: true,
    budgets: true
  });
  assert.equal(result.diagnostics.assessments.live.availableWeight, result.live.available_weight);
  assert.equal(result.diagnostics.assessments.live.coveragePercentage, result.live.coverage_percentage);
  assert.equal(result.diagnostics.assessments.live.indicators.spending_control.available, true);
  assert.equal(result.diagnostics.assessments.live.reason, null);
  assert.equal(Object.values(result.diagnostics.assessments.live.indicators).length, 5);
  const diagnosticsJson = JSON.stringify(result.diagnostics);
  assert.doesNotMatch(diagnosticsJson, /1000/);
  assert.doesNotMatch(diagnosticsJson, /"(?:amount|currency|token)"\s*:/i);
});

test('a successful transfer-only savings query scores zero genuine contributions', async () => {
  const clients = createClients({
    records: {
      expenses: [{
        user_id: 'user-a', amount: 1000, category: 'Income', expense_date: '2026-10-03',
        transaction_type: 'income', currency: 'USD'
      }],
      savings: [{
        user_id: 'user-a', amount: 300, currency: 'USD', savings_date: '2026-10-04',
        record_type: 'transfer', is_emergency: false
      }]
    }
  });
  const response = await handlerFor(clients)(request({ timeZone: 'UTC' }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.live.component_scores.saving_habits.available, true);
  assert.equal(result.live.component_scores.saving_habits.metrics.genuineContributions, 0);
  assert.equal(result.live.component_scores.saving_habits.earned, 0);
  assert.equal(result.live.component_scores.emergency_preparedness.available, false);
});

test('never treats failed or incomplete financial queries as zero activity', async () => {
  const failedClients = createClients({ queryError: { table: 'expenses', error: new Error('database unavailable') } });
  const failedResponse = await handlerFor(failedClients)(request({ timeZone: 'UTC' }));
  assert.equal(failedResponse.status, 500);
  assert.equal(failedClients.writes.length, 0);

  const incompleteClients = createClients({ malformedTable: 'expenses' });
  const incompleteResponse = await handlerFor(incompleteClients)(request({ timeZone: 'UTC' }));
  assert.equal(incompleteResponse.status, 500);
  assert.equal(incompleteClients.writes.length, 0);
});

test('rejects invalid body and timezone values', async () => {
  for (const body of [null, [], { timeZone: 'Mars/Invalid' }, { timeZone: 'UTC', extra: true }]) {
    const clients = createClients();
    const response = await handlerFor(clients)(request(body));
    assert.equal(response.status, 400);
    assert.equal(clients.writes.length, 0);
  }
  const clients = createClients();
  const malformedResponse = await handlerFor(clients)(request('{', 'verified-token'));
  assert.equal(malformedResponse.status, 400);
  const missingTimezoneResponse = await handlerFor(clients)(request({}));
  assert.equal(missingTimezoneResponse.status, 400);
});

test('rejects invalid injected dates and preserves supplied timezone month boundaries', async () => {
  const clients = createClients();
  const invalidDateHandler = handlerFor(clients, { now: () => new Date(Number.NaN) });
  const invalidDateResponse = await invalidDateHandler(request({ timeZone: 'UTC' }));
  assert.equal(invalidDateResponse.status, 500);
  assert.equal(clients.writes.length, 0);

  const shifted = createClients();
  const shiftedHandler = handlerFor(shifted, {
    now: () => new Date('2026-10-01T01:00:00.000Z')
  });
  const response = await shiftedHandler(request({ timeZone: 'America/Los_Angeles' }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.live.assessment_month, '2026-09');
  assert.ok(shifted.scoreRows.some((row) =>
    row.assessment_type === 'monthly' && row.assessment_month === '2026-08-01'
  ));
});

test('serializes concurrent assessment writes and updates one identity across version changes', async () => {
  const clients = createClients();
  const firstHandler = handlerFor(clients, { calculationVersion: '1' });
  const concurrent = await Promise.all([
    firstHandler(request({ timeZone: 'UTC' })),
    firstHandler(request({ timeZone: 'UTC' }))
  ]);
  assert.ok(concurrent.every((response) => response.status === 200));
  assert.equal(clients.scoreRows.length, 2);

  const originalLive = clients.scoreRows.find((row) => row.assessment_type === 'live');
  const originalId = originalLive.id;
  const secondVersionResponse = await handlerFor(clients, { calculationVersion: '2' })(
    request({ timeZone: 'UTC' })
  );
  assert.equal(secondVersionResponse.status, 200);
  assert.equal(clients.scoreRows.length, 2);
  assert.equal(originalLive.id, originalId);
  assert.equal(originalLive.calculation_version, '2');
  assert.ok(clients.writes.filter((write) => write.action === 'update').every((write) =>
    write.filters.some(([column, value]) => column === 'user_id' && value === 'user-a')
  ));
});

test('one verified user cannot read or update another user score record', async () => {
  const clients = createClients({
    seedScores: [{
      id: 'user-b-live',
      user_id: 'user-b',
      assessment_type: 'live',
      assessment_month: null,
      calculation_version: '1'
    }]
  });
  const response = await handlerFor(clients)(request({ timeZone: 'UTC' }));
  assert.equal(response.status, 200);
  assert.equal(clients.scoreRows.find((row) => row.id === 'user-b-live').calculation_version, '1');
  assert.ok(clients.writes.filter((write) => write.action === 'update').every((write) =>
    write.filters.some(([column, value]) => column === 'user_id' && value === 'user-a')
  ));
  assert.ok(clients.reads.filter((entry) => entry.column === 'user_id').every((entry) => entry.value === 'user-a'));
});

test('stores the previous completed month separately from the live assessment', async () => {
  const clients = createClients();
  const response = await handlerFor(clients)(request({ timeZone: 'UTC' }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.live.assessment_month, '2026-10');
  assert.equal(result.monthly.assessment_month, '2026-09');
  assert.ok(clients.scoreRows.some((row) => row.assessment_type === 'monthly' && row.assessment_month === '2026-09-01'));
});

test('prepared schema allows one live and one monthly score per user regardless of version', async () => {
  const sql = await readFile(new URL('../supabase/financial_health_score.sql', import.meta.url), 'utf8');
  assert.match(sql, /financial_health_scores_live_user_idx\s+on public\.financial_health_scores \(user_id\)/i);
  assert.match(sql, /financial_health_scores_month_user_idx\s+on public\.financial_health_scores \(user_id, assessment_month\)/i);
  assert.doesNotMatch(sql, /unique index if not exists financial_health_scores_live_user_version_idx/i);
  assert.match(sql, /revoke all on public\.financial_health_scores from anon, authenticated/i);
  assert.match(sql, /grant select on public\.financial_health_scores to authenticated/i);
  assert.match(sql, /using \(auth\.uid\(\) = user_id\)/i);
});
