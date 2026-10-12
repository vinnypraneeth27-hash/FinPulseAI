const JSON_HEADERS = { 'Content-Type': 'application/json' };
const SUPPORTED_CURRENCIES = new Set([
    'INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'AED', 'BRL', 'SGD'
]);

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: JSON_HEADERS
    });
}

function extractCurrencyValue(text, fallbackCurrency = 'INR') {
    const lower = String(text || '').toLowerCase();
    if (lower.includes('₹') || /\b(?:inr|rupees?|rs\.?)\b/i.test(lower)) return 'INR';
    if (/\b(?:cad|ca\$)\b/i.test(lower)) return 'CAD';
    if (/\b(?:aud|a\$)\b/i.test(lower)) return 'AUD';
    if (/\bchf\b/i.test(lower)) return 'CHF';
    if (/\bcny\b/i.test(lower)) return 'CNY';
    if (/\baed\b/i.test(lower)) return 'AED';
    if (/\bbrl\b/i.test(lower)) return 'BRL';
    if (/\bsgd\b/i.test(lower)) return 'SGD';
    if (lower.includes('$') || /\b(?:usd|dollars?)\b/i.test(lower)) return 'USD';
    if (lower.includes('€') || /\b(?:eur|euros?)\b/i.test(lower)) return 'EUR';
    if (lower.includes('£') || /\b(?:gbp|pounds?)\b/i.test(lower)) return 'GBP';
    if (lower.includes('¥') || /\b(?:jpy|yen)\b/i.test(lower)) return 'JPY';
    const fallback = String(fallbackCurrency || 'INR').trim().toUpperCase();
    return SUPPORTED_CURRENCIES.has(fallback) ? fallback : 'INR';
}

function extractAmounts(text) {
    const matches = [...String(text || '').matchAll(
        /(?:₹|\$|€|£|¥)?\s*(\d[\d,]*(?:\.\d+)?)\s*(thousand|grand|lakh|lac|million|k|m)?\b/gi
    )];
    const amounts = matches.map((match) => {
        const base = Number(match[1].replace(/,/g, ''));
        const unit = String(match[2] || '').toLowerCase();
        const multiplier = {
            thousand: 1000,
            grand: 1000,
            k: 1000,
            lakh: 100000,
            lac: 100000,
            million: 1000000,
            m: 1000000
        }[unit] || 1;
        return base * multiplier;
    });
    return [...new Set(amounts)];
}

function inferCategoryFromText(text, type) {
    if (type === 'income') return 'Income';

    const categories = [
        ['Food & Dining', /\b(food|dining|grocer(?:y|ies)?|restaurant|dinner|lunch|coffee|biryani|curry|snack|meal)\b/i],
        ['Housing & Utilities', /\b(rent|housing|utility|utilities|electric(?:ity)?|wifi|water)\b/i],
        ['Transportation', /\b(travel|transport|uber|taxi|fuel|gas|bus|flight|car)\b/i],
        ['Entertainment', /\b(movie|concert|ticket|entertainment|game)\b/i],
        ['Subscriptions', /\b(subscription|netflix|spotify|app)\b/i],
        ['Health & Fitness', /\b(health|fitness|gym|doctor|medical|pharmacy|medicine)\b/i],
        ['Education', /\b(school|college|tuition|study|education|course|book|fee|fees)\b/i],
        ['Shopping & Tech', /\b(shop|shopping|electronics|apple|gadget|clothes)\b/i]
    ];

    return categories.find(([, pattern]) => pattern.test(text))?.[0] || 'Miscellaneous';
}

function clarification(reply) {
    return { intent: 'clarify', reply };
}

