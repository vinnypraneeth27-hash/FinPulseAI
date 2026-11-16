/* ==========================================================================
   FinPulse AI - Utilities & Formatting Helpers
   ========================================================================== */

export const CURRENCIES = {
  USD: { symbol: '$', rate: 1.0, label: 'USD ($)' },
  EUR: { symbol: '€', rate: 0.92, label: 'EUR (€)' },
  GBP: { symbol: '£', rate: 0.78, label: 'GBP (£)' },
  INR: { symbol: '₹', rate: 83.5, label: 'INR (₹)' },
  JPY: { symbol: '¥', rate: 155.0, label: 'JPY (¥)' }
};

export const CATEGORY_META = {
  'Food & Dining': { icon: 'utensils', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  'Transportation': { icon: 'car', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  'Housing & Utilities': { icon: 'home', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  'Shopping & Tech': { icon: 'shopping-bag', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
  'Education': { icon: 'graduation-cap', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
  'Entertainment': { icon: 'film', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  'Health & Fitness': { icon: 'heart-pulse', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  'Subscriptions': { icon: 'repeat', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
  'Income': { icon: 'trending-up', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  'Miscellaneous': { icon: 'folder-open', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)' }
};

const CURRENCY_LOCALES = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  INR: 'en-IN',
  JPY: 'ja-JP',
  CAD: 'en-CA',
  AUD: 'en-AU',
  CHF: 'de-CH',
  CNY: 'zh-CN',
  AED: 'en-AE',
  BRL: 'pt-BR',
  SGD: 'en-SG'
};

function getAmountFormat(currencyCode) {
  const locale = CURRENCY_LOCALES[currencyCode] || 'en-US';
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  return {
    locale,
    group: parts.find(part => part.type === 'group')?.value || ',',
    decimal: parts.find(part => part.type === 'decimal')?.value || '.'
  };
}

function getAmountDigits(value, currencyCode) {
  const { group, decimal } = getAmountFormat(currencyCode);
  const ungrouped = String(value ?? '').split(group).join('');
  const parts = ungrouped.split(decimal);
  return {
    integerDigits: parts[0].replace(/\D/g, ''),
    fractionDigits: parts.slice(1).join('').replace(/\D/g, '').slice(0, 2),
    hasDecimal: parts.length > 1
  };
}

function formatIntegerDigits(digits, locale) {
  return digits
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
      .format(Number(digits))
    : '';
}

export function formatLocalizedAmount(amount, currencyCode = 'USD') {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return '';

  return new Intl.NumberFormat(
    getAmountFormat(currencyCode).locale,
    { maximumFractionDigits: 2 }
  ).format(numericAmount);
}

export function formatLocalizedAmountInput(
  value,
  sourceCurrency = 'USD',
  targetCurrency = sourceCurrency,
  caretPosition = String(value ?? '').length
) {
  const source = getAmountFormat(sourceCurrency);
  const target = getAmountFormat(targetCurrency);
  const raw = String(value ?? '');
  const prefix = raw.slice(0, Math.max(0, caretPosition));
  const parts = getAmountDigits(raw, sourceCurrency);
  const prefixParts = getAmountDigits(prefix, sourceCurrency);
  const prefixHasDecimal = prefixParts.hasDecimal;

  const formattedInteger = formatIntegerDigits(parts.integerDigits, target.locale);
  let formattedValue = formattedInteger;
  if (parts.hasDecimal) {
    formattedValue += target.decimal + parts.fractionDigits;
  }

  let formattedCaret = 0;
  if (prefixHasDecimal) {
    const decimalIndex = formattedValue.indexOf(target.decimal);
    formattedCaret = decimalIndex < 0 ? formattedValue.length : decimalIndex + 1;
    let remainingFractionDigits = prefixParts.fractionDigits.length;
    while (formattedCaret < formattedValue.length && remainingFractionDigits > 0) {
      if (/\d/.test(formattedValue[formattedCaret])) remainingFractionDigits--;
      formattedCaret++;
    }
  } else {
    let remainingIntegerDigits = prefixParts.integerDigits.length;
    while (formattedCaret < formattedValue.length && remainingIntegerDigits > 0) {
      if (/\d/.test(formattedValue[formattedCaret])) remainingIntegerDigits--;
      formattedCaret++;
    }
    if (
      prefix.endsWith(source.group) &&
      source.group === target.group &&
      formattedValue[formattedCaret] === target.group
    ) {
      formattedCaret++;
    }
  }

  return { value: formattedValue, caretPosition: formattedCaret };
}

export function parseLocalizedAmount(value, currencyCode = 'USD') {
  const { integerDigits, fractionDigits, hasDecimal } =
    getAmountDigits(value, currencyCode);

  if (!integerDigits && !fractionDigits) return Number.NaN;

  const numericValue =
    `${integerDigits || '0'}${hasDecimal ? `.${fractionDigits}` : ''}`;
  return Number(numericValue);
}

/**
 * Format raw number to current currency string
 */
export function formatCurrency(amount, currencyCode = 'USD') {
  const curr = CURRENCIES[currencyCode] || CURRENCIES.USD;
  const converted = amount * curr.rate;

  if (currencyCode === 'JPY') {
    return `${curr.symbol}${Math.round(converted).toLocaleString()}`;
  }
  return `${curr.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format YYYY-MM-DD date string to readable format
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Intelligently parse numerical amounts from text, including:
 * - "70 thousand" or "70 000" or "70k" -> 70000
 * - "5 thousand" -> 5000
 * - "1 lakh" / "1 lac" -> 100000
 * - "2.5 million" -> 2500000
 */
export function extractAmountFromText(userText) {
  if (!userText) return null;
  let text = userText.toLowerCase().trim();

  // Normalize space-separated numbers (e.g., "70 000" -> "70000", "1 000 000" -> "1000000")
  text = text.replace(/(\b\d{1,3})\s+(\d{3})\b/g, '$1$2');
  text = text.replace(/(\b\d{1,3})\s+(\d{3})\s+(\d{3})\b/g, '$1$2$3');

  // Match pattern with word or abbreviation suffixes (e.g., "70 thousand", "70k", "70 grand", "1 lakh", "2.5 million")
  const suffixMatch = text.match(/(?:[\$€£₹¥]|USD|EUR|GBP|INR|JPY|CAD|AUD|CHF|CNY|AED|BRL|SGD)?\s*([\d,]+(?:\.\d+)?)\s*(thousand|k|grand|lakh|lac|million|m)\b/i);
  if (suffixMatch) {
    let baseNum = parseFloat(suffixMatch[1].replace(/,/g, ''));
    const unit = suffixMatch[2].toLowerCase();
    if (unit === 'thousand' || unit === 'k' || unit === 'grand') {
      baseNum *= 1000;
    } else if (unit === 'lakh' || unit === 'lac') {
      baseNum *= 100000;
    } else if (unit === 'million' || unit === 'm') {
      baseNum *= 1000000;
    }
    return baseNum;
  }

  // Standard numeric match (e.g. 70000, 70,000, 70000.50)
  const stdMatch = text.match(/(?:[\$€£₹¥]|USD|EUR|GBP|INR|JPY|CAD|AUD|CHF|CNY|AED|BRL|SGD)?\s*([\d,]+(?:\.\d+)?)/i);
  if (stdMatch) {
    const rawVal = parseFloat(stdMatch[1].replace(/,/g, ''));
    if (!isNaN(rawVal) && rawVal > 0) return rawVal;
  }

  return null;
}

/**
 * Calculate Financial Health Score (0 to 100)
 */
export function calculateHealthScore(totalIncome, totalExpenses, budgetLimits, actualByCategory) {
  // New User Account with 0 transactions -> 100 Health Score
  if ((!totalIncome || totalIncome <= 0) && (!totalExpenses || totalExpenses <= 0)) {
    return 100;
  }
  if (!totalIncome || totalIncome <= 0) return 65;

  // 1. Savings Rate Component (max 40 pts)
  const savingsRate = Math.max(0, (totalIncome - totalExpenses) / totalIncome);
  const savingsScore = Math.min(40, savingsRate * 100);

  // 2. Budget Adherence Component (max 40 pts)
  let overBudgetCount = 0;
  let totalBudgets = 0;

  for (const cat in budgetLimits) {
    totalBudgets++;
    const spent = actualByCategory[cat] || 0;
    if (spent > budgetLimits[cat]) {
      overBudgetCount++;
    }
  }
  const budgetScore = totalBudgets > 0 ? ((totalBudgets - overBudgetCount) / totalBudgets) * 40 : 35;

  // 3. Expense-to-Income Ratio (max 20 pts)
  const expRatio = totalExpenses / totalIncome;
  let ratioScore = 20;
  if (expRatio > 0.9) ratioScore = 5;
  else if (expRatio > 0.75) ratioScore = 12;

  const totalScore = Math.round(savingsScore + budgetScore + ratioScore);
  return Math.min(99, Math.max(20, totalScore));
}

/**
 * Trigger CSV file download from transaction array
 */
export function exportTransactionsToCSV(transactions, currencyCode = 'USD') {
  if (!transactions.length) return;

  const headers = ['ID', 'Date', 'Type', 'Title', 'Category', 'Amount (' + currencyCode + ')', 'Payment Method', 'Recurring'];
  const rows = transactions.map(t => [
    t.id,
    t.date,
    t.type,
    `"${t.title.replace(/"/g, '""')}"`,
    t.category,
    t.amount,
    t.paymentMethod,
    t.recurring || 'false'
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `FinPulse_Transactions_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
