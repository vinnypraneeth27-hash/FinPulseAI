export default async (req) => {
    try {
        if (req.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const body = await req.json();
        const message = typeof body?.message === 'string' ? body.message.trim() : '';
        const currency = body?.currency || 'INR';
        const financialContext = body?.financialContext || null;

        if (!message) {
            return new Response(JSON.stringify({ error: 'Message is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const summary = financialContext?.summary || {};
        const recentTransactions = financialContext?.recentTransactions || financialContext?.transactions || [];
        const categorySummary = financialContext?.categories || {};

        function normalizeCurrencyValue(value, fallback = 'INR') {
            const raw = String(value || fallback || 'INR').trim().toUpperCase();
            if (!raw) return 'INR';
            const map = {
                INR: 'INR',
                RS: 'INR',
                RUPEE: 'INR',
                USD: 'USD',
                DOLLAR: 'USD',
                EUR: 'EUR',
                GBP: 'GBP',
                JPY: 'JPY',
                CAD: 'CAD',
                AUD: 'AUD',
                CHF: 'CHF',
                CNY: 'CNY',
                AED: 'AED',
                BRL: 'BRL',
                SGD: 'SGD'
            };
            return map[raw] || raw;
        }

        function extractCurrencyValue(text, fallbackCurrency = 'INR') {
            const lower = String(text || '').toLowerCase();
            if (lower.includes('inr') || lower.includes('rupee') || lower.includes('rs')) return 'INR';
            if (lower.includes('usd') || lower.includes('dollar') || lower.includes('$')) return 'USD';
            if (lower.includes('eur') || lower.includes('euro') || lower.includes('€')) return 'EUR';
            if (lower.includes('gbp') || lower.includes('pound') || lower.includes('£')) return 'GBP';
            if (lower.includes('jpy') || lower.includes('yen') || lower.includes('¥')) return 'JPY';
            if (lower.includes('cad')) return 'CAD';
            if (lower.includes('aud')) return 'AUD';
            if (lower.includes('chf')) return 'CHF';
            if (lower.includes('cny')) return 'CNY';
            if (lower.includes('aed')) return 'AED';
            if (lower.includes('brl')) return 'BRL';
            if (lower.includes('sgd')) return 'SGD';
            return normalizeCurrencyValue(fallbackCurrency || 'INR', 'INR');
        }

        function extractAmountValue(text) {
            const normalized = String(text || '')
                .replace(/[₹$€£¥]/g, ' ')
                .replace(/,/g, '')
                .replace(/\b(?:thousand|k)\b/gi, '000')
                .replace(/\b(?:lakh|lac)\b/gi, '00000')
                .replace(/\b(?:million|m)\b/gi, '000000');

            const matches = [...normalized.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
            if (!matches.length) return null;
            if (matches.length > 1) {
                const unique = [...new Set(matches.map(Number))];
                return unique.length === 1 ? unique[0] : null;
            }
            return matches[0] > 0 ? matches[0] : null;
        }

        function inferCategoryFromText(text, type) {
            const lower = String(text || '').toLowerCase();
            if (type === 'income') {
                if (lower.includes('salary') || lower.includes('paycheck') || lower.includes('paycheck')) return 'Salary';
                if (lower.includes('bonus') || lower.includes('freelance') || lower.includes('commission')) return 'Income';
                return 'Income';
            }
            if (lower.includes('food') || lower.includes('grocer') || lower.includes('grocery') || lower.includes('restaurant') || lower.includes('dinner') || lower.includes('lunch') || lower.includes('coffee') || lower.includes('biryani') || lower.includes('curry') || lower.includes('snack')) return 'Food';
            if (lower.includes('rent') || lower.includes('housing') || lower.includes('utility') || lower.includes('electric') || lower.includes('wifi')) return 'Housing';
            if (lower.includes('travel') || lower.includes('uber') || lower.includes('taxi') || lower.includes('fuel') || lower.includes('bus') || lower.includes('flight') || lower.includes('transport')) return 'Transportation';
            if (lower.includes('movie') || lower.includes('concert') || lower.includes('ticket') || lower.includes('entertainment')) return 'Entertainment';
            if (lower.includes('subscription') || lower.includes('netflix') || lower.includes('spotify') || lower.includes('app')) return 'Subscriptions';
            if (lower.includes('health') || lower.includes('fitness') || lower.includes('gym') || lower.includes('doctor') || lower.includes('medical')) return 'Health';
            if (lower.includes('school') || lower.includes('college') || lower.includes('tuition') || lower.includes('study') || lower.includes('education')) return 'Education';
            if (lower.includes('shop') || lower.includes('electronics') || lower.includes('apple') || lower.includes('gadget')) return 'Shopping';
            return 'Miscellaneous';
        }

        function inferTransactionAction(messageText, defaultCurrency) {
            const text = String(messageText || '').trim();
            if (!text) return null;
            const lower = text.toLowerCase();
            const intentKeywords = /(add|record|log|save|spent|spend|buy|bought|paid|pay|salary|income|expense|credit|debit|deposit|earned|received)/i;
            if (!intentKeywords.test(lower)) return null;

            const amount = extractAmountValue(text);
            if (!amount || !Number.isFinite(amount) || amount <= 0) return null;

            const isIncomeText = /(salary|income|earned|received|bonus|commission|paycheck|freelance|credit|credited|deposit)/i.test(lower);
            const isExpenseText = /(expense|spent|spend|debit|debits|paid|pay|bill|bought|buy|food|grocer|grocery|restaurant|rent|travel|uber|taxi|fuel|movie|subscription|school|college|tuition|medicine|health|gym)/i.test(lower);

            const type = isIncomeText && !isExpenseText ? 'income' : 'expense';
            const currency = extractCurrencyValue(text, defaultCurrency);
            const category = inferCategoryFromText(text, type);
            const title = type === 'income' ? 'Salary Income' : category === 'Food' ? 'Food Expense' : `${category} Expense`;

            return {
                type,
                amount: Number(amount),
                currency,
                category,
                title,
                date: new Date().toISOString().slice(0, 10)
            };
        }

        const transactionAction = inferTransactionAction(message, currency);

        if (transactionAction) {
            const amountLabel = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(transactionAction.amount);
            return new Response(JSON.stringify({
                intent: 'add_transaction',
                transaction: transactionAction,
                reply: `Added ${transactionAction.currency === 'INR' ? '₹' : transactionAction.currency === 'USD' ? '$' : ''}${amountLabel} ${transactionAction.type} for ${transactionAction.category}.`
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const contextText = JSON.stringify({
            currency,
            summary: {
                totalIncome: summary.totalIncome ?? 0,
                totalExpenses: summary.totalExpenses ?? 0,
                balance: summary.balance ?? 0,
                transactionCount: summary.transactionCount ?? 0
            },
            categories: categorySummary,
            recentTransactions: recentTransactions.slice(0, 10).map((tx) => ({
                date: tx.date || 'unknown',
                description: tx.description || tx.title || 'Transaction',
                amount: Number(tx.amount ?? 0),
                category: tx.category || 'Miscellaneous',
                transaction_type: tx.transaction_type || 'expense'
            }))
        }, null, 2);

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey?.trim()) {
            return new Response(JSON.stringify({
                error: 'Gemini is not configured on the server. Set GEMINI_API_KEY in the Netlify environment variables.'
            }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            });
        }

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

Answer the user's question using only the financial data provided in the request.

Rules:
1. Never invent financial numbers.
2. Never claim a transaction exists unless it is included in the supplied data.
3. Use the supplied totals when answering numerical questions.
4. Do not expose internal database IDs.
5. Do not expose Supabase credentials.
6. Do not reveal API keys.
7. Clearly state when the requested information is unavailable.
8. Use the user's saved currency when displaying monetary amounts.
9. Distinguish income from expenses using transaction_type.
10. Give concise, useful answers.
11. When giving budgeting suggestions, clearly distinguish suggestions from factual financial data.
12. Do not pretend to have access to financial information that was not supplied.
13. Format money with the user's requested currency.`
                        }]
                    },
                    contents: [{
                        role: 'user',
                        parts: [{
                            text: `USER QUESTION:\n${message}\n\nUSER CURRENCY:\n${currency}\n\nFINANCIAL SUMMARY:\n${JSON.stringify(summary, null, 2)}\n\nRECENT TRANSACTIONS:\n${JSON.stringify(recentTransactions.slice(0, 10), null, 2)}\n\nCATEGORY SUMMARY:\n${JSON.stringify(categorySummary, null, 2)}\n\nFULL CONTEXT:\n${contextText}`
                        }]
                    }]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return new Response(JSON.stringify({
                error: data.error?.message || 'Gemini API error'
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

        return new Response(JSON.stringify({ reply }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Gemini function error:', error instanceof Error ? error.message : 'Unknown error');
        return new Response(JSON.stringify({
            error: 'BudgetBot is temporarily unavailable. Please try again.'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};