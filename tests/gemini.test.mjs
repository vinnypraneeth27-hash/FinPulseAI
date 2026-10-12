import assert from 'node:assert/strict';
import test from 'node:test';
import geminiHandler, { classifyBudgetBotIntent } from '../netlify/functions/gemini.js';

test('classifies savings, income, and food expense commands without ambiguity', () => {
  assert.deepEqual(classifyBudgetBotIntent('Add 6000 as savings', 'INR'), {
    intent: 'add_savings',
    amount: 6000,
    currency: 'INR',
    reply: 'I recognized this as a savings deposit. Nothing has been changed yet.'
  });
  assert.deepEqual(classifyBudgetBotIntent('Save 6000', 'INR'), {
    intent: 'add_savings',
    amount: 6000,
    currency: 'INR',
    reply: 'I recognized this as a savings deposit. Nothing has been changed yet.'
  });

  const income = classifyBudgetBotIntent('I earned 6000', 'INR');
  assert.equal(income.intent, 'add_transaction');
  assert.equal(income.transaction.type, 'income');
  assert.equal(income.transaction.amount, 6000);

  const freelanceIncome = classifyBudgetBotIntent('I earned 5000 from freelancing', 'INR');
  assert.equal(freelanceIncome.intent, 'add_transaction');
  assert.equal(freelanceIncome.transaction.type, 'income');
  assert.equal(freelanceIncome.transaction.amount, 5000);

  const requestedExpense = classifyBudgetBotIntent('I spent 500 on food', 'INR');
  assert.equal(requestedExpense.intent, 'add_transaction');
  assert.equal(requestedExpense.transaction.type, 'expense');
  assert.equal(requestedExpense.transaction.amount, 500);
  assert.equal(requestedExpense.transaction.category, 'Food & Dining');

  const expense = classifyBudgetBotIntent('I spent 6000 on food', 'INR');
  assert.equal(expense.intent, 'add_transaction');
  assert.equal(expense.transaction.type, 'expense');
  assert.equal(expense.transaction.amount, 6000);
  assert.equal(expense.transaction.category, 'Food & Dining');
  assert.equal(expense.transaction.title, 'Food Expense');

  const cardExpense = classifyBudgetBotIntent('I spent 6000 on food with my credit card', 'INR');
  assert.equal(cardExpense.intent, 'add_transaction');
  assert.equal(cardExpense.transaction.type, 'expense');

  const cadExpense = classifyBudgetBotIntent('I spent CA$500 on food', 'INR');
  assert.equal(cadExpense.intent, 'add_transaction');
  assert.equal(cadExpense.transaction.currency, 'CAD');
});

test('rejects negative and zero savings amounts without classifying them as deposits', () => {
  for (const message of ['Add -500 as savings', 'Add 0 as savings']) {
    const result = classifyBudgetBotIntent(message, 'INR');
    assert.equal(result.intent, 'clarify');
    assert.match(result.reply, /amount greater than zero/i);
    assert.equal(Object.hasOwn(result, 'amount'), false);
    assert.equal(Object.hasOwn(result, 'transaction'), false);
  }
  assert.equal(classifyBudgetBotIntent('Add 6000 as savings', 'INR').intent, 'add_savings');
});

test('clarifies ambiguous additions and account transfers rather than recording them', () => {
  const ambiguous = classifyBudgetBotIntent('Add 6000', 'INR');
  assert.equal(ambiguous.intent, 'clarify');

  const transfer = classifyBudgetBotIntent('Transfer 6000 to my checking account', 'INR');
  assert.equal(transfer.intent, 'clarify');

  const missingDetails = classifyBudgetBotIntent('Add money', 'INR');
  assert.equal(missingDetails.intent, 'clarify');
  assert.doesNotMatch(missingDetails.reply, /saved|added/i);

  const savingsTransfer = classifyBudgetBotIntent('Transfer 6000 to my emergency savings goal', 'INR');
  assert.equal(savingsTransfer.intent, 'add_savings');
});

test('keeps savings recognized as unsupported and never normalizes it into an expense', async () => {
  const response = await geminiHandler(new Request('https://example.test/.netlify/functions/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Add 6000 as savings', currency: 'INR' })
  }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.intent, 'add_savings');
  assert.equal(result.amount, 6000);
  assert.equal(Object.hasOwn(result, 'transaction'), false);
  assert.doesNotMatch(result.reply, /saved|added/i);
});

