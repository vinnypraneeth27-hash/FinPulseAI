import { createClient } from '@supabase/supabase-js';
import {
  calculateFinancialHealthAssessment,
  FINANCIAL_HEALTH_SCORE_VERSION
} from '../../js/financialHealthScore.js';

const PAGE_SIZE = 1000;
const SCORE_FIELDS = [
  'id',
  'user_id',
  'assessment_type',
  'assessment_month',
  'score',
  'coverage_percentage',
  'available_weight',
  'status',
  'component_scores',
  'calculation_version',
  'calculated_at'
].join(',');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function getBearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || null;
}

function normalizeTimeZone(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timeZone = value.trim();
  if (timeZone.length > 100) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return null;
  }
}

function localDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function monthKey(dateKey) {
  return dateKey.slice(0, 7);
}

function priorMonthKey(value) {
  const [year, month] = value.split('-').map(Number);
  if (month === 1 && year <= 1) throw new Error('Assessment month has no supported previous month.');
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  return `${String(previousYear).padStart(4, '0')}-${String(previousMonth).padStart(2, '0')}`;
}

function monthEnd(value) {
  const [year, month] = value.split('-').map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const day = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (!day) throw new Error('Invalid month boundary requested.');
  return `${value}-${String(day).padStart(2, '0')}`;
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999 || month < 1 || month > 12) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= daysInMonth;
}

function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function maxAssessmentYear(dateKey) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) &&
    Number(dateKey.slice(0, 4)) >= 1 &&
    Number(dateKey.slice(0, 4)) <= 9999;
}

async function loadOwnedRows(client, table, columns, userId, sortColumn) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client
      .from(table)
      .select(columns)
      .eq('user_id', userId);
    if (sortColumn) query = query.order(sortColumn, { ascending: true });
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!Array.isArray(data)) {
      throw new Error(`Supabase returned an incomplete ${table} page.`);
    }
    const page = data;
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, complete: true };
  }
}

