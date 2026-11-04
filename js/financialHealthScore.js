export const FINANCIAL_HEALTH_SCORE_VERSION = '1';

export const FINANCIAL_HEALTH_COMPONENTS = [
  { key: 'spending_control', label: 'Spending Control', weight: 25 },
  { key: 'saving_habits', label: 'Saving Habits', weight: 25 },
  { key: 'budget_management', label: 'Budget Management', weight: 20 },
  { key: 'financial_consistency', label: 'Financial Consistency', weight: 15 },
  { key: 'emergency_preparedness', label: 'Emergency Preparedness', weight: 15 }
];

function isValidMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month] = value.split('-').map(Number);
  return year >= 1 && year <= 9999 && month >= 1 && month <= 12;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || year > 9999 || month < 1 || month > 12) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= daysInMonth;
}

function previousMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonthNumber = month === 1 ? 12 : month - 1;
  if (previousYear < 1) throw new Error('Assessment month has no supported previous month.');
  return `${String(previousYear).padStart(4, '0')}-${String(previousMonthNumber).padStart(2, '0')}`;
}

function getDate(row, fields) {
  for (const field of fields) {
    const value = String(row?.[field] || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  }
  return '';
}

function validAmount(row) {
  const amount = Number(row?.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function isInMonth(date, monthKey, dateLimit = null) {
  return isValidDate(date) && date.startsWith(`${monthKey}-`) && (!dateLimit || date <= dateLimit);
}

function sameCurrency(row, currency) {
  return typeof row?.currency === 'string' &&
    row.currency.trim().toUpperCase() === currency;
}

function sumAmounts(rows) {
  return rows.reduce((total, row) => total + row.amount, 0);
}

function atMost(value, threshold) {
  return value <= threshold + 1e-10;
}

function spendingControlPoints(expenseRatio) {
  if (atMost(expenseRatio, 50)) return 25;
  if (atMost(expenseRatio, 70)) return 20;
  if (atMost(expenseRatio, 90)) return 12;
  if (atMost(expenseRatio, 100)) return 5;
  return 0;
}

function savingHabitsPoints(savingsRate) {
  if (savingsRate === 0) return 0;
  if (savingsRate < 5) return 5;
  if (savingsRate < 10) return 10;
  if (savingsRate < 15) return 15;
  if (savingsRate < 20) return 20;
  return 25;
}

function budgetManagementPoints(budgetUsage) {
  if (atMost(budgetUsage, 80)) return 20;
  if (atMost(budgetUsage, 100)) return 16;
  if (atMost(budgetUsage, 110)) return 10;
  if (atMost(budgetUsage, 125)) return 5;
  return 0;
}

function emergencyPreparednessPoints(coverageMonths) {
  if (coverageMonths >= 6) return 15;
  if (coverageMonths >= 3) return 12;
  if (coverageMonths >= 2) return 9;
  if (coverageMonths >= 1) return 5;
  return 2;
}

export function getFinancialHealthScoreLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Healthy';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Developing';
  return 'Needs Attention';
}

function unavailable(reason, metrics = {}) {
  return { available: false, earned: 0, reason, metrics };
}

function available(earned, metrics) {
  return { available: true, earned, metrics };
}

function isUsableTransaction(row, type, currency) {
  return String(row?.transaction_type || '').toLowerCase() === type &&
    sameCurrency(row, currency) &&
    validAmount(row) !== null;
}

function filteredTransactions(expenses, type, currency, monthKey, dateLimit = null) {
  return expenses
    .filter((row) => {
      const date = getDate(row, ['expense_date']);
      return isInMonth(date, monthKey, dateLimit) &&
        isUsableTransaction(row, type, currency);
    })
    .map((row) => ({ row, amount: validAmount(row) }));
}

function hasUnknownCurrencyTransactions(expenses, type, monthKey, dateLimit = null) {
  return expenses.some((row) => {
    const date = getDate(row, ['expense_date']);
    return String(row?.transaction_type || '').toLowerCase() === type &&
      isInMonth(date, monthKey, dateLimit) &&
      !String(row?.currency || '').trim();
  });
}

function filteredSavings(savings, currency, monthKey, dateLimit = null) {
  return savings
    .filter((row) => {
      const date = getDate(row, ['savings_date', 'savingsDate']);
      return isInMonth(date, monthKey, dateLimit) &&
        sameCurrency(row, currency) &&
        validAmount(row) !== null;
    })
    .map((row) => ({ row, amount: validAmount(row) }));
}

function validBudgets(budgets, currency, monthKey) {
  return budgets.filter((row) => {
    const period = getDate(row, ['period_start']);
    const amount = Number(row?.amount);
    return period === `${monthKey}-01` &&
      sameCurrency(row, currency) &&
      Number.isFinite(amount) &&
      amount > 0 &&
      typeof row?.category === 'string' &&
      row.category.trim().length > 0;
  });
}

function previousMonthConsistency(expenses, currency, monthKey, dataCompleteness) {
  const months = [];
  let month = previousMonth(monthKey);
  for (let index = 0; index < 3; index += 1) {
    if (dataCompleteness.expenses !== true) {
      return unavailable('Expense and income history is incomplete for the previous three months.', { months: [] });
    }
    const incomeRows = filteredTransactions(expenses, 'income', currency, month);
    const expenseRows = filteredTransactions(expenses, 'expense', currency, month);
    if (
      hasUnknownCurrencyTransactions(expenses, 'income', month) ||
      hasUnknownCurrencyTransactions(expenses, 'expense', month)
    ) {
      return unavailable('Currency-ambiguous transactions make completed-month totals incomplete.', { months: [] });
    }
    months.push({
      month,
      income: sumAmounts(incomeRows),
      expenses: sumAmounts(expenseRows)
    });
    month = previousMonth(month);
  }

  const positiveMonths = months.filter((entry) => entry.income > entry.expenses).length;
  const earned = positiveMonths === 3 ? 15 : positiveMonths === 2 ? 10 : positiveMonths === 1 ? 5 : 0;
  return available(earned, { months, positiveMonths });
}

function previousThreeMonths(monthKey) {
  const months = [];
  let month = previousMonth(monthKey);
  for (let index = 0; index < 3; index += 1) {
    months.push(month);
    month = previousMonth(month);
  }
  return months;
}

function averageEssentialExpenses(expenses, budgets, currency, assessmentMonth) {
  const months = previousThreeMonths(assessmentMonth);
  const monthlyTotals = [];

  for (const month of months) {
    const essentialCategories = new Set(
      validBudgets(budgets, currency, month)
        .filter((row) => row.is_essential === true)
        .map((row) => row.category)
    );
    if (!essentialCategories.size) {
      return unavailable(`Valid essential budgets are unavailable for ${month}.`, { months: monthlyTotals });
    }

    let total = 0;
    for (const row of expenses) {
      const date = getDate(row, ['expense_date']);
      if (
        String(row?.transaction_type || '').toLowerCase() !== 'expense' ||
        !isValidDate(date) ||
        !date.startsWith(`${month}-`) ||
        !essentialCategories.has(row.category)
      ) continue;

      const amount = validAmount(row);
      if (!sameCurrency(row, currency) || amount === null) {
        return unavailable(`Essential expense data for ${month} is not currency-compatible or valid.`, {
          months: monthlyTotals
        });
      }
      total += amount;
    }
    monthlyTotals.push({ month, expenses: total });
  }

  const average = sumAmounts(monthlyTotals.map((entry) => ({ amount: entry.expenses }))) / 3;
  if (average <= 0) {
    return unavailable('The average essential expenses for the previous three months must be greater than zero.', {
      months: monthlyTotals,
      average
    });
  }
  return available(average, { months: monthlyTotals, average });
}

function emergencyPreparedness(
  expenses,
  savings,
  budgets,
  currency,
  dateLimit,
  assessmentMonth,
  dataCompleteness,
) {
  if (dataCompleteness.savings !== true || dataCompleteness.emergencySavingsHistory !== true) {
    return unavailable('A complete, verified emergency savings opening balance and movement history is unavailable.');
  }
  if (dataCompleteness.expenses !== true || dataCompleteness.budgets !== true) {
    return unavailable('Complete expense and budget data is required for emergency coverage.');
  }

  const emergencyRows = savings
    .filter((row) => {
      const date = getDate(row, ['savings_date', 'savingsDate']);
      return isValidDate(date) &&
        date <= dateLimit &&
        row?.is_emergency === true &&
        sameCurrency(row, currency) &&
        validAmount(row) !== null &&
        ['contribution', 'withdrawal'].includes(String(row?.record_type || row?.recordType || '').toLowerCase());
    })
    .map((row) => ({
      type: String(row.record_type || row.recordType).toLowerCase(),
      amount: validAmount(row)
    }));

  if (!emergencyRows.length) {
    return unavailable('No emergency savings records have been explicitly identified.');
  }

  const essentialExpenseAssessment = averageEssentialExpenses(
    expenses,
    budgets,
    currency,
    assessmentMonth
  );
  if (!essentialExpenseAssessment.available) {
    return unavailable(essentialExpenseAssessment.reason, essentialExpenseAssessment.metrics);
  }

  const emergencyBalance = emergencyRows.reduce((balance, row) => {
    if (row.type === 'contribution') return balance + row.amount;
    return balance - row.amount;
  }, 0);
  if (emergencyBalance < 0) {
    return unavailable('Emergency savings withdrawals exceed identified contributions.');
  }

  const coverageMonths = emergencyBalance / essentialExpenseAssessment.earned;
  return available(emergencyPreparednessPoints(coverageMonths), {
    emergencyBalance,
    essentialMonthlyExpenses: essentialExpenseAssessment.earned,
    monthlyEssentialExpenses: essentialExpenseAssessment.metrics.months,
    coverageMonths
  });
}

export function calculateFinancialHealthAssessment({
  expenses = [],
  savings = [],
  budgets = [],
  dataCompleteness = {},
  emergencySavingsHistoryComplete = false,
  currency,
  assessmentMonth,
  dateLimit = `${assessmentMonth}-31`
}) {
  const normalizedCurrency = String(currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new Error('A valid assessment currency is required.');
  }
  if (!isValidMonth(assessmentMonth)) {
    throw new Error('Assessment month must use YYYY-MM format.');
  }
  if (!isValidDate(String(dateLimit || '')) || !String(dateLimit).startsWith(`${assessmentMonth}-`)) {
    throw new Error('Assessment date limit must use YYYY-MM-DD format.');
  }
  const completeness = {
    expenses: dataCompleteness.expenses === true,
    savings: dataCompleteness.savings === true,
    budgets: dataCompleteness.budgets === true,
    emergencySavingsHistory: emergencySavingsHistoryComplete === true
  };

  const monthIncomeRows = filteredTransactions(expenses, 'income', normalizedCurrency, assessmentMonth, dateLimit);
  const monthExpenseRows = filteredTransactions(expenses, 'expense', normalizedCurrency, assessmentMonth, dateLimit);
  const monthlyIncome = sumAmounts(monthIncomeRows);
  const monthlyExpenses = sumAmounts(monthExpenseRows);
  const monthSavingsRows = filteredSavings(savings, normalizedCurrency, assessmentMonth, dateLimit);
  const monthBudgets = validBudgets(budgets, normalizedCurrency, assessmentMonth);

  const components = {};

  if (!completeness.expenses ||
      !monthIncomeRows.length ||
      monthlyIncome <= 0 ||
      hasUnknownCurrencyTransactions(expenses, 'income', assessmentMonth, dateLimit) ||
      hasUnknownCurrencyTransactions(expenses, 'expense', assessmentMonth, dateLimit)) {
    components.spending_control = unavailable('Compatible current-month income and expense transactions are required.');
  } else {
    const expenseRatio = monthlyExpenses / monthlyIncome * 100;
    components.spending_control = available(spendingControlPoints(expenseRatio), {
      monthlyIncome,
      monthlyExpenses,
      expenseRatio
    });
  }

  const unknownCurrencySavingsContribution = savings.some((row) => {
    const date = getDate(row, ['savings_date', 'savingsDate']);
    return isInMonth(date, assessmentMonth, dateLimit) &&
      !String(row?.currency || '').trim() &&
      String(row?.record_type || row?.recordType || '').toLowerCase() === 'contribution';
  });
  if (!completeness.expenses ||
      !completeness.savings ||
      !monthIncomeRows.length ||
      monthlyIncome <= 0 ||
      unknownCurrencySavingsContribution ||
      hasUnknownCurrencyTransactions(expenses, 'income', assessmentMonth, dateLimit)) {
    components.saving_habits = unavailable('Compatible current-month income and savings activity are required.');
  } else {
    const contributions = monthSavingsRows
      .filter(({ row }) => String(row.record_type || row.recordType || '').toLowerCase() === 'contribution')
      .reduce((total, row) => total + row.amount, 0);
    const savingsRate = contributions / monthlyIncome * 100;
    components.saving_habits = available(savingHabitsPoints(savingsRate), {
      monthlyIncome,
      genuineContributions: contributions,
      savingsRate
    });
  }

  if (!completeness.budgets || !monthBudgets.length) {
    components.budget_management = unavailable('Valid current-month budgets are unavailable.');
  } else if (!completeness.expenses ||
      hasUnknownCurrencyTransactions(expenses, 'expense', assessmentMonth, dateLimit)) {
    components.budget_management = unavailable('Compatible current-month expense transactions are unavailable.');
  } else {
    const matchingBudgets = new Map(monthBudgets.map((row) => [row.category, Number(row.amount)]));
    const matchedExpenseRows = monthExpenseRows
      .filter(({ row }) => matchingBudgets.has(row.category));
    const totalMatchedBudget = [...matchingBudgets.values()].reduce((total, amount) => total + amount, 0);
    const totalMatchedSpending = sumAmounts(matchedExpenseRows);
    if (!Number.isFinite(totalMatchedBudget) || totalMatchedBudget <= 0) {
      components.budget_management = unavailable('No valid current-month budget totals are available.');
    } else {
      const budgetUsage = totalMatchedSpending / totalMatchedBudget * 100;
      components.budget_management = available(budgetManagementPoints(budgetUsage), {
        totalMatchedSpending,
        totalMatchedBudget,
        budgetUsage,
        matchedCategories: [...new Set(matchedExpenseRows.map(({ row }) => row.category))]
      });
    }
  }

  components.financial_consistency = previousMonthConsistency(
    expenses,
    normalizedCurrency,
    assessmentMonth,
    completeness
  );
  components.emergency_preparedness = emergencyPreparedness(
    expenses,
    savings,
    budgets,
    normalizedCurrency,
    dateLimit,
    assessmentMonth,
    completeness,
  );

  const componentScores = {};
  let availableWeight = 0;
  let earnedPoints = 0;
  let availableComponentCount = 0;
  for (const component of FINANCIAL_HEALTH_COMPONENTS) {
    const result = components[component.key];
    componentScores[component.key] = {
      label: component.label,
      weight: component.weight,
      available: result.available,
      earned: result.earned,
      reason: result.reason || null,
      metrics: result.metrics
    };
    if (!result.available) continue;
    availableWeight += component.weight;
    earnedPoints += result.earned;
    availableComponentCount += 1;
  }

  const coveragePercentage = availableWeight;
  const hasSufficientCoverage = coveragePercentage >= 60 && availableComponentCount >= 3;
  const score = hasSufficientCoverage
    ? Math.round(earnedPoints / availableWeight * 100)
    : null;

  return {
    score,
    label: score === null ? 'Insufficient Data' : getFinancialHealthScoreLabel(score),
    coverage_percentage: coveragePercentage,
    available_weight: availableWeight,
    status: hasSufficientCoverage ? 'ready' : 'insufficient_data',
    component_scores: componentScores,
    calculation_version: FINANCIAL_HEALTH_SCORE_VERSION,
    assessment_month: assessmentMonth,
    assessment_currency: normalizedCurrency,
    available_component_count: availableComponentCount
  };
}