test('returns a clear service error when Gemini is unconfigured or returns invalid structured data', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const request = () => new Request('https://example.test/.netlify/functions/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Give me a monthly budgeting tip' })
  });

  try {
    const unconfigured = await geminiHandler(request());
    assert.equal(unconfigured.status, 503);
    assert.match((await unconfigured.json()).error, /GEMINI_API_KEY/);

    process.env.GEMINI_API_KEY = 'test-key';
    globalThis.fetch = async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'not json' }] } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const invalid = await geminiHandler(request());
    assert.equal(invalid.status, 502);
    assert.match((await invalid.json()).error, /invalid structured response/i);

    globalThis.fetch = async () => new Response(JSON.stringify({
      error: { message: 'Rate limit reached' }
    }), { status: 429, headers: { 'Content-Type': 'application/json' } });
    const rateLimited = await geminiHandler(request());
    assert.equal(rateLimited.status, 429);
    assert.equal((await rateLimited.json()).error, 'Rate limit reached');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
  }
});

test('answers spending-this-month questions from actual month transactions without a write', async () => {
  const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const response = await geminiHandler(new Request('https://example.test/.netlify/functions/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Show my spending this month',
      currency: 'INR',
      financialContext: {
        currentMonth: {
          period,
          transactions: [
            { amount: 1200, category: 'Food & Dining', type: 'expense' },
            { amount: 6000, category: 'Income', type: 'income' }
          ]
        }
      }
    })
  }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.match(result.reply, /1,200/);
  assert.match(result.reply, /Food & Dining/);
  assert.equal(result.intent, 'question');
  assert.equal(Object.hasOwn(result, 'transaction'), false);
});

test('routes the exact monthly savings-plan request to Gemini with actual financial data', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const message = 'Suggest me a budget saving pattern for this month';
  const plan = {
    intent: 'question',
    spendingReview: 'Recorded income is ₹25,000 and expenses are ₹6,000, leaving a recorded surplus of ₹19,000.',
    overspendingControl: 'No supplied category budget limit is exceeded by the recorded category spending.',
    weeklyLimit: 'Upcoming bills were not supplied, so a safe remaining-month weekly limit cannot be confirmed.',
    essentials: 'Prioritize housing, food, and other essential bills before discretionary purchases.',
    savingsTarget: 'The recorded surplus is positive; choose a target only after accounting for upcoming essential bills.',
    tracking: 'Review the Transactions and Budgeting views weekly to track actual spending.'
  };
  process.env.GEMINI_API_KEY = 'test-key';
  let geminiRequest;
  globalThis.fetch = async (url, options) => {
    geminiRequest = { url, options };
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify(plan) }]
        }
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    assert.equal(classifyBudgetBotIntent(message, 'INR'), null);
    const response = await geminiHandler(new Request('https://example.test/.netlify/functions/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        currency: 'INR',
        financialContext: {
          summary: { totalIncome: 25000, totalExpenses: 6000, balance: 19000 },
          currentMonth: {
            period,
            totalIncome: 25000,
            totalExpenses: 6000,
            balance: 19000,
            transactions: [
              { amount: 25000, category: 'Income', type: 'income' },
              { amount: 6000, category: 'Housing & Utilities', type: 'expense' }
            ]
          },
          budgetLimits: { 'Housing & Utilities': 10000, 'Food & Dining': 5000 },
          savings: {
            dataAvailable: true,
            summary: { total: 3000, monthlyTotal: 1000, count: 2 },
            deposits: [{ amount: 1000, currency: 'INR', date: `${period}-10` }]
          }
        }
      })
    }));
    const result = await response.json();
    const requestBody = JSON.parse(geminiRequest.options.body);
    const questionContext = requestBody.contents[0].parts[0].text;

    assert.equal(response.status, 200);
    assert.equal(result.intent, 'question');
    assert.match(result.reply, /\*\*Your Budget-Saving Plan for /);
    assert.match(result.reply, /1\. \*\*Review your finances\*\*\n   -/);
    assert.match(result.reply, /2\. \*\*Control overspending\*\*\n   -/);
    assert.match(result.reply, /3\. \*\*Set a weekly spending limit\*\*\n   -/);
    assert.match(result.reply, /4\. \*\*Prioritize essentials\*\*\n   -/);
    assert.match(result.reply, /5\. \*\*Set a realistic savings target\*\*\n   -/);
    assert.match(result.reply, /6\. \*\*Track progress\*\*\n   -/);
    assert.match(result.reply, /₹19,000/);
    assert.doesNotMatch(result.reply, /provide one clear amount/i);
    assert.match(questionContext, /"balance": 19000/);
    assert.match(questionContext, /"totalIncome": 25000/);
    assert.match(questionContext, /"totalExpenses": 6000/);
    assert.match(questionContext, /"Food & Dining": 5000/);
    assert.match(questionContext, /"monthlyTotal": 1000/);
    const adviceSchema = requestBody.generationConfig.responseSchema;
    assert.deepEqual(adviceSchema.required, [
      'intent', 'spendingReview', 'overspendingControl', 'weeklyLimit',
      'essentials', 'savingsTarget', 'tracking'
    ]);
    assert.equal(Object.hasOwn(result, 'transaction'), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
  }
});