export function classifyBudgetBotIntent(message, defaultCurrency = 'INR') {
    const text = String(message || '').trim();
    if (!text) return clarification('Please tell me what you would like to do.');

    if (
        /\?/.test(text) ||
        /^\s*(show|display|list|summari[sz]e|tell me|what|how|where|when|why|compare|analy[sz]e|predict)\b/i.test(text)
    ) {
        return null;
    }

    const adviceSignal = /\b(suggest|recommend|advice|plan|pattern|strategy|strategies)\b/i.test(text) &&
        /\b(budget|sav(?:e|ing|ings)|spend|expense|income|money|month)\b/i.test(text);
    if (adviceSignal) return null;

    const creditSignal = /\bcredited\b|\bcredit\s+(?:₹|\$|€|£|¥)?\s*\d/i.test(text);
    const incomeSignal = /\b(earn(?:ed|ing)?|salary|paycheck|income|received|credited|bonus|commission|freelance)\b/i.test(text) ||
        creditSignal;
    const expenseSignal = /\b(spent|spend|expense|expenses|paid|pay|bought|buy|purchase|debit(?:ed)?|bill)\b/i.test(text);
    const transferSignal = /\b(transfer(?:red)?|move money|send money|withdraw(?:n|al)?|deposit(?:ed)?)\b/i.test(text);
    const transferToSavingsGoal = transferSignal &&
        /\b(?:to|into|toward|towards)\b.{0,60}\b(goal|savings?)\b/i.test(text);
    const savingsSignal = /\b(save|saved|saving|savings|set aside|put aside)\b/i.test(text) ||
        transferToSavingsGoal;
    const addSignal = /\b(add|record|log|enter)\b/i.test(text);
    const category = inferCategoryFromText(text, 'expense');

    if (savingsSignal && (incomeSignal || expenseSignal)) {
        return clarification('Should I record this as savings, income, or an expense? I have not changed anything.');
    }

    if (transferSignal && !savingsSignal) {
        return clarification('I can’t record account transfers as income or expenses. Is this a deposit to one of your savings goals?');
    }

    let type = null;
    if (savingsSignal) {
        type = 'savings';
    } else if (incomeSignal && expenseSignal) {
        return clarification('Should I record this as income or an expense? I have not changed anything.');
    } else if (incomeSignal) {
        type = 'income';
    } else if (expenseSignal) {
        type = 'expense';
    } else if (addSignal && category !== 'Miscellaneous') {
        type = 'expense';
    } else if (addSignal) {
        return clarification('Would you like to record this as savings, income, or an expense? Please include an expense category if it is an expense.');
    } else if (transferSignal) {
        return clarification('I can’t record account transfers as income or expenses. Is this a deposit to one of your savings goals?');
    } else {
        return null;
    }

    const amounts = extractAmounts(text);
    if (amounts.length !== 1 || !Number.isFinite(amounts[0]) || amounts[0] <= 0) {
        return clarification('Please provide one clear amount greater than zero. I have not changed anything.');
    }

    const amount = amounts[0];
    const currency = extractCurrencyValue(text, defaultCurrency);
    if (type === 'savings') {
        return {
            intent: 'add_savings',
            amount,
            currency,
            reply: 'I recognized this as a savings deposit. Nothing has been changed yet.'
        };
    }

    const transactionCategory = inferCategoryFromText(text, type);
    const title = type === 'income'
        ? (/\b(salary|paycheck)\b/i.test(text) ? 'Salary Income' : 'Income')
        : transactionCategory === 'Food & Dining'
            ? 'Food Expense'
            : `${transactionCategory} Expense`;

    return {
        intent: 'add_transaction',
        transaction: {
            type,
            amount,
            currency,
            category: transactionCategory,
            title,
            date: new Date().toISOString().slice(0, 10)
        },
        reply: `I understood this as ${type} of ${amount} ${currency} for ${transactionCategory}. Nothing has been saved yet.`
    };
}

function buildCurrentMonthSpendingReply(message, currentMonth, currency) {
    const summaryQuestion = /^\s*(show|display|list|how much|what (?:is|was|did)|tell me)\b/i.test(message);
    const asksAboutThisMonth = /\b(this month|month to date)\b/i.test(message);
    const asksAboutSpending = /\b(spending|spent|expenses?|expense)\b/i.test(message);
    const asksForAnalysis = /\b(compare|versus|vs\.?|trend|average|category|categories|breakdown|why|predict|forecast)\b/i.test(message);
    if (!summaryQuestion || !asksAboutThisMonth || !asksAboutSpending || asksForAnalysis) return null;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(currentMonth.period || '') || !Array.isArray(currentMonth.transactions)) return null;

    const expenses = currentMonth.transactions.filter((tx) => (
        tx.type === 'expense' && Number.isFinite(Number(tx.amount)) && Number(tx.amount) > 0
    ));
    const monthDate = new Date(`${currentMonth.period}-01T00:00:00Z`);
    const monthLabel = new Intl.DateTimeFormat('en', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(monthDate);
    const formatter = new Intl.NumberFormat('en', {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'JPY' ? 0 : 2
    });

    if (!expenses.length) {
        return `You have no recorded expenses for ${monthLabel}.`;
    }

    const categoryTotals = {};
    const total = expenses.reduce((sum, tx) => {
        const amount = Number(tx.amount);
        const category = tx.category || 'Miscellaneous';
        categoryTotals[category] = (categoryTotals[category] || 0) + amount;
        return sum + amount;
    }, 0);
    const breakdown = Object.entries(categoryTotals)
        .sort((left, right) => right[1] - left[1])
        .map(([category, amount]) => `${category}: ${formatter.format(amount)}`)
        .join('; ');

    return `Your recorded spending for ${monthLabel} totals ${formatter.format(total)} across ${expenses.length} expense${expenses.length === 1 ? '' : 's'}. ${breakdown}`;
}

