export function localMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function yesterdayDateKey(date = new Date()) {
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1));
}

export function normalizeTransactionDescription(value) {
  const description = String(value ?? '').trim();
  return !description || /^(undefined|null)$/i.test(description) ? 'Transaction' : description;
}

export function classifyFinancialIntent(message) {
  const text = String(message || '').trim().toLowerCase();
  if (/^(hi+|hey+|hello|helo|hallo|yo|hola|namaste|good morning|good afternoon|good evening)[!. ]*$/.test(text)) {
    return 'greeting';
  }
  if (
    /\b(?:save|add|record|log|deposit|transfer)\b.{0,60}\b(?:my\s+)?recommended\s+(?:monthly\s+)?savings\b/.test(text) ||
    /\b(?:add|record|log|deposit|transfer)\b.{0,60}\b(?:savings?|saving\s+goal)\b/.test(text) ||
    /^\s*i\s+(?:saved|set aside)\b/.test(text) ||
    /\b(?:today|yesterday),?\s+i\s+(?:saved|set aside)\b/.test(text) ||
    (/\b(?:save|add|record|log|deposit|transfer)\b/.test(text) && /\bsavings?\b/.test(text))
  ) {
    return 'savings_record_request';
  }
  if (/\b(?:savings?|saving)\b.{0,35}\bprogress\b|\bprogress\b.{0,35}\b(?:savings?|saving)\b/.test(text)) {
    return 'savings_progress_inquiry';
  }
  if (
    /\b(?:how much|what amount)\b.{0,80}\b(?:should|can|could)\s+i\s+save\b/.test(text) ||
    (
      /\b(?:suggest|recommend)\b.{0,50}\b(?:savings?|saving\s+plan)\b/.test(text) &&
      !/\b(?:budget|pattern|strategy|strategies)\b/.test(text)
    ) ||
    (/\bsavings?\s+plan\b/.test(text) && !/\b(?:budget|pattern|strategy|strategies)\b/.test(text)) ||
    /\bhow much\b.{0,60}\b(?:save|savings?)\b.{0,40}\b(?:\d+\s*months?|three months?|six months?|twelve months?|year)\b/.test(text)
  ) {
    return 'savings_plan_inquiry';
  }
  if (
    /\b(yesterday)\b/.test(text) &&
    /\b(spend(?:ing)?|spent|expenses?|expense)\b/.test(text)
  ) {
    return 'yesterday_expense_inquiry';
  }
  if (/\b(next month|future)\b/.test(text) && /\b(spend(?:ing)?|expenses?|cost)\b/.test(text)) {
    return 'future_spending_inquiry';
  }
  if (/\b(recent|latest)\b/.test(text) && /\b(transactions?|activity)\b/.test(text)) {
    return 'recent_transactions_inquiry';
  }
  if ((
    /\b(suggest|recommend|advice|plan|pattern|strategy|strategies)\b/.test(text) &&
    /\b(budget|sav(?:e|ing|ings)|spend|expense|income|money|month)\b/.test(text)
  ) || (
    /\bhow\s+(?:can|could|should)\s+i\s+save\b/.test(text) &&
    /\b(?:this month|monthly|budget|spending)\b/.test(text)
  ) || (
    /\bwhich\b.{0,50}\b(?:category|categories)\b.{0,50}\boverspend(?:ing)?\b/.test(text) ||
    /\boverspend(?:ing)?\b.{0,50}\b(?:category|categories)\b/.test(text)
  )) {
    return 'budget_advice';
  }
  if (!/\b(how much|what(?:'s| is| are| was| did)|show|display|tell me|summari[sz]e|summary|list|check)\b/.test(text)) {
    return 'general';
  }
  if (/\b(balance|available (?:funds|money))\b/.test(text) ||
    /\bmoney\b.{0,30}\bi\b.{0,20}\bhave\b/.test(text)) {
    return 'balance_inquiry';
  }
  const currentMonth = /\b(this month|month to date|current month)\b/.test(text);
  if (/\b(spend(?:ing)?|spent|expenses?)\b/.test(text)) {
    return currentMonth ? 'monthly_expense_inquiry' : 'expense_inquiry';
  }
  if (/\b(income|earnings?|earned)\b/.test(text)) {
    return currentMonth ? 'monthly_income_inquiry' : 'income_inquiry';
  }
  if (/\b(savings?|saved|surplus)\b/.test(text)) {
    return currentMonth ? 'monthly_savings_inquiry' : 'savings_inquiry';
  }
  return 'general';
}

export function summarizeTransactions(transactions, targetCurrency, currencies, date = new Date()) {
  const month = localMonthKey(date);
  const targetRate = currencies[targetCurrency]?.rate || 1;
  const totals = {
    income: 0,
    expenses: 0,
    balance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    monthlyBalance: 0,
    categoryExpenses: {},
    monthlyCategoryExpenses: {},
    transactionCount: transactions.length,
    monthlyTransactions: []
  };

  for (const transaction of transactions) {
    const type = String(transaction.type || transaction.transaction_type || '').toLowerCase();
    if (type !== 'income' && type !== 'expense') continue;

    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const sourceCurrency = transaction.currency || targetCurrency;
    const sourceRate = currencies[sourceCurrency]?.rate || 1;
    const baseAmount = transaction.baseAmount != null && Number.isFinite(Number(transaction.baseAmount))
      ? Number(transaction.baseAmount)
      : amount / sourceRate;
    const convertedAmount = baseAmount * targetRate;
    const isCurrentMonth = String(transaction.date || '').slice(0, 7) === month;

    if (isCurrentMonth) {
      const { id, ...monthTransaction } = transaction;
      totals.monthlyTransactions.push({
        ...monthTransaction,
        amount: convertedAmount,
        type
      });
    }

    if (type === 'income') {
      totals.income += convertedAmount;
      if (isCurrentMonth) totals.monthlyIncome += convertedAmount;
    } else {
      totals.expenses += convertedAmount;
      const category = transaction.category || 'Miscellaneous';
      totals.categoryExpenses[category] = (totals.categoryExpenses[category] || 0) + convertedAmount;
      if (isCurrentMonth) {
        totals.monthlyExpenses += convertedAmount;
        totals.monthlyCategoryExpenses[category] = (totals.monthlyCategoryExpenses[category] || 0) + convertedAmount;
      }
    }
  }

  totals.balance = totals.income - totals.expenses;
  totals.monthlyBalance = totals.monthlyIncome - totals.monthlyExpenses;
  return totals;
}

export function estimateNextMonthSpending(transactions, currency, currencies, date = new Date()) {
  const totals = summarizeTransactions(transactions, currency, currencies, date);
  if (totals.monthlyExpenses <= 0) return null;

  const elapsedDays = date.getDate();
  const nextMonthDays = new Date(date.getFullYear(), date.getMonth() + 2, 0).getDate();
  if (elapsedDays <= 0 || nextMonthDays <= 0) return null;

  return {
    amount: totals.monthlyExpenses / elapsedDays * nextMonthDays,
    observedMonth: localMonthKey(date),
    observedExpenses: totals.monthlyExpenses,
    elapsedDays,
    nextMonthDays
  };
}