test('formats each requested savings and overspending advice prompt as a numbered plan', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  const plan = {
    intent: 'question',
    spendingReview: 'Recorded income and expenses are supplied.',
    overspendingControl: 'Compare actual categories to supplied limits.',
    weeklyLimit: 'Upcoming bills are unknown.',
    essentials: 'Prioritize known essential bills.',
    savingsTarget: 'Only set a target supported by the records.',
    tracking: 'Review FinPulse weekly.'
  };
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }]
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    for (const message of [
      'Suggest me best savings for this month',
      'How can I save ₹3000 this month?',
      'Which category am I overspending on?'
    ]) {
      const response = await geminiHandler(new Request('https://example.test/.netlify/functions/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          currency: 'INR',
          financialContext: {
            currentMonth: {
              period: '2026-10',
              totalIncome: 25000,
              totalExpenses: 6000,
              balance: 19000,
              byCategory: { 'Food & Dining': 6000 },
              transactions: []
            },
            budgetLimits: { 'Food & Dining': 5000 }
          }
        })
      }));
      const result = await response.json();
      assert.equal(response.status, 200, message);
      assert.match(result.reply, /^.*\n\n1\. \*\*Review your finances\*\*\n   -/s);
      assert.match(result.reply, /\n2\. \*\*Control overspending\*\*\n   -/);
      assert.match(result.reply, /\n6\. \*\*Track progress\*\*\n   -/);
      assert.equal(result.intent, 'question');
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
  }
});

test('uses a formatted data-grounded plan when Gemini advice JSON is invalid', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: 'not valid JSON' }] } }]
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    const response = await geminiHandler(new Request('https://example.test/.netlify/functions/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Suggest me best savings for this month',
        currency: 'INR',
        financialContext: {
          currentMonth: {
            period: '2026-10',
            totalIncome: 25000,
            totalExpenses: 6000,
            balance: 19000,
            byCategory: { 'Food & Dining': 6000 },
            transactions: []
          },
          budgetLimits: { 'Food & Dining': 5000 }
        }
      })
    }));
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.match(result.reply, /\*\*Your Budget-Saving Plan for October 2026\*\*/);
    assert.match(result.reply, /Recorded monthly income: ₹25,000/);
    assert.match(result.reply, /Food & Dining is ₹1,000/);
    assert.match(result.reply, /\n6\. \*\*Track progress\*\*\n   -/);
    assert.doesNotMatch(result.reply, /not valid JSON/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
  }
});

test('uses structured Gemini output for broader month questions with supplied data', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  process.env.GEMINI_API_KEY = 'test-key';
  let geminiRequest;
  globalThis.fetch = async (url, options) => {
    geminiRequest = { url, options };
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify({ intent: 'question', reply: 'You spent ₹1,200 this month.' }) }]
        }
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const response = await geminiHandler(new Request('https://example.test/.netlify/functions/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What spending trends do you see this month?',
        currency: 'INR',
        financialContext: {
          currentMonth: {
            period,
            totalExpenses: 1200,
            transactions: [{ amount: 1200, category: 'Food & Dining', type: 'expense' }]
          }
        }
      })
    }));
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(result, { intent: 'question', reply: 'You spent ₹1,200 this month.' });
    assert.equal(JSON.parse(geminiRequest.options.body).generationConfig.responseMimeType, 'application/json');
    assert.match(JSON.parse(geminiRequest.options.body).contents[0].parts[0].text, new RegExp(period));
    assert.match(JSON.parse(geminiRequest.options.body).contents[0].parts[0].text, /1200/);
    assert.equal(JSON.stringify(result).includes('add_transaction'), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
  }
});

test('preserves every dashboard currency when sending financial context to Gemini', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              intent: 'question',
              spendingReview: 'No financial data is currently available.',
              overspendingControl: 'No category budgets were supplied.',
              weeklyLimit: 'Upcoming bills are unknown, so no amount is estimated.',
              essentials: 'Pay essential bills first.',
              savingsTarget: 'No savings target is recommended without income and expense data.',
              tracking: 'Track transactions in FinPulse each week.'
            })
          }]
        }
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const response = await geminiHandler(new Request('https://example.test/.netlify/functions/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Suggest a monthly budget',
        currency: 'CAD',
        financialContext: { currentMonth: { period: '2026-10', transactions: [] } }
      })
    }));
    assert.equal(response.status, 200);
    assert.match(requestBody.contents[0].parts[0].text, /USER CURRENCY:\nCAD/);
    const result = await response.json();
    assert.match(result.reply, /1\. \*\*Review your finances\*\*\n   -/);
    assert.match(result.reply, /6\. \*\*Track progress\*\*\n   -/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
  }
});