function isBudgetAdviceRequest(message) {
    return /\b(suggest|recommend|advice|plan|pattern|strategy|strategies)\b/i.test(message) &&
        /\b(budget|sav(?:e|ing|ings)|spend|expense|income|money|month)\b/i.test(message);
}

function formatBudgetAdvice(result, currentMonth) {
    const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(currentMonth.period || '')
        ? currentMonth.period
        : '';
    const monthName = period
        ? new Intl.DateTimeFormat('en', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC'
        }).format(new Date(`${period}-01T00:00:00Z`))
        : 'this month';
    const sections = [
        ['Review your spending', result.spendingReview],
        ['Control overspending', result.overspendingControl],
        ['Set a weekly limit', result.weeklyLimit],
        ['Prioritize essentials', result.essentials],
        ['Set a savings target', result.savingsTarget],
        ['Track your progress', result.tracking]
    ];
    if (sections.some(([, content]) => typeof content !== 'string' || !content.trim())) return null;

    return `**Your Budget-Saving Plan for ${monthName}**\n\n${sections.map(([title, content], index) => (
        `${index + 1}. **${title}:** ${content.trim()}`
    )).join('\n\n')}`;
}

export default async (req) => {
    try {
        if (req.method !== 'POST') {
            return jsonResponse({ error: 'Method not allowed' }, 405);
        }

        const body = await req.json();
        const message = typeof body?.message === 'string' ? body.message.trim() : '';
        const currency = extractCurrencyValue('', body?.currency);
        const financialContext = body?.financialContext || {};

        if (!message) {
            return jsonResponse({ error: 'Message is required' }, 400);
        }

        const classified = classifyBudgetBotIntent(message, currency);
        if (classified) return jsonResponse(classified);

        const summary = financialContext.summary || {};
        const currentMonth = financialContext.currentMonth || {};
        const budgetLimits = financialContext.budgetLimits || {};
        const savings = financialContext.savings || {};
        const budgetAdviceRequest = isBudgetAdviceRequest(message);
        const spendingReply = buildCurrentMonthSpendingReply(message, currentMonth, currency);
        if (spendingReply) return jsonResponse({ intent: 'question', reply: spendingReply });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey?.trim()) {
            return jsonResponse({
                error: 'Gemini is not configured on the server. Set GEMINI_API_KEY in the Netlify environment variables.'
            }, 503);
        }

        const recentTransactions = Array.isArray(financialContext.recentTransactions)
            ? financialContext.recentTransactions.slice(0, 10).map((tx) => ({
                date: tx.date || 'unknown',
                description: tx.description || tx.title || 'Transaction',
                amount: Number(tx.amount) || 0,
                category: tx.category || 'Miscellaneous',
                transaction_type: tx.type || tx.transaction_type || 'unknown'
            }))
            : [];
        const categorySummary = financialContext.categories || {};
        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{
                            text: `You are BudgetBot, the personal finance assistant inside FinPulse AI.

Answer the user's question using only the financial data supplied below. For questions about this month, use CURRENT MONTH DATA and its exact date range; do not substitute all-time totals or guess from recent transactions. For monthly budget or savings-plan requests, give a practical plan using the available balance, recorded current-month income and expenses, the user's existing category budget limits, and the separate savings-deposit summary when supplied. Never count savings deposits as expenses or include them in the existing balance calculation. Distinguish observed month-to-date figures from recommendations, treat budget limits as monthly targets, and do not imply month-to-date spending represents a full month. Suggested allocations are advice, not actual financial data. If key data is missing, clearly label a useful provisional plan and its assumptions rather than asking for a transaction amount. Ask follow-up questions only if essential. Never create, suggest that you created, or claim to have saved a transaction. Never invent financial numbers, expose database IDs or credentials, or claim access to unsupplied data. Use the saved currency and clearly say when the data does not contain the requested information. Keep the answer concise.${budgetAdviceRequest ? ' For this budget advice, provide exactly six short section contents: (1) spending review using supplied income, expenses, and balance; (2) actual overspending only where a supplied budget limit is exceeded; (3) a remaining-month weekly limit only when computable from supplied values, otherwise say upcoming bills are unknown; (4) prioritize essentials without claiming unsupplied expenses; (5) recommend a savings target only if verified income and expenses support it, otherwise advise against setting one; (6) track progress in FinPulse. Do not introduce unsupported amounts.' : ''}`
                        }]
                    },
                    contents: [{
                        role: 'user',
                        parts: [{
                            text: `USER QUESTION:\n${message}\n\nUSER CURRENCY:\n${currency}\n\nCURRENT MONTH DATA:\n${JSON.stringify(currentMonth, null, 2)}\n\nALL-TIME FINANCIAL SUMMARY:\n${JSON.stringify(summary, null, 2)}\n\nCURRENT MONTH CATEGORY BUDGET LIMITS:\n${JSON.stringify(budgetLimits, null, 2)}\n\nSAVINGS DEPOSITS (SEPARATE FROM EXPENSES AND BALANCE):\n${JSON.stringify(savings, null, 2)}\n\nRECENT TRANSACTIONS:\n${JSON.stringify(recentTransactions, null, 2)}\n\nCATEGORY SUMMARY:\n${JSON.stringify(categorySummary, null, 2)}`
                        }]
                    }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        responseSchema: budgetAdviceRequest ? {
                            type: 'OBJECT',
                            properties: {
                                intent: { type: 'STRING', enum: ['question'] },
                                spendingReview: { type: 'STRING' },
                                overspendingControl: { type: 'STRING' },
                                weeklyLimit: { type: 'STRING' },
                                essentials: { type: 'STRING' },
                                savingsTarget: { type: 'STRING' },
                                tracking: { type: 'STRING' }
                            },
                            required: [
                                'intent',
                                'spendingReview',
                                'overspendingControl',
                                'weeklyLimit',
                                'essentials',
                                'savingsTarget',
                                'tracking'
                            ],
                            propertyOrdering: [
                                'intent',
                                'spendingReview',
                                'overspendingControl',
                                'weeklyLimit',
                                'essentials',
                                'savingsTarget',
                                'tracking'
                            ]
                        } : {
                            type: 'OBJECT',
                            properties: {
                                intent: { type: 'STRING', enum: ['question'] },
                                reply: { type: 'STRING' }
                            },
                            required: ['intent', 'reply'],
                            propertyOrdering: ['intent', 'reply']
                        }
                    }
                })
            }
        );

        const data = await response.json();
        if (!response.ok) {
            return jsonResponse({ error: data.error?.message || 'Gemini API error' }, response.status);
        }

        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        let result;
        try {
            result = JSON.parse(candidateText || '');
        } catch {
            return jsonResponse({ error: 'Gemini returned an invalid structured response.' }, 502);
        }

        if (budgetAdviceRequest) {
            const reply = result?.intent === 'question'
                ? formatBudgetAdvice(result, currentMonth)
                : null;
            if (!reply) {
                return jsonResponse({ error: 'Gemini returned an incomplete structured budget plan.' }, 502);
            }
            return jsonResponse({ intent: 'question', reply });
        }

        if (result?.intent !== 'question' || typeof result.reply !== 'string' || !result.reply.trim()) {
            return jsonResponse({ error: 'Gemini returned an incomplete structured response.' }, 502);
        }

        return jsonResponse({ intent: 'question', reply: result.reply.trim() });
    } catch (error) {
        console.error('Gemini function error:', error instanceof Error ? error.message : 'Unknown error');
        return jsonResponse({
            error: 'BudgetBot is temporarily unavailable. Please try again.'
        }, 500);
    }
};