async function loadProfileCurrency(client, userId) {
  const { data, error } = await client
    .from('user_profiles')
    .select('currency')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  const currency = String(data?.currency || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function buildAssessmentDiagnostics(assessment) {
  const indicators = Object.fromEntries(
    Object.entries(assessment.component_scores).map(([key, component]) => [
      key,
      {
        label: component.label,
        available: component.available,
        weight: component.weight,
        reason: component.reason
      }
    ])
  );
  return {
    status: assessment.status,
    reason: assessment.insufficient_data_reason,
    availableIndicators: assessment.available_component_count,
    indicatorCount: Object.keys(indicators).length,
    availableWeight: assessment.available_weight,
    coveragePercentage: assessment.coverage_percentage,
    minimumAvailableIndicators: 2,
    minimumCoveragePercentage: 60,
    indicators
  };
}

function buildDataDiagnostics(expenses, savings, budgets, dataCompleteness, assessments) {
  let incomeRecordsRetrieved = 0;
  let expenseRecordsRetrieved = 0;
  let unrecognizedTransactionTypeRecords = 0;
  for (const row of expenses) {
    const type = String(row.transaction_type || '').trim().toLowerCase();
    if (type === 'income') incomeRecordsRetrieved += 1;
    else if (type === 'expense') expenseRecordsRetrieved += 1;
    else unrecognizedTransactionTypeRecords += 1;
  }

  return {
    recordsRetrieved: {
      incomeRecords: incomeRecordsRetrieved,
      expenseRecords: expenseRecordsRetrieved,
      savingsRecords: savings.length,
      budgetRecords: budgets.length,
      unrecognizedTransactionTypeRecords
    },
    profileCurrencyAvailable: true,
    dataCompleteness,
    assessments: {
      live: buildAssessmentDiagnostics(assessments.live),
      monthly: buildAssessmentDiagnostics(assessments.monthly)
    }
  };
}

async function findExistingScore(adminClient, userId, type, assessmentMonth) {
  let query = adminClient
    .from('financial_health_scores')
    .select('id')
    .eq('user_id', userId)
    .eq('assessment_type', type);
  query = type === 'live'
    ? query.is('assessment_month', null)
    : query.eq('assessment_month', assessmentMonth);
  const { data, error } = await query
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function saveAssessment(adminClient, userId, assessmentType, assessment, calculatedAt, calculationVersion) {
  const payload = {
    user_id: userId,
    assessment_type: assessmentType,
    assessment_month: assessmentType === 'live' ? null : assessment.assessment_month + '-01',
    score: assessment.score,
    coverage_percentage: assessment.coverage_percentage,
    available_weight: assessment.available_weight,
    status: assessment.status,
    component_scores: {
      ...assessment.component_scores,
      assessment_currency: assessment.assessment_currency
    },
    calculation_version: calculationVersion,
    calculated_at: calculatedAt
  };

  const existing = await findExistingScore(
    adminClient,
    userId,
    assessmentType,
    payload.assessment_month
  );
  if (existing) {
    const { data, error } = await adminClient
      .from('financial_health_scores')
      .update(payload)
      .eq('id', existing.id)
      .eq('user_id', userId)
      .select(SCORE_FIELDS)
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await adminClient
    .from('financial_health_scores')
    .insert(payload)
    .select(SCORE_FIELDS)
    .single();
  if (!error) return data;
  if (error.code !== '23505') throw error;

  const racedExisting = await findExistingScore(
    adminClient,
    userId,
    assessmentType,
    payload.assessment_month
  );
  if (!racedExisting) throw error;

  const { data: updated, error: updateError } = await adminClient
    .from('financial_health_scores')
    .update(payload)
    .eq('id', racedExisting.id)
    .eq('user_id', userId)
    .select(SCORE_FIELDS)
    .single();
  if (updateError) throw updateError;
  return updated;
}

export function createFinancialHealthScoreHandler({
  createSupabaseClient = createClient,
  env = process.env,
  now = () => new Date(),
  calculationVersion = FINANCIAL_HEALTH_SCORE_VERSION
} = {}) {
  return async (request) => {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const accessToken = getBearerToken(request);
    if (!accessToken) return jsonResponse({ error: 'Authentication required' }, 401);

    const supabaseUrl = env.SUPABASE_URL;
    const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !publicKey || !serviceRoleKey) {
      console.error('Financial Health Score endpoint is missing Supabase server environment configuration.');
      return jsonResponse({ error: 'Financial Health Score service is not configured.' }, 503);
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return jsonResponse({ error: 'Request must be a small JSON object.' }, 400);
    }

    let body;
    try {
      const requestText = await request.text();
      if (requestText.length > 4096) {
        return jsonResponse({ error: 'Request body exceeds the allowed size.' }, 400);
      }
      body = JSON.parse(requestText);
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) => key !== 'timeZone')) {
      return jsonResponse({ error: 'Request body may contain only a timeZone string.' }, 400);
    }
    const timeZone = normalizeTimeZone(body.timeZone);
    if (!timeZone) return jsonResponse({ error: 'A valid local time zone is required.' }, 400);

    try {
      const userClient = createSupabaseClient(supabaseUrl, publicKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
      const userId = userData?.user?.id;

      if (userError || !userId) {
        console.error('Supabase user verification failed:', {
          status: userError?.status,
          code: userError?.code,
          message: userError?.message
        });

        return jsonResponse({
          error: 'Supabase could not verify the authenticated user.'
        }, 401);
      }

      const currentTime = now();
      if (!isValidDate(currentTime)) {
        throw new Error('The score clock returned an invalid date.');
      }
      const today = localDateKey(currentTime, timeZone);
      if (!isValidDateKey(today) || !maxAssessmentYear(today)) {
        throw new Error('The local assessment date is outside the supported calendar range.');
      }
      const currentMonth = monthKey(today);
      const completedMonth = priorMonthKey(currentMonth);
      if (!/^\d{4}-\d{2}$/.test(currentMonth) || !/^\d{4}-\d{2}$/.test(completedMonth)) {
        throw new Error('The current or completed assessment month is invalid.');
      }
      const completedMonthEnd = monthEnd(completedMonth);
      if (!isValidDateKey(completedMonthEnd)) {
        throw new Error('The completed assessment month boundary is invalid.');
      }

      const [currency, expenseResult, savingsResult, budgetResult] = await Promise.all([
        loadProfileCurrency(userClient, userId),
        loadOwnedRows(
          userClient,
          'expenses',
          'user_id,amount,category,expense_date,transaction_type,currency',
          userId,
          'expense_date'
        ),
        loadOwnedRows(
          userClient,
          'savings',
          'user_id,amount,currency,savings_date,record_type',
          userId,
          'savings_date'
        ),
        loadOwnedRows(
          userClient,
          'user_budgets',
          'user_id,category,amount,currency,period_start,is_essential',
          userId,
          'period_start'
        )
      ]);

      if (!currency) {
        return jsonResponse({ error: 'A valid saved profile currency is required to assess financial health.' }, 422);
      }

      const expenses = expenseResult.rows;
      const savings = savingsResult.rows;
      const budgets = budgetResult.rows;
      const dataCompleteness = {
        expenses: expenseResult.complete,
        savings: savingsResult.complete,
        budgets: budgetResult.complete
      };
      const liveAssessment = calculateFinancialHealthAssessment({
        expenses,
        savings,
        budgets,
        dataCompleteness,
        currency,
        assessmentMonth: currentMonth,
        dateLimit: today
      });
      const monthlyAssessment = calculateFinancialHealthAssessment({
        expenses,
        savings,
        budgets,
        dataCompleteness,
        currency,
        assessmentMonth: completedMonth,
        dateLimit: completedMonthEnd
      });
      liveAssessment.calculation_version = calculationVersion;
      monthlyAssessment.calculation_version = calculationVersion;

      const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      const calculatedAt = currentTime.toISOString();
      const [live, monthly] = await Promise.all([
        saveAssessment(adminClient, userId, 'live', liveAssessment, calculatedAt, calculationVersion),
        saveAssessment(adminClient, userId, 'monthly', monthlyAssessment, calculatedAt, calculationVersion)
      ]);
      const diagnostics = buildDataDiagnostics(
        expenses,
        savings,
        budgets,
        dataCompleteness,
        { live: liveAssessment, monthly: monthlyAssessment }
      );

      return jsonResponse({
        live: { ...liveAssessment, calculated_at: live.calculated_at },
        monthly: { ...monthlyAssessment, calculated_at: monthly.calculated_at },
        diagnostics
      });
    } catch (error) {
      console.error('Financial Health Score calculation failed:', error);
      return jsonResponse({ error: 'Financial Health Score could not be calculated.' }, 500);
    }
  };
}

export default createFinancialHealthScoreHandler();
