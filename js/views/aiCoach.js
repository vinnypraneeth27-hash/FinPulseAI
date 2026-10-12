/* ==========================================================================
   FinPulse AI - AI Coach ("Finny") View
   ========================================================================== */

import { state } from '../state.js';
import { formatCurrency, CATEGORY_META, CURRENCIES, extractAmountFromText } from '../utils.js';

export function renderAiCoachView(container) {
  const currency = state.getCurrency();
  const sym = CURRENCIES[currency]?.symbol || '$';

  container.innerHTML = `
    <div class="glass-card chat-container">
      <div class="chart-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div class="logo-icon-wrap" style="width: 40px; height: 40px; background: linear-gradient(135deg, var(--accent-cyan), var(--primary));">
            <i data-lucide="bot" style="width: 22px; height: 22px;"></i>
          </div>
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700;">Finny — AI Financial Advisor</h3>
            <p class="text-muted" style="font-size: 0.8rem;">Powered by real-time budget analytics & voice intelligence</p>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <button id="ai-voice-toggle" class="btn btn-secondary voice-toggle-btn active" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;" title="Toggle AI Speech Voice Response">
            <i data-lucide="volume-2" style="width: 14px; height: 14px;"></i>
            <span id="voice-toggle-label">Voice: ON</span>
          </button>
          <button id="ai-clear-chat" class="btn btn-secondary" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">
            Clear History
          </button>
        </div>
      </div>

      <!-- Chat Messages Scroll Container -->
      <div id="ai-chat-history" class="chat-history">
        <!-- Rendered by function -->
      </div>

      <!-- Quick Prompt Pills -->
      <div class="prompt-pills">
        <button class="pill-btn" data-prompt="Salary ${sym}5000 credited">
          💼 Salary ${sym}5000 (Income Credited)
        </button>
        <button class="pill-btn" data-prompt="Add ${sym}250 for college fees">
          🎓 College fees ${sym}250 (Education)
        </button>
        <button class="pill-btn" data-prompt="Add ${sym}35 for Biryani, curry & vegetables">
          🍗 Biryani & Curry ${sym}35 (Food)
        </button>
        <button class="pill-btn" data-prompt="Predict my future expenses for next month">
          🔮 Predict future expenses
        </button>
        <button class="pill-btn" data-prompt="Display my balance amount">
          💰 Display balance amount
        </button>
      </div>

      <!-- Input Form with Microphone Button -->
      <form id="ai-chat-form" class="chat-input-bar" style="flex-direction: column; gap: 0;">
        <div style="display: flex; gap: 0.75rem; width: 100%;">
          <div style="position: relative; flex: 1;">
            <input type="text" id="ai-chat-input" class="custom-input" placeholder="Ask Finny anything or tap mic to speak..." autocomplete="off" required style="padding-right: 2.8rem;">
            <button type="button" id="ai-mic-btn" class="mic-input-btn" title="Click to Speak (Voice Input)">
              <i data-lucide="mic" style="width: 16px; height: 16px;"></i>
            </button>
          </div>
          <button type="submit" class="btn btn-accent btn-glow">
            <i data-lucide="send"></i>
            <span>Ask Finny</span>
          </button>
        </div>
        <div id="mic-status-indicator" class="mic-status-indicator hidden">
          <span class="pulse-dot"></span>
          <span id="mic-status-text">Listening... Speak your command now (e.g. "Credit $500 for salary")</span>
        </div>
      </form>
    </div>
  `;

  let voiceOutputEnabled = true;
  let speechRecInstance = null;
  let isRecordingMic = false;

  function cleanMarkdownForSpeech(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/[`_~#]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/•/g, '')
      .replace(/💳|💸|❓|💡|📈|✂️|💰|➕|🔍|🎓|🍗|🔮/g, '')
      .trim();
  }

  function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const clean = cleanMarkdownForSpeech(text);
    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Karen')));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  function renderHistory() {
    const historyContainer = document.getElementById('ai-chat-history');
    if (!historyContainer) return;

    const messages = state.getAiChatHistory();
    historyContainer.innerHTML = messages.map(m => {
      if (m.sender === 'user') {
        return `
          <div class="chat-bubble user">
            ${m.text}
          </div>
        `;
      } else {
        const cleanMsg = cleanMarkdownForSpeech(m.text).replace(/"/g, '&quot;');
        return `
          <div class="chat-bubble ai">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.4rem;">
              <span class="ai-name" style="margin-bottom: 0;"><i data-lucide="sparkles" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i> Finny AI</span>
              <button class="speak-bubble-btn" data-speech="${cleanMsg}" title="Read message aloud">
                <i data-lucide="volume-2" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
            ${m.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
          </div>
        `;
      }
    }).join('');

    if (window.lucide) window.lucide.createIcons();
    historyContainer.scrollTop = historyContainer.scrollHeight;

    historyContainer.querySelectorAll('.speak-bubble-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const msg = btn.getAttribute('data-speech');
        if (msg) speakText(msg);
      });
    });
  }

  function parseAndAddTxFromText(userText) {
    const text = userText.toLowerCase();
    if (/\b(save|saved|saving|savings|set aside|put aside)\b/i.test(text)) return null;
    const hasSalary = text.includes('salary');
    const isCredit = text.includes('credit') || text.includes('credited') || text.includes('credits');
    const isDebit = text.includes('debit') || text.includes('debited') || text.includes('debits');
    const isAdd = isCredit || isDebit || hasSalary || text.includes('add') || text.includes('spent') || text.includes('log') || text.includes('record') || text.includes('bought') || text.includes('pay') || text.includes('paid') || text.includes('deposit') || text.includes('fee') || text.includes('fees') || text.includes('college');
    if (!isAdd) return null;

    const amount = extractAmountFromText(userText);
    if (!amount || isNaN(amount) || amount <= 0) return null;

    let isIncome = text.includes('income') || hasSalary || text.includes('earned') || text.includes('received') || text.includes('freelance') || text.includes('bonus') || isCredit;
    if (isDebit && !isCredit && !hasSalary) {
      isIncome = false;
    }
    const type = isIncome ? 'income' : 'expense';

    let txCurrency = state.getCurrency();
    if (text.includes('inr') || text.includes('₹')) txCurrency = 'INR';
    else if (text.includes('eur') || text.includes('€')) txCurrency = 'EUR';
    else if (text.includes('gbp') || text.includes('£')) txCurrency = 'GBP';
    else if (text.includes('jpy') || text.includes('¥')) txCurrency = 'JPY';
    else if (text.includes('usd') || text.includes('$')) txCurrency = 'USD';

    let category = isIncome ? 'Income' : 'Miscellaneous';
    
    if (hasSalary) {
      category = 'Income';
    }
    // 1. Education Category matching
    else if (text.includes('college') || text.includes('school') || text.includes('tuition') || text.includes('fee') || text.includes('fees') || text.includes('book') || text.includes('books') || text.includes('exam') || text.includes('course') || text.includes('class') || text.includes('education') || text.includes('coaching') || text.includes('degree') || text.includes('study')) {
      category = 'Education';
    }
    // 2. Expanded Food & Dining Category matching
    else if (text.includes('food') || text.includes('dining') || text.includes('grocer') || text.includes('restaurant') || text.includes('dinner') || text.includes('lunch') || text.includes('coffee') || text.includes('eat') || text.includes('vegetable') || text.includes('vegetables') || text.includes('fruit') || text.includes('fruits') || text.includes('biscuit') || text.includes('biscuits') || text.includes('biryani') || text.includes('curry') || text.includes('chicken') || text.includes('meat') || text.includes('snack') || text.includes('snacks') || text.includes('pizza') || text.includes('burger')) {
      category = 'Food & Dining';
    } else if (text.includes('transport') || text.includes('uber') || text.includes('gas') || text.includes('fuel') || text.includes('taxi') || text.includes('bus') || text.includes('car')) {
      category = 'Transportation';
    } else if (text.includes('rent') || text.includes('housing') || text.includes('utility') || text.includes('electric') || text.includes('wifi') || text.includes('water')) {
      category = 'Housing & Utilities';
    } else if (text.includes('shop') || text.includes('tech') || text.includes('apple') || text.includes('gadget') || text.includes('clothes') || text.includes('electronics')) {
      category = 'Shopping & Tech';
    } else if (text.includes('movie') || text.includes('concert') || text.includes('ticket') || text.includes('entertainment') || text.includes('game')) {
      category = 'Entertainment';
    } else if (text.includes('health') || text.includes('fitness') || text.includes('gym') || text.includes('doctor') || text.includes('pharmacy') || text.includes('medical')) {
      category = 'Health & Fitness';
    } else if (text.includes('subscript') || text.includes('netflix') || text.includes('spotify') || text.includes('chatgpt') || text.includes('app')) {
      category = 'Subscriptions';
    }

    let title = '';
    if (hasSalary) {
      title = 'Salary Credited';
    } else {
      const forMatch = userText.match(/(?:for|on|at|in|called|named|from|to)\s+([a-zA-Z0-9\s&'-]+)/i);
      if (forMatch && forMatch[1]) {
        title = forMatch[1].trim().replace(/\b(to|from|account|bank|expenses?|incomes?|my|the|a|an|budget)\b/gi, '').trim();
      }
      if (!title || title.length < 2) {
        if (isCredit) title = 'Account Credit Deposit';
        else if (isDebit) title = 'Bank Account Debit Removal';
        else title = category !== 'Miscellaneous' ? `${category} ${type === 'income' ? 'Income' : 'Expense'}` : (type === 'income' ? 'AI Income Deposit' : 'AI Expense');
      }
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    const tx = {
      type,
      currency: txCurrency,
      amount,
      title,
      category,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: isDebit ? 'Debit Card' : (isCredit || hasSalary ? 'Bank Transfer' : 'Credit Card'),
      recurring: hasSalary ? 'monthly' : 'false'
    };

    state.addTransaction(tx);
    const curr = state.getCurrency();
    const formattedAmt = formatCurrency(amount, curr);

    if (hasSalary) {
      return `Successfully added **${formattedAmt}** to **Income** as **Salary Credited**!`;
    } else if (isCredit) {
      return `Successfully processed **Credit**: Added **${formattedAmt}** to your account balance for **"${title}"** under **${category}**!`;
    } else if (isDebit) {
      return `Successfully processed **Debit**: Transferred/Removed **${formattedAmt}** from your bank account for **"${title}"** under **${category}**!`;
    }

    return `Successfully added **${type === 'income' ? 'Income' : 'Expense'}** of **${formattedAmt}** for **"${title}"** under **${category}** to your transactions ledger!`;
  }

  function summarizeTransactionsForBudgetBot(transactions) {
    const summary = {
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      transactionCount: transactions.length,
      byCategory: {}
    };

    transactions.forEach((tx) => {
      const amount = Number(tx.amount) || 0;
      const type = String(tx.type || tx.transaction_type || '').toLowerCase();
      if (type === 'income') {
        summary.totalIncome += amount;
      } else if (type === 'expense') {
        summary.totalExpenses += amount;
        const category = tx.category || 'Miscellaneous';
        summary.byCategory[category] = (summary.byCategory[category] || 0) + amount;
      }
    });

    summary.balance = summary.totalIncome - summary.totalExpenses;
    return summary;
  }

  function createBudgetBotFinancialContext(transactions, currency, source) {
    const normalizedTransactions = transactions.map((tx) => ({
      id: tx.id,
      amount: Number(tx.amount) || 0,
      category: tx.category || 'Miscellaneous',
      description: tx.description || tx.title || 'Transaction',
      title: tx.title || tx.description || 'Transaction',
      date: String(tx.date || ''),
      type: String(tx.type || tx.transaction_type || '').toLowerCase(),
      currency: tx.currency || currency
    }));
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTransactions = normalizedTransactions.filter((tx) => tx.date.startsWith(monthKey));
    const currentMonth = {
      period: monthKey,
      transactionCount: monthTransactions.length,
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      byCategory: {},
      transactions: monthTransactions.map(({ id, ...tx }) => tx)
    };

    monthTransactions.forEach((tx) => {
      if (!Number.isFinite(tx.amount) || tx.amount <= 0) return;
      if (tx.type === 'income') currentMonth.totalIncome += tx.amount;
      else if (tx.type === 'expense') {
        currentMonth.totalExpenses += tx.amount;
        currentMonth.byCategory[tx.category] = (currentMonth.byCategory[tx.category] || 0) + tx.amount;
      }
    });
    currentMonth.balance = currentMonth.totalIncome - currentMonth.totalExpenses;

    const summary = summarizeTransactionsForBudgetBot(normalizedTransactions);
    return {
      source,
      currency,
      transactions: normalizedTransactions,
      summary,
      currentMonth,
      budgetLimits: state.getBudgetLimits(),
      categories: summary.byCategory,
      recentTransactions: normalizedTransactions.slice(0, 8),
      savingsGoals: state.getSavingsGoals()
        .filter((goal) => goal?.id && goal?.title)
        .map(({ id, title }) => ({ id, title }))
    };
  }

  async function buildFinancialContextForBudgetBot() {
    if (!window.supabase?.auth) {
      return createBudgetBotFinancialContext(state.getTransactions(), state.getCurrency(), 'local');
    }

    const { data: sessionData, error: sessionError } = await window.supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData?.session?.user) {
      return createBudgetBotFinancialContext(state.getTransactions(), state.getCurrency(), 'local');
    }

    const [{ data: profileData, error: profileError }, { data: txData, error: txError }] = await Promise.all([
      window.supabase
        .from('user_profiles')
        .select('currency')
        .eq('id', sessionData.session.user.id)
        .maybeSingle(),
      window.supabase
        .from('expenses')
        .select('*')
        .eq('user_id', sessionData.session.user.id)
        .order('expense_date', { ascending: false })
    ]);

    if (txError) throw txError;
    if (profileError) console.warn('BudgetBot could not load the saved currency:', profileError);

    const currency = (profileData?.currency || state.getCurrency() || 'INR').toUpperCase();
    const transactions = (txData || []).map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      category: row.category,
      description: row.description,
      title: row.description,
      date: row.expense_date || row.date || '',
      type: String(row.transaction_type || '').toLowerCase(),
      currency: row.currency || currency
    }));

    return createBudgetBotFinancialContext(transactions, currency, 'supabase');
  }

  function normalizeGeminiTransactionAction(data, fallbackCurrency) {
    if (!data || data.intent !== 'add_transaction' || !data.transaction) return null;

    const tx = data.transaction;
    const amount = Number(tx.amount);
    const type = String(tx.type || '').toLowerCase();
    const currency = String(tx.currency || fallbackCurrency || '').trim().toUpperCase();
    const category = String(tx.category || '').trim();
    const title = String(tx.title || '').trim();
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !['income', 'expense'].includes(type) ||
      !Object.hasOwn(CURRENCIES, currency) ||
      !Object.hasOwn(CATEGORY_META, category) ||
      !title
    ) return null;

    return {
      type,
      amount,
      currency,
      category,
      title,
      date: tx.date || new Date().toISOString().split('T')[0],
      paymentMethod: 'Credit Card',
      recurring: 'false'
    };
  }

  async function askBudgetBot(userText, financialContext) {
    const payload = {
      message: userText,
      currency: financialContext?.currency || state.getCurrency() || 'INR',
      financialContext: {
        currency: financialContext?.currency || state.getCurrency() || 'INR',
        summary: financialContext?.summary || summarizeTransactionsForBudgetBot(state.getTransactions()),
        currentMonth: financialContext?.currentMonth || {},
        budgetLimits: financialContext?.budgetLimits || state.getBudgetLimits(),
        categories: financialContext?.categories || {},
        recentTransactions: financialContext?.recentTransactions || state.getTransactions().slice(0, 8),
        transactions: financialContext?.transactions || state.getTransactions().slice(0, 8),
        savingsGoals: financialContext?.savingsGoals || []
      }
    };

    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'BudgetBot request failed');
    }

    if (data?.intent === 'add_transaction') {
      const tx = normalizeGeminiTransactionAction(data, payload.currency);
      if (tx) {
        return {
          intent: 'add_transaction',
          transaction: tx,
          reply: data.reply || 'I understood this as a transaction request and am validating it. Nothing has been saved yet.'
        };
      }
      return {
        intent: 'clarify',
        reply: 'I could not confidently validate that transaction. Please restate the amount, type, and category; nothing was saved.'
      };
    }

    if (data?.intent === 'add_savings') {
      const amount = Number(data.amount);
      const currency = String(data.currency || payload.currency || '').trim().toUpperCase();
      if (Number.isFinite(amount) && amount > 0 && Object.hasOwn(CURRENCIES, currency)) {
        return { intent: 'add_savings', amount, currency };
      }
      return {
        intent: 'clarify',
        reply: 'I could not confidently validate that savings amount or currency. Nothing was saved.'
      };
    }

    if (data?.intent === 'clarify' && typeof data.reply === 'string' && data.reply.trim()) {
      return data;
    }
    if (data?.intent === 'question' && typeof data.reply === 'string' && data.reply.trim()) {
      return data.reply;
    }
    throw new Error('BudgetBot returned an invalid intent response.');
  }

  function resolveSavingsGoal(userText) {
    const goals = state.getSavingsGoals().filter((goal) => goal?.id && goal?.title);
    if (!goals.length) {
      return { clarification: 'You do not have a savings goal to deposit into yet. Create a goal first; nothing was changed.' };
    }

    const normalizedText = String(userText).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const exactMatches = goals.filter((goal) => {
      const normalizedTitle = goal.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return normalizedTitle && normalizedText.includes(normalizedTitle);
    });
    if (exactMatches.length === 1) return { goal: exactMatches[0] };
    if (exactMatches.length > 1) {
      return { clarification: `Which savings goal should I use: ${exactMatches.map((goal) => goal.title).join(', ')}? Nothing was changed.` };
    }

    const goalScores = goals.map((goal) => {
      const words = goal.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/)
        .filter((word) => word.length > 2 && !['the', 'and', 'for', 'goal'].includes(word));
      return { goal, score: words.filter((word) => normalizedText.includes(word)).length };
    }).sort((left, right) => right.score - left.score);

    if (goalScores[0]?.score > 0 && goalScores[0].score > (goalScores[1]?.score || 0)) {
      return { goal: goalScores[0].goal };
    }
    if (goals.length === 1) return { goal: goals[0] };

    return {
      clarification: `Which savings goal should I add this to: ${goals.map((goal) => goal.title).join(', ')}? Nothing was changed.`
    };
  }

  // AI Inference Parser
  function generateAiResponse(userText) {
    const text = userText.toLowerCase().trim();
    const totals = state.getTotals();
    const curr = state.getCurrency();

    const greetings = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 'hi there', 'hello there', 'hey there', 'hola', 'namaste'];
    const cleanText = text.replace(/[^a-z0-9\s]/g, '');
    const words = cleanText.split(/\s+/).filter(Boolean);

    if (greetings.includes(cleanText) || (words.length <= 3 && words.some(w => greetings.includes(w)))) {
      return "Hi! I can help you manage your money better. Please tell me your income, expenditure, and category so I can guide you properly.";
    }

    if (text.includes('balance') || text.includes('remaining amount') || text.includes('show balance') || text.includes('display balance')) {
      const remainingAmount = totals.netSavings;
      const formattedRemaining = formatCurrency(remainingAmount, curr);
      return `💰 **Account Balance Summary**:

Balance Amount : ${formattedRemaining}

*(Total Income: ${formatCurrency(totals.totalIncome, curr)} | Total Expenses: ${formatCurrency(totals.totalExpenses, curr)})*`;
    }

    if (text.includes('predict') || text.includes('future') || text.includes('forecast') || text.includes('next month')) {
      const currentExpenses = totals.totalExpenses;
      const subsCost = state.getSubscriptions().filter(s => s.status === 'Active').reduce((acc, s) => acc + s.amount, 0);
      const predictedExpenses = Math.round(currentExpenses * 1.05 + (subsCost * 0.2));
      const predictedSurplus = Math.max(0, totals.totalIncome - predictedExpenses);

      let categoryBreakdown = '';
      for (const cat in totals.actualByCategory) {
        const catPred = Math.round(totals.actualByCategory[cat] * 1.04);
        categoryBreakdown += `\n• **${cat}**: approx. **${formatCurrency(catPred, curr)}**`;
      }
      if (!categoryBreakdown) categoryBreakdown = `\n• **General Expenses**: approx. **${formatCurrency(predictedExpenses, curr)}**`;

      return `🔮 **AI Future Expense Prediction**:

Based on your historical spending patterns & active subscriptions:
• **Predicted Next Month Expenses**: **${formatCurrency(predictedExpenses, curr)}**
• **Estimated Next Month Surplus**: **${formatCurrency(predictedSurplus, curr)}**

**Predicted Category Breakdown**: ${categoryBreakdown}

*Tip: You can lower your future expenses by auditing your active subscriptions or setting stricter category budget limits!*`;
    }

    const amountMatch = userText.match(/(?:[\$€£₹¥]|USD|EUR|GBP|INR|JPY|CAD|AUD|CHF|CNY|AED|BRL|SGD)?\s*([\d,]+(?:\.\d+)?)/i);
    if ((text.includes('credit') || text.includes('debit')) && !amountMatch) {
      return `Here is how I process **Credit** and **Debit** commands:
1. **Credit**: Adding of money to your account (Income / Deposit / Inflow).
2. **Debit**: Transferring or removing money from your bank account (Expense / Withdrawal / Outflow).

*Try entering commands like:*
• *"Credit $500 for salary"* (Adds $500 to your account)
• *"Debit $50 for groceries"* (Transfers/removes $50 from your bank account)`;
    }

    const addTxResponse = parseAndAddTxFromText(userText);
    if (addTxResponse) {
      return addTxResponse;
    }

    if (text.includes('afford') || text.includes('purchase')) {
      const amount = extractAmountFromText(userText) || 400;
      const remaining = totals.netSavings;

      if (amount <= remaining * 0.7) {
        return `Yes, you can afford a **${formatCurrency(amount, curr)}** purchase! You currently have a net monthly surplus of **${formatCurrency(remaining, curr)}**. This purchase would take roughly **${((amount / remaining) * 100).toFixed(0)}%** of your remaining monthly savings without pushing you into deficit.`;
      }
      return `Caution advised: A **${formatCurrency(amount, curr)}** purchase would consume **${((amount / Math.max(1, remaining)) * 100).toFixed(0)}%** of your remaining monthly surplus (**${formatCurrency(remaining, curr)}**). Consider delaying this by 2 weeks or reallocating from your Shopping budget.`;
    }

    if (text.includes('overspend') || text.includes('where')) {
      let topCategory = 'Food & Dining';
      let topAmount = 0;
      for (const cat in totals.actualByCategory) {
        if (totals.actualByCategory[cat] > topAmount) {
          topAmount = totals.actualByCategory[cat];
          topCategory = cat;
        }
      }
      return `Based on your July transactions, your highest spending area is **${topCategory}** at **${formatCurrency(topAmount, curr)}**. You've spent **${((topAmount / totals.totalExpenses) * 100).toFixed(0)}%** of your total expenses in this single category.`;
    }

    if (text.includes('save') || text.includes('increase')) {
      const targetSavings = totals.totalExpenses * 0.15;
      return `To boost savings by **15%** (approx. **${formatCurrency(targetSavings, curr)}/month**):
1. **Reduce Dining Out**: Cutting Food & Dining by $120/month.
2. **Audit Subscriptions**: Cancel 2 unused under-review subscriptions (saves ~$35/month).
3. **Automate Transfers**: Set up auto-deposit into your Kyoto Vacation goal on paydays.`;
    }

    if (text.includes('subscription') || text.includes('audit')) {
      const subs = state.getSubscriptions();
      const activeSubs = subs.filter(s => s.status === 'Active');
      const totalSubCost = activeSubs.reduce((acc, s) => acc + s.amount, 0);
      return `You currently have **${activeSubs.length} active subscriptions** totaling **${formatCurrency(totalSubCost, curr)}/month** (**${formatCurrency(totalSubCost * 12, curr)}/year**). 
I detected **"Unused Magazine App"** ($14.99/mo) has zero log-in activity. Cancelling it will immediately save you **${formatCurrency(179.88, curr)} annually**!`;
    }

    return `I analyzed your query regarding *"${userText}"*. Your current financial health score is **${totals.healthScore}/100**. Your net monthly savings is **${formatCurrency(totals.netSavings, curr)}** (**${totals.savingsRate.toFixed(1)}% savings rate**). If you'd like, I can help you create a dedicated goal or adjust your budget limits!`;
  }

  let autoSendTimer = null;
  let countdownInterval = null;

  function clearAutoSendTimer() {
    if (autoSendTimer) {
      clearTimeout(autoSendTimer);
      autoSendTimer = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function start3SecAutoSend() {
    clearAutoSendTimer();
    const textToSend = input ? input.value.trim() : '';
    if (!textToSend) {
      micStatus?.classList.add('hidden');
      return;
    }

    let secondsLeft = 3;
    micStatus?.classList.remove('hidden');
    if (micStatusText) {
      micStatusText.innerHTML = `⚡ Voice captured: <strong>"${textToSend}"</strong>. Auto-sending in <span style="color: var(--accent-cyan); font-weight:800; font-size:1.05rem; display:inline-block; width:22px; text-align:center;">${secondsLeft}s</span>...`;
    }

    countdownInterval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft > 0) {
        if (micStatusText) {
          micStatusText.innerHTML = `⚡ Voice captured: <strong>"${textToSend}"</strong>. Auto-sending in <span style="color: var(--accent-cyan); font-weight:800; font-size:1.05rem; display:inline-block; width:22px; text-align:center;">${secondsLeft}s</span>...`;
        }
      } else {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    }, 1000);

    autoSendTimer = setTimeout(() => {
      clearAutoSendTimer();
      micStatus?.classList.add('hidden');
      if (input && input.value.trim()) {
        const msg = input.value;
        input.value = '';
        handleSendMessage(msg);
      }
    }, 3000);
  }

  // Handle Form Submit
  async function handleSendMessage(userMsg) {
    clearAutoSendTimer();
    micStatus?.classList.add('hidden');
    const trimmedMsg = String(userMsg || '').trim();
    if (!trimmedMsg) return;

    if (window.speechSynthesis) window.speechSynthesis.cancel();
    state.addAiChatMessage('user', trimmedMsg);
    renderHistory();

    try {
      const financialContext = await buildFinancialContextForBudgetBot();
      const aiResult = await askBudgetBot(trimmedMsg, financialContext);

      let aiReplyText = typeof aiResult === 'string' ? aiResult : (aiResult?.reply || 'BudgetBot could not generate a response.');

      if (aiResult && typeof aiResult === 'object' && aiResult.intent === 'add_transaction') {
        if (/\b(save|saved|saving|savings|set aside|put aside)\b/i.test(trimmedMsg)) {
          aiReplyText = 'I want to make sure savings are not recorded as an expense. Should I add this to a savings goal instead? Nothing was changed.';
        } else {
          const tx = aiResult.transaction;
          const txnToSave = {
            ...tx,
            paymentMethod: 'Credit Card',
            recurring: 'false'
          };

          const savedTx = state.addTransaction(txnToSave);
          try {
            if (financialContext.source === 'supabase') {
              if (typeof window.app?.syncTransactionToSupabase !== 'function') {
                throw new Error('Supabase transaction sync is unavailable.');
              }
              const syncedRow = await window.app.syncTransactionToSupabase(savedTx);
              if (!syncedRow?.id) throw new Error('Supabase did not confirm the transaction save.');
            }
          } catch (syncError) {
            state.deleteTransaction(savedTx.id);
            console.error('BudgetBot transaction sync failed:', syncError);
            throw syncError;
          }

          window.app?.renderCurrentView();
          window.app?.updateSidebarHealth();
          const symbol = CURRENCIES[txnToSave.currency]?.symbol || '₹';
          aiReplyText = `Added ${symbol}${Number(txnToSave.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${txnToSave.type} for ${txnToSave.category}.`;
        }
      }

      if (aiResult && typeof aiResult === 'object' && aiResult.intent === 'add_savings') {
        const { goal, clarification } = resolveSavingsGoal(trimmedMsg);
        if (!goal) {
          aiReplyText = clarification;
        } else {
          const updatedGoal = state.depositToGoal(goal.id, aiResult.amount);
          if (!updatedGoal) throw new Error('The selected savings goal could not be updated.');
          window.app?.renderCurrentView();
          window.app?.updateSidebarHealth();
          const symbol = CURRENCIES[aiResult.currency]?.symbol || '₹';
          const amount = Number(aiResult.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
          aiReplyText = `Added ${symbol}${amount} to your **${updatedGoal.title}** savings goal.`;
        }
      }

      state.addAiChatMessage('ai', aiReplyText);
      renderHistory();
      if (voiceOutputEnabled) {
        speakText(aiReplyText);
      }
    } catch (error) {
      console.error('Finny AI request failed:', error);
      const failureReply = 'BudgetBot could not confirm that request. If you tried to add a transaction, check your Transactions before trying again.';
      state.addAiChatMessage('ai', failureReply);
      renderHistory();
    }
  }

  setTimeout(() => {
    renderHistory();
    if (window.lucide) window.lucide.createIcons();
  }, 50);

  // Event Listeners
  const form = document.getElementById('ai-chat-form');
  const input = document.getElementById('ai-chat-input');
  const micBtn = document.getElementById('ai-mic-btn');
  const micStatus = document.getElementById('mic-status-indicator');
  const micStatusText = document.getElementById('mic-status-text');
  const voiceToggleBtn = document.getElementById('ai-voice-toggle');
  const voiceToggleLabel = document.getElementById('voice-toggle-label');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAutoSendTimer();
    const text = input.value;
    input.value = '';
    handleSendMessage(text);
  });

  input?.addEventListener('input', () => {
    clearAutoSendTimer();
    micStatus?.classList.add('hidden');
  });

  // Pill click handlers
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      clearAutoSendTimer();
      const prompt = btn.getAttribute('data-prompt');
      handleSendMessage(prompt);
    });
  });

  // Clear chat
  document.getElementById('ai-clear-chat')?.addEventListener('click', () => {
    clearAutoSendTimer();
    micStatus?.classList.add('hidden');
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    state.data.aiChatHistory = [];
    state.saveState();
    renderHistory();
  });

  // Microphone Speech Recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (micBtn) {
    if (!SpeechRecognition) {
      micBtn.title = "Browser does not support Speech Recognition";
      micBtn.style.opacity = "0.5";
    }

    micBtn.addEventListener('click', () => {
      clearAutoSendTimer();
      if (!SpeechRecognition) {
        alert("Speech Recognition is not supported by your browser. Please try Chrome, Edge, or Safari.");
        return;
      }

      if (isRecordingMic) {
        if (speechRecInstance) speechRecInstance.stop();
        isRecordingMic = false;
        micBtn.classList.remove('listening');
      } else {
        try {
          speechRecInstance = new SpeechRecognition();
          speechRecInstance.continuous = false;
          speechRecInstance.interimResults = true;
          speechRecInstance.lang = 'en-US';

          speechRecInstance.onstart = () => {
            clearAutoSendTimer();
            isRecordingMic = true;
            micBtn.classList.add('listening');
            micStatus?.classList.remove('hidden');
            if (micStatusText) micStatusText.textContent = 'Listening... Speak your command now!';
          };

          speechRecInstance.onresult = (e) => {
            let finalTranscript = '';
            for (let i = e.resultIndex; i < e.results.length; ++i) {
              finalTranscript += e.results[i][0].transcript;
            }
            if (input && finalTranscript) {
              input.value = finalTranscript;
            }
          };

          speechRecInstance.onerror = (e) => {
            console.warn("Speech recognition error:", e.error);
            isRecordingMic = false;
            micBtn.classList.remove('listening');
            if (micStatusText) micStatusText.textContent = `Mic error (${e.error}). Type your query instead.`;
            setTimeout(() => micStatus?.classList.add('hidden'), 3000);
          };

          speechRecInstance.onend = () => {
            isRecordingMic = false;
            micBtn.classList.remove('listening');
            if (input && input.value.trim()) {
              start3SecAutoSend();
            } else {
              micStatus?.classList.add('hidden');
            }
          };

          speechRecInstance.start();
        } catch (err) {
          console.error("Mic start error:", err);
          isRecordingMic = false;
          micBtn.classList.remove('listening');
        }
      }
    });
  }

  // Voice Speech Output Toggle
  voiceToggleBtn?.addEventListener('click', () => {
    voiceOutputEnabled = !voiceOutputEnabled;
    if (voiceOutputEnabled) {
      voiceToggleBtn.classList.add('active');
      if (voiceToggleLabel) voiceToggleLabel.textContent = 'Voice: ON';
      speakText("AI Voice response enabled.");
    } else {
      voiceToggleBtn.classList.remove('active');
      if (voiceToggleLabel) voiceToggleLabel.textContent = 'Voice: OFF';
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
  });
}
