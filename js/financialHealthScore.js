export const FINANCIAL_HEALTH_SCORE_VERSION = '2';

export const FINANCIAL_HEALTH_COMPONENTS = [
  { key: 'spending_control', label: 'Spending Control', weight: 40 },
  { key: 'saving_habits', label: 'Saving Habits', weight: 30 },
  { key: 'budget_management', label: 'Budget Management', weight: 30 }
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
  if (atMost(expenseRatio, 50)) return 40;
  if (atMost(expenseRatio, 70)) return 32;
  if (atMost(expenseRatio, 90)) return 19;
  if (atMost(expenseRatio, 100)) return 8;
  return 0;
}

function savingHabitsPoints(savingsRate) {
  if (savingsRate === 0) return 0;
  if (savingsRate < 5) return 6;
  if (savingsRate < 10) return 12;
  if (savingsRate < 15) return 18;
  if (savingsRate < 20) return 24;
  return 30;
}

function budgetManagementPoints(budgetUsage) {
  if (atMost(budgetUsage, 80)) return 30;
  if (atMost(budgetUsage, 100)) return 24;
  if (atMost(budgetUsage, 110)) return 15;
  if (atMost(budgetUsage, 125)) return 8;
  return 0;
}

export function getFinancialHealthScoreLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Improvement';
  return 'Needs Attention';
}

function unavailable(reason, metrics = {}) {
  return { available: false, earned: 0, reason, metrics };
}

function available(earned, metrics) {
  return { available: true, earned, metrics };
}

function isUsableTransaction(row, type, currency) {
  return String(row?.transaction_type || '').trim().toLowerCase() === type &&
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
    return String(row?.transaction_type || '').trim().toLowerCase() === type &&
      isInMonth(date, monthKey, dateLimit) &&
      !String(row?.currency || '').trim();
  });
}

