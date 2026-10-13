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
  const recordType = String(deposit?.recordType || 'contribution').trim().toLowerCase();
  const requestId = String(deposit?.requestId || '').trim();

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
  if (!['contribution', 'transfer'].includes(recordType)) {
    throw new Error('Savings record type must be a contribution or transfer.');
  }
  if (requestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new Error('Savings request id must be a valid UUID.');
  }

  return { amount, currency, description, savingsDate, recordType, requestId };
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
    savingsDate: row.savings_date,
    recordType: row.record_type || 'contribution',
    requestId: row.request_id || ''
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
    .select('id,user_id,amount,currency,description,savings_date,record_type,request_id,created_at')
    .eq('user_id', userId)
    .order('savings_date', { ascending: false });

  if (error) throwSupabaseError(error);
  return (data || []).map((row) => normalizeSavingsRow(row, userId));
}

export async function insertSavingsDeposit(supabase, userId, input) {
  if (!userId) throw new Error('An authenticated user is required to save savings.');
  const requestId = input?.requestId || globalThis.crypto?.randomUUID?.();
  if (!requestId) {
    throw new Error('A unique savings request id is required to prevent duplicate records.');
  }
  const deposit = validateSavingsDeposit({
    ...input,
    requestId
  });
  const selectedFields = 'id,user_id,amount,currency,description,savings_date,record_type,request_id,created_at';
  const payload = {
    user_id: userId,
    amount: deposit.amount,
    currency: deposit.currency,
    description: deposit.description,
    savings_date: deposit.savingsDate,
    record_type: deposit.recordType,
    request_id: deposit.requestId
  };
  const { data, error } = await supabase
    .from('savings')
    .insert(payload)
    .select(selectedFields)
    .single();

  if (error?.code === '23505') {
    const existing = await supabase
      .from('savings')
      .select(selectedFields)
      .eq('user_id', userId)
      .eq('request_id', deposit.requestId)
      .maybeSingle();
    if (existing.error) throwSupabaseError(existing.error);
    if (!existing.data) throwSupabaseError(error);
    const existingDeposit = normalizeSavingsRow(existing.data, userId);
    if (
      existingDeposit.amount !== deposit.amount ||
      existingDeposit.currency !== deposit.currency ||
      existingDeposit.recordType !== deposit.recordType ||
      existingDeposit.description !== deposit.description ||
      existingDeposit.savingsDate !== deposit.savingsDate
    ) {
      throw new Error('This savings request id was already used for a different record.');
    }
    return existingDeposit;
  }
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
