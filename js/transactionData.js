export async function loadExpensesForDate(supabase, userId, date) {
  if (!userId) throw new Error('An authenticated user is required to read expenses.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
    throw new Error('Expense date must use YYYY-MM-DD format.');
  }
  const [year, month, day] = date.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);
  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    throw new Error('Expense date must be a valid calendar date.');
  }

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .eq('transaction_type', 'expense')
    .eq('expense_date', date);
  if (error) {
    throw error instanceof Error
      ? error
      : new Error(
        typeof error?.message === 'string' && error.message
          ? error.message
          : 'Supabase could not load expenses for the requested date.'
      );
  }
  return data || [];
}
