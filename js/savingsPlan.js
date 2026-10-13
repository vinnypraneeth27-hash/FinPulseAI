export const SAVINGS_PERCENTAGES = [10, 20, 30];

export function extractMonthlyIncomeFromText(message, fallbackCurrency) {
  const match = String(message || '').match(
    /\b(?:earn(?:s|ed|ing)?|salary|income)\b\s*(?:(?:is|of)\s*|:\s*)?(CA\$|A\$|R\$|S\$|₹|\$|€|£|¥|\b(?:INR|USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|AED|BRL|SGD)\b)?\s*(\d[\d,]*(?:\.\d+)?)(?:\s*(thousand|grand|lakh|lac|million|k|m))?\b/i
  );
  if (!match) return null;

  const baseAmount = Number(match[2].replace(/,/g, ''));
  const multiplier = {
    thousand: 1000,
    grand: 1000,
    lakh: 100000,
    lac: 100000,
    million: 1000000,
    k: 1000,
    m: 1000000
  }[String(match[3] || '').toLowerCase()] || 1;
  const amount = baseAmount * multiplier;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const token = String(match[1] || '').toUpperCase();
  const symbolCurrencies = {
    '₹': 'INR',
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    'CA$': 'CAD',
    'A$': 'AUD',
    'R$': 'BRL',
    'S$': 'SGD'
  };
  const currency = symbolCurrencies[token] || token || fallbackCurrency;
  return { amount, currency };
}

export function calculateSavingsPlan(monthlyIncome, monthlyExpenses, percentage = 20) {
  const income = Number(monthlyIncome);
  const expenses = Number(monthlyExpenses);

  if (!Number.isFinite(expenses) || expenses < 0) {
    throw new Error('Monthly expenses must be a valid non-negative amount.');
  }
  if (!SAVINGS_PERCENTAGES.includes(Number(percentage))) {
    throw new Error('Savings percentage must be 10, 20, or 30.');
  }
  if (!Number.isFinite(income) || income <= 0) {
    return {
      status: 'missing_income',
      monthlyIncome: null,
      monthlyExpenses: expenses,
      availableBalance: null,
      percentage: Number(percentage),
      monthlyTarget: null,
      monthlySavings: null,
      projections: null
    };
  }

  const availableBalance = income - expenses;
  const monthlyTarget = income * Number(percentage) / 100;
  const monthlySavings = availableBalance <= 0
    ? 0
    : Math.min(monthlyTarget, availableBalance);

  return {
    status: availableBalance < 0 ? 'expenses_exceed_income' : availableBalance === 0 ? 'no_available_balance' : 'ready',
    monthlyIncome: income,
    monthlyExpenses: expenses,
    availableBalance,
    percentage: Number(percentage),
    monthlyTarget,
    monthlySavings,
    projections: {
      3: monthlySavings * 3,
      6: monthlySavings * 6,
      12: monthlySavings * 12
    }
  };
}
