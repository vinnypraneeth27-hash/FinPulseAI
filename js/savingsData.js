const SUPPORTED_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'AED', 'BRL', 'SGD'
]);

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
}

export function validateSavingsDeposit(deposit) {
  const amount = Number(deposit?.amount);
  const currency = String(deposit?.currency || '').trim().toUpperCase();
  const description = String(deposit?.description || 'Savings deposit').trim();
  const savingsDate = String(deposit?.savingsDate || '');

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Savings amount must be greater than zero.');
  }
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    throw new Error('Savings currency is not supported.');
  }
  if (!description) {
    throw new Error('Savings description is required.');
  }
  if (!isValidDate(savingsDate)) {
    throw new Error('Savings date must be a valid YYYY-MM-DD date.');
  }

  return { amount, currency, description, savingsDate };
}

function normalizeSavingsRow(row, userId) {
  if (
    !row ||
    row.user_id !== userId ||
    typeof row.id !== 'string' ||
    !row.id ||
    typeof row.created_at !== 'string' ||
    !Number.isFinite(Date.parse(row.created_at))
  ) {
    throw new Error('Supabase returned an invalid savings record or a record for an unexpected user.');
  }
  const deposit = validateSavingsDeposit({
    amount: row.amount,
    currency: row.currency,
    description: row.description,
    savingsDate: row.savings_date
  });
  return {
    id: row.id,
    userId: row.user_id,
    ...deposit,
    createdAt: row.created_at
  };
}

function throwSupabaseError(error) {
  if (error instanceof Error) throw error;
  throw new Error(
    typeof error?.message === 'string' && error.message
      ? error.message
      : 'Supabase did not confirm the savings operation.'
  );
}

export async function loadSavingsDeposits(supabase, userId) {
  if (!userId) throw new Error('An authenticated user is required to read savings.');
  const { data, error } = await supabase
    .from('savings')
    .select('id,user_id,amount,currency,description,savings_date,created_at')
    .eq('user_id', userId)
    .order('savings_date', { ascending: false });

  if (error) throwSupabaseError(error);
  return (data || []).map((row) => normalizeSavingsRow(row, userId));
}

export async function insertSavingsDeposit(supabase, userId, input) {
  if (!userId) throw new Error('An authenticated user is required to save savings.');
  const deposit = validateSavingsDeposit(input);
  const { data, error } = await supabase
    .from('savings')
    .insert({
      user_id: userId,
      amount: deposit.amount,
      currency: deposit.currency,
      description: deposit.description,
      savings_date: deposit.savingsDate
    })
    .select('id,user_id,amount,currency,description,savings_date,created_at')
    .single();

  if (error) throwSupabaseError(error);
  return normalizeSavingsRow(data, userId);
}

export function summarizeSavingsDeposits(deposits, targetCurrency, currencies, monthKey) {
  let total = 0;
  let monthlyTotal = 0;
  for (const deposit of deposits) {
    const targetRate = currencies[targetCurrency]?.rate || 1;
    const sourceRate = currencies[deposit.currency]?.rate || 1;
    const convertedAmount = Number(deposit.amount) / sourceRate * targetRate;
    if (!Number.isFinite(convertedAmount)) continue;
    total += convertedAmount;
    if (deposit.savingsDate.startsWith(monthKey)) monthlyTotal += convertedAmount;
  }
  return { total, monthlyTotal, count: deposits.length };
}
