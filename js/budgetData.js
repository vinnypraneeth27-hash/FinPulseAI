function validMonthStart(value) {
  if (!/^\d{4}-\d{2}-01$/.test(String(value || ''))) return false;
  const [year, month] = value.slice(0, 7).split('-').map(Number);
  return year >= 1 && month >= 1 && month <= 12;
}

function throwSupabaseError(error) {
  if (error instanceof Error) throw error;
  throw new Error(
    typeof error?.message === 'string' && error.message
      ? error.message
      : 'Supabase did not confirm the budget operation.'
  );
}

function validateBudget(input) {
  const category = String(input?.category || '').trim();
  const amount = Number(input?.amount);
  const currency = String(input?.currency || '').trim().toUpperCase();
  const periodStart = String(input?.periodStart || '');

  if (!category) throw new Error('Budget category is required.');
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Budget amount must be greater than zero.');
  }
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Budget currency must be a three-letter code.');
  if (!validMonthStart(periodStart)) throw new Error('Budget period must be the first day of a valid month.');

  return {
    category,
    amount,
    currency,
    period_start: periodStart,
    is_essential: input?.isEssential === true
  };
}

function normalizeBudget(row, userId) {
  if (
    !row ||
    row.user_id !== userId ||
    typeof row.id !== 'string' ||
    !row.id
  ) {
    throw new Error('Supabase returned a budget for an unexpected user or an invalid budget record.');
  }
  const normalized = validateBudget({
    category: row.category,
    amount: row.amount,
    currency: row.currency,
    periodStart: row.period_start,
    isEssential: row.is_essential
  });
  return {
    id: row.id,
    userId: row.user_id,
    ...normalized,
    isEssential: normalized.is_essential,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const BUDGET_FIELDS = 'id,user_id,category,amount,currency,period_start,is_essential,created_at,updated_at';

export async function loadUserBudgets(supabase, userId, periodStart) {
  if (!userId) throw new Error('An authenticated user is required to read budgets.');
  if (!validMonthStart(periodStart)) {
    throw new Error('Budget period must be the first day of a valid month.');
  }

  const { data, error } = await supabase
    .from('user_budgets')
    .select(BUDGET_FIELDS)
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .order('category', { ascending: true });

  if (error) throwSupabaseError(error);
  return (data || []).map((row) => normalizeBudget(row, userId));
}

export async function saveUserBudget(supabase, userId, input) {
  if (!userId) throw new Error('An authenticated user is required to save budgets.');
  const budget = validateBudget(input);
  const payload = {
    user_id: userId,
    ...budget,
  };
  const { data, error } = await supabase
    .from('user_budgets')
    .upsert(payload, { onConflict: 'user_id,category,period_start,currency' })
    .select(BUDGET_FIELDS)
    .single();

  if (error) throwSupabaseError(error);
  return normalizeBudget(data, userId);
}