function hasMismatchedCurrencyTransactions(expenses, type, currency, monthKey, dateLimit = null) {
  return expenses.some((row) => {
    const date = getDate(row, ['expense_date']);
    const rowCurrency = String(row?.currency || '').trim();
    return String(row?.transaction_type || '').trim().toLowerCase() === type &&
      isInMonth(date, monthKey, dateLimit) &&
      rowCurrency.length > 0 &&
      rowCurrency.toUpperCase() !== currency;
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

function unavailableAssessmentReason(components, coveragePercentage, availableComponentCount) {
  const unavailableComponents = FINANCIAL_HEALTH_COMPONENTS
    .filter((component) => !components[component.key].available)
    .map((component) => `${component.label}: ${components[component.key].reason}`);
  const thresholds = [];
  if (coveragePercentage < 60) thresholds.push('at least 60% available weight');
  if (availableComponentCount < 2) thresholds.push('at least 2 available indicators');
  return `Insufficient data: ${coveragePercentage}% weight across ${availableComponentCount} of ${FINANCIAL_HEALTH_COMPONENTS.length} indicators; requires ${thresholds.join(' and ')}. ${unavailableComponents.join('; ')}`;
}

export function calculateFinancialHealthAssessment({
  expenses = [],
  savings = [],
  budgets = [],
  dataCompleteness = {},
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
    budgets: dataCompleteness.budgets === true
  };

  const monthIncomeRows = filteredTransactions(expenses, 'income', normalizedCurrency, assessmentMonth, dateLimit);
  const monthExpenseRows = filteredTransactions(expenses, 'expense', normalizedCurrency, assessmentMonth, dateLimit);
  const monthlyIncome = sumAmounts(monthIncomeRows);
  const monthlyExpenses = sumAmounts(monthExpenseRows);
  const monthSavingsRows = filteredSavings(savings, normalizedCurrency, assessmentMonth, dateLimit);
  const monthBudgets = validBudgets(budgets, normalizedCurrency, assessmentMonth);
  const currencyMismatchedIncome = hasMismatchedCurrencyTransactions(
    expenses, 'income', normalizedCurrency, assessmentMonth, dateLimit
  );
  const currencyMismatchedExpense = hasMismatchedCurrencyTransactions(
    expenses, 'expense', normalizedCurrency, assessmentMonth, dateLimit
  );

  const components = {};

  if (!completeness.expenses ||
      !monthIncomeRows.length ||
      monthlyIncome <= 0 ||
      hasUnknownCurrencyTransactions(expenses, 'income', assessmentMonth, dateLimit) ||
      hasUnknownCurrencyTransactions(expenses, 'expense', assessmentMonth, dateLimit) ||
      currencyMismatchedIncome ||
      currencyMismatchedExpense) {
    const reason = !completeness.expenses
      ? 'Income and expense query did not complete.'
      : hasUnknownCurrencyTransactions(expenses, 'income', assessmentMonth, dateLimit) ||
          hasUnknownCurrencyTransactions(expenses, 'expense', assessmentMonth, dateLimit)
        ? 'Current-month income or expense records have unknown currency.'
        : currencyMismatchedIncome || currencyMismatchedExpense
          ? 'Current-month income or expense records use a different currency from the profile.'
        : !monthIncomeRows.length
          ? 'No current-month income record matches the profile currency and assessment date.'
          : 'Current-month compatible income must be greater than zero.';
    components.spending_control = unavailable(reason);
  } else {
    const expenseRatio = monthlyExpenses / monthlyIncome * 100;
    components.spending_control = available(spendingControlPoints(expenseRatio), {
      monthlyIncome,
      monthlyExpenses,
      qualifyingIncomeRecords: monthIncomeRows.length,
      qualifyingExpenseRecords: monthExpenseRows.length,
      expenseRatio
    });
  }

  const unknownCurrencySavingsContribution = savings.some((row) => {
    const date = getDate(row, ['savings_date', 'savingsDate']);
    return isInMonth(date, assessmentMonth, dateLimit) &&
      !String(row?.currency || '').trim() &&
      String(row?.record_type || row?.recordType || '').trim().toLowerCase() === 'contribution';
  });
  const mismatchedCurrencySavingsContribution = savings.some((row) => {
    const date = getDate(row, ['savings_date', 'savingsDate']);
    const recordType = String(row?.record_type || row?.recordType || '').trim().toLowerCase();
    const rowCurrency = String(row?.currency || '').trim();
    return isInMonth(date, assessmentMonth, dateLimit) &&
      recordType === 'contribution' &&
      rowCurrency.length > 0 &&
      rowCurrency.toUpperCase() !== normalizedCurrency;
  });
  if (!completeness.expenses ||
      !completeness.savings ||
      !monthIncomeRows.length ||
      monthlyIncome <= 0 ||
      unknownCurrencySavingsContribution ||
      mismatchedCurrencySavingsContribution ||
      hasUnknownCurrencyTransactions(expenses, 'income', assessmentMonth, dateLimit) ||
      currencyMismatchedIncome) {
    const reason = !completeness.expenses
      ? 'Income query did not complete.'
      : !completeness.savings
        ? 'Savings query did not complete.'
        : hasUnknownCurrencyTransactions(expenses, 'income', assessmentMonth, dateLimit)
          ? 'Current-month income records have unknown currency.'
          : currencyMismatchedIncome
            ? 'Current-month income records use a different currency from the profile.'
          : unknownCurrencySavingsContribution
            ? 'Current-month savings contributions have unknown currency.'
            : mismatchedCurrencySavingsContribution
              ? 'Current-month savings contributions use a different currency from the profile.'
            : !monthIncomeRows.length
              ? 'No current-month income record matches the profile currency and assessment date.'
              : 'Current-month compatible income must be greater than zero.';
    components.saving_habits = unavailable(reason);
  } else {
    const contributions = monthSavingsRows
      .filter(({ row }) => String(row.record_type || row.recordType || '').trim().toLowerCase() === 'contribution')
      .reduce((total, row) => total + row.amount, 0);
    const savingsRate = contributions / monthlyIncome * 100;
    components.saving_habits = available(savingHabitsPoints(savingsRate), {
      monthlyIncome,
      genuineContributions: contributions,
      qualifyingContributionRecords: monthSavingsRows.filter(({ row }) =>
        String(row.record_type || row.recordType || '').trim().toLowerCase() === 'contribution'
      ).length,
      savingsRate
    });
  }

  if (!completeness.budgets || !monthBudgets.length) {
    components.budget_management = unavailable(
      !completeness.budgets
        ? 'Budget query did not complete.'
        : 'No valid current-month budget matches the profile currency.'
    );
  } else if (!completeness.expenses ||
      hasUnknownCurrencyTransactions(expenses, 'expense', assessmentMonth, dateLimit) ||
      currencyMismatchedExpense) {
    components.budget_management = unavailable(
      !completeness.expenses
        ? 'Expense query did not complete.'
        : hasUnknownCurrencyTransactions(expenses, 'expense', assessmentMonth, dateLimit)
          ? 'Current-month expense records have unknown currency.'
          : 'Current-month expense records use a different currency from the profile.'
    );
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
        qualifyingExpenseRecords: matchedExpenseRows.length,
        budgetRecords: matchingBudgets.size,
        budgetUsage,
        matchedCategories: [...new Set(matchedExpenseRows.map(({ row }) => row.category))]
      });
    }
  }

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
  const hasSufficientCoverage = coveragePercentage >= 60 && availableComponentCount >= 2;
  const score = hasSufficientCoverage
    ? Math.round(earnedPoints / availableWeight * 100)
    : null;

  return {
    score,
    label: score === null ? 'Insufficient Data' : getFinancialHealthScoreLabel(score),
    insufficient_data_reason: hasSufficientCoverage
      ? null
      : unavailableAssessmentReason(components, coveragePercentage, availableComponentCount),
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
