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

  const expense = classifyBudgetBotIntent('I spent 6000 on food', 'INR');
  assert.equal(expense.intent, 'add_transaction');
  assert.equal(expense.transaction.type, 'expense');
  assert.equal(expense.transaction.amount, 6000);
  assert.equal(expense.transaction.category, 'Food & Dining');
  assert.equal(expense.transaction.title, 'Food Expense');

  const cardExpense = classifyBudgetBotIntent('I spent 6000 on food with my credit card', 'INR');
  assert.equal(cardExpense.intent, 'add_transaction');
  assert.equal(cardExpense.transaction.type, 'expense');
});

test('clarifies ambiguous additions and account transfers rather than recording them', () => {
  const ambiguous = classifyBudgetBotIntent('Add 6000', 'INR');
  assert.equal(ambiguous.intent, 'clarify');

  const transfer = classifyBudgetBotIntent('Transfer 6000 to my checking account', 'INR');
  assert.equal(transfer.intent, 'clarify');

  const savingsTransfer = classifyBudgetBotIntent('Transfer 6000 to my emergency savings goal', 'INR');
  assert.equal(savingsTransfer.intent, 'add_savings');
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
  const plan = 'Recorded income is ₹25,000 and expenses are ₹6,000, leaving ₹19,000 available. Keep rent within ₹10,000 and food within ₹5,000; set a provisional ₹4,000 savings target and review spending weekly.';
  process.env.GEMINI_API_KEY = 'test-key';
  let geminiRequest;
  globalThis.fetch = async (url, options) => {
    geminiRequest = { url, options };
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify({ intent: 'question', reply: plan }) }]
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
          budgetLimits: { 'Housing & Utilities': 10000, 'Food & Dining': 5000 }
        }
      })
    }));
    const result = await response.json();
    const requestBody = JSON.parse(geminiRequest.options.body);
    const questionContext = requestBody.contents[0].parts[0].text;

    assert.equal(response.status, 200);
    assert.equal(result.intent, 'question');
    assert.match(result.reply, /₹19,000/);
    assert.match(result.reply, /savings target/);
    assert.doesNotMatch(result.reply, /provide one clear amount/i);
    assert.match(questionContext, /"balance": 19000/);
    assert.match(questionContext, /"totalIncome": 25000/);
    assert.match(questionContext, /"totalExpenses": 6000/);
    assert.match(questionContext, /"Food & Dining": 5000/);
    assert.equal(Object.hasOwn(result, 'transaction'), false);
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
