/* ==========================================================================
   FinPulse AI - Standalone Single-File Application Bundle
   (Compatible with both local file:/// double-click and http:// servers)
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     1. UTILITIES & METADATA
     -------------------------------------------------------------------------- */
  const CURRENCIES = {
    USD: { symbol: '$', rate: 1.0, label: 'USD ($)', flag: '🇺🇸', country: 'United States' },
    EUR: { symbol: '€', rate: 0.92, label: 'EUR (€)', flag: '🇪🇺', country: 'Eurozone' },
    GBP: { symbol: '£', rate: 0.78, label: 'GBP (£)', flag: '🇬🇧', country: 'United Kingdom' },
    INR: { symbol: '₹', rate: 83.5, label: 'INR (₹)', flag: '🇮🇳', country: 'India' },
    JPY: { symbol: '¥', rate: 155.0, label: 'JPY (¥)', flag: '🇯🇵', country: 'Japan' },
    CAD: { symbol: 'CA$', rate: 1.37, label: 'CAD (CA$)', flag: '🇨🇦', country: 'Canada' },
    AUD: { symbol: 'A$', rate: 1.52, label: 'AUD (A$)', flag: '🇦🇺', country: 'Australia' },
    CHF: { symbol: 'CHF', rate: 0.89, label: 'CHF (CHF)', flag: '🇨🇭', country: 'Switzerland' },
    CNY: { symbol: '¥', rate: 7.25, label: 'CNY (¥)', flag: '🇨🇳', country: 'China' },
    AED: { symbol: 'AED', rate: 3.67, label: 'AED (AED)', flag: '🇦🇪', country: 'United Arab Emirates' },
    BRL: { symbol: 'R$', rate: 5.60, label: 'BRL (R$)', flag: '🇧🇷', country: 'Brazil' },
    SGD: { symbol: 'S$', rate: 1.35, label: 'SGD (S$)', flag: '🇸🇬', country: 'Singapore' }
  };

  const CATEGORY_META = {
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

  function getTxBaseAmount(t) {
    if (typeof t.baseAmount === 'number' && !isNaN(t.baseAmount)) {
      return t.baseAmount;
    }
    const curr = t.currency || 'USD';
    const rate = CURRENCIES[curr]?.rate || 1.0;
    return (parseFloat(t.amount) || 0) / rate;
  }

  function getTxConvertedAmount(t, targetCurrencyCode = 'USD') {
    const base = getTxBaseAmount(t);
    const targetRate = CURRENCIES[targetCurrencyCode]?.rate || 1.0;
    return base * targetRate;
  }

  function formatCurrency(amount, currencyCode = 'USD') {
    const curr = CURRENCIES[currencyCode] || CURRENCIES.USD;
    if (currencyCode === 'JPY') {
      return `${curr.symbol}${Math.round(amount).toLocaleString()}`;
    }
    return `${curr.symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function calculateHealthScore(totalIncome, totalExpenses, budgetLimits, actualByCategory) {
    if ((!totalIncome || totalIncome <= 0) && (!totalExpenses || totalExpenses <= 0)) {
      return 100;
    }
    if (!totalIncome || totalIncome <= 0) return 65;
    const savingsRate = Math.max(0, (totalIncome - totalExpenses) / totalIncome);
    const savingsScore = Math.min(40, savingsRate * 100);

    let overBudgetCount = 0;
    let totalBudgets = 0;
    for (const cat in budgetLimits) {
      totalBudgets++;
      const spent = actualByCategory[cat] || 0;
      if (spent > budgetLimits[cat]) overBudgetCount++;
    }
    const budgetScore = totalBudgets > 0 ? ((totalBudgets - overBudgetCount) / totalBudgets) * 40 : 35;

    const expRatio = totalExpenses / totalIncome;
    let ratioScore = 20;
    if (expRatio > 0.9) ratioScore = 5;
    else if (expRatio > 0.75) ratioScore = 12;

    return Math.min(99, Math.max(20, Math.round(savingsScore + budgetScore + ratioScore)));
  }

  function exportTransactionsToCSV(transactions, currencyCode = 'USD') {
    if (!transactions.length) return;
    const headers = ['ID', 'Date', 'Type', 'Title', 'Category', `Amount (${currencyCode})`, 'Original Currency', 'Payment Method', 'Recurring'];
    const rows = transactions.map(t => [
      t.id, t.date, t.type, `"${t.title.replace(/"/g, '""')}"`, t.category, getTxConvertedAmount(t, currencyCode).toFixed(2), t.currency || 'USD', t.paymentMethod, t.recurring || 'false'
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

  /* --------------------------------------------------------------------------
     2. CENTRAL STATE & LOCAL STORAGE
     -------------------------------------------------------------------------- */
  const STORAGE_KEY = 'FINPULSE_AI_STATE_V1';

  const DEFAULT_SEED_DATA = {
    currency: 'USD',
    theme: 'dark',
    transactions: [
      { id: 'tx-101', type: 'income', title: 'TechCorp Senior Dev Salary', category: 'Income', amount: 5500.00, currency: 'USD', baseAmount: 5500.00, date: '2026-07-01', paymentMethod: 'Bank Transfer', recurring: 'monthly' },
      { id: 'tx-102', type: 'expense', title: 'Luxury Apartment Rent', category: 'Housing & Utilities', amount: 1850.00, currency: 'USD', baseAmount: 1850.00, date: '2026-07-02', paymentMethod: 'Bank Transfer', recurring: 'monthly' },
      { id: 'tx-103', type: 'expense', title: 'Whole Foods Market Organic Groceries', category: 'Food & Dining', amount: 245.50, currency: 'USD', baseAmount: 245.50, date: '2026-07-04', paymentMethod: 'Credit Card', recurring: 'false' },
      { id: 'tx-104', type: 'expense', title: 'Tesla Supercharger Station', category: 'Transportation', amount: 42.00, currency: 'USD', baseAmount: 42.00, date: '2026-07-05', paymentMethod: 'Apple Pay / Wallet', recurring: 'false' },
      { id: 'tx-105', type: 'expense', title: 'Netflix Ultra HD Subscription', category: 'Subscriptions', amount: 22.99, currency: 'USD', baseAmount: 22.99, date: '2026-07-06', paymentMethod: 'Credit Card', recurring: 'monthly' },
      { id: 'tx-106', type: 'expense', title: 'Spotify Premium Family Plan', category: 'Subscriptions', amount: 16.99, currency: 'USD', baseAmount: 16.99, date: '2026-07-07', paymentMethod: 'Credit Card', recurring: 'monthly' },
      { id: 'tx-107', type: 'income', title: 'Freelance UI/UX Consultation', category: 'Income', amount: 1200.00, currency: 'USD', baseAmount: 1200.00, date: '2026-07-10', paymentMethod: 'Bank Transfer', recurring: 'false' },
      { id: 'tx-108', type: 'expense', title: 'Equinox Fitness Club Pass', category: 'Health & Fitness', amount: 180.00, currency: 'USD', baseAmount: 180.00, date: '2026-07-11', paymentMethod: 'Credit Card', recurring: 'monthly' },
      { id: 'tx-109', type: 'expense', title: 'Apple Store - Wireless Headphones', category: 'Shopping & Tech', amount: 349.00, currency: 'USD', baseAmount: 349.00, date: '2026-07-14', paymentMethod: 'Credit Card', recurring: 'false' },
      { id: 'tx-110', type: 'expense', title: 'Nobu Restaurant Omakase Dinner', category: 'Food & Dining', amount: 310.00, currency: 'USD', baseAmount: 310.00, date: '2026-07-18', paymentMethod: 'Credit Card', recurring: 'false' },
      { id: 'tx-111', type: 'expense', title: 'OpenAI ChatGPT Plus Subscription', category: 'Subscriptions', amount: 20.00, currency: 'USD', baseAmount: 20.00, date: '2026-07-20', paymentMethod: 'Credit Card', recurring: 'monthly' },
      { id: 'tx-112', type: 'expense', title: 'Concert Tickets - Summer Music Fest', category: 'Entertainment', amount: 175.00, currency: 'USD', baseAmount: 175.00, date: '2026-07-22', paymentMethod: 'Credit Card', recurring: 'false' }
    ],
    budgetLimits: {
      'Food & Dining': 650,
      'Transportation': 200,
      'Housing & Utilities': 2000,
      'Shopping & Tech': 400,
      'Entertainment': 250,
      'Health & Fitness': 200,
      'Subscriptions': 100,
      'Miscellaneous': 200
    },
    savingsGoals: [
      { id: 'goal-1', title: '6-Month Emergency Safety Net', targetAmount: 15000, currentAmount: 11250, targetDate: '2026-12-31', icon: 'shield-check', color: '#10b981' },
      { id: 'goal-2', title: 'Kyoto Vacation & Alpine Trek', targetAmount: 4500, currentAmount: 3150, targetDate: '2026-10-15', icon: 'plane', color: '#06b6d4' },
      { id: 'goal-3', title: 'Next-Gen M4 Max Workstation', targetAmount: 3800, currentAmount: 2400, targetDate: '2026-09-01', icon: 'laptop', color: '#8b5cf6' }
    ],
    subscriptions: [
      { id: 'sub-1', name: 'Netflix Ultra HD', amount: 22.99, billingCycle: 'Monthly', nextBillDate: '2026-08-06', status: 'Active', category: 'Entertainment' },
      { id: 'sub-2', name: 'Spotify Family Plan', amount: 16.99, billingCycle: 'Monthly', nextBillDate: '2026-08-07', status: 'Active', category: 'Entertainment' },
      { id: 'sub-3', name: 'ChatGPT Plus', amount: 20.00, billingCycle: 'Monthly', nextBillDate: '2026-08-20', status: 'Active', category: 'Tech' },
      { id: 'sub-4', name: 'Cloud Storage 2TB', amount: 9.99, billingCycle: 'Monthly', nextBillDate: '2026-08-15', status: 'Active', category: 'Tech' },
      { id: 'sub-5', name: 'Unused Magazine App', amount: 14.99, billingCycle: 'Monthly', nextBillDate: '2026-08-25', status: 'Under Review', category: 'Media' }
    ],
    userName: '',
    aiChatHistory: [
      { sender: 'ai', text: 'Hello! I am **BudgetBot**, your AI Financial Agent. I have analyzed your July 2026 cash flow. You are currently saving **52%** of your total monthly income. How can I help optimize your budget today?' }
    ]
  };

  const NEW_USER_BLANK_STATE = {
    currency: 'USD',
    theme: 'dark',
    userName: '',
    transactions: [],
    budgetLimits: {
      'Food & Dining': 500,
      'Transportation': 200,
      'Housing & Utilities': 1500,
      'Shopping & Tech': 300,
      'Education': 400,
      'Entertainment': 200,
      'Health & Fitness': 150,
      'Subscriptions': 100,
      'Miscellaneous': 150
    },
    savingsGoals: [
      { id: 'goal-1', title: 'Emergency Safety Net', targetAmount: 5000, currentAmount: 0, targetDate: '2026-12-31', icon: 'shield-check', color: '#10b981' }
    ],
    subscriptions: [],
    aiChatHistory: [
      {
        sender: 'ai',
        text: 'Welcome! I am **BudgetBot**, your AI Financial Agent. Your new account is active.\n\n• **Total Balance**: **$0.00**\n• **Monthly Income**: **$0.00**\n• **Total Spent**: **$0.00**\n• **AI Health Score**: **100/100**\n\nAdd your first income or expense transaction or tap the mic to start tracking!'
      }
    ]
  };

  const REGISTRY_KEY = 'FINPULSE_USERS_REGISTRY_V1';

  function normalizeUsername(name) {
    if (!name) return '';
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  function getUserStorageKey(username) {
    const norm = normalizeUsername(username);
    return `FINPULSE_USER_DATA_${norm}`;
  }

  function validatePassword(password) {
    if (!password) return { valid: false, message: 'Password is required.' };
    const words = password.trim().split(/\s+/);
    if (words.length >= 5 && words.length <= 7 && password.length >= 8) {
      return { valid: true, message: 'Strong passphrase!' };
    }
    const hasMinLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasMinLength) {
      return { valid: false, message: 'Password must be at least 8 characters long.' };
    }
    if (!(hasUpper && hasLower && hasNumber && hasSymbol)) {
      return { valid: false, message: 'Password must contain a mix of uppercase (A-Z), lowercase (a-z), numbers (0-9), and symbols (!@#$).' };
    }
    return { valid: true, message: 'Strong password!' };
  }

  class StateManager {
    constructor() {
      this.activeUser = null;
      this.data = JSON.parse(JSON.stringify(NEW_USER_BLANK_STATE));
    }

    getUsersRegistry() {
      try {
        const reg = localStorage.getItem(REGISTRY_KEY);
        return reg ? JSON.parse(reg) : {};
      } catch (e) { return {}; }
    }

    saveUsersRegistry(registry) {
      try { localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry)); } catch (e) { console.error(e); }
    }

    userExists(username) {
      const norm = normalizeUsername(username);
      if (!norm) return false;
      return !!this.getUsersRegistry()[norm];
    }

    authenticateUser(username, password) {
      const norm = normalizeUsername(username);
      if (!norm) return { success: false, message: 'User name is required.' };
      const registry = this.getUsersRegistry();
      const userRecord = registry[norm];

      if (!userRecord) {
        return { success: false, isNewUser: true, message: 'New user detected. Please create a password.' };
      }
      if (userRecord.password !== password) {
        return { success: false, isNewUser: false, message: 'Incorrect password for this user. Please try again.' };
      }

      this.activeUser = userRecord.username;
      this.loadUserData(userRecord.username);
      return { success: true, isNewUser: false, username: userRecord.username };
    }

    registerAndLoginUser(username, password) {
      const norm = normalizeUsername(username);
      if (!norm) return { success: false, message: 'User name is required.' };

      const validation = validatePassword(password);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      const registry = this.getUsersRegistry();
      registry[norm] = {
        username: username.trim(),
        password: password,
        createdAt: new Date().toISOString()
      };
      this.saveUsersRegistry(registry);

      this.activeUser = username.trim();
      this.data = JSON.parse(JSON.stringify(NEW_USER_BLANK_STATE));
      this.data.userName = username.trim();
      this.saveState();

      return { success: true, username: username.trim() };
    }

    loadUserData(username) {
      const key = getUserStorageKey(username);
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          this.data = JSON.parse(stored);
          this.data.userName = username;
          return;
        }
      } catch (e) {
        console.warn('Failed to load user data.', e);
      }
      this.data = JSON.parse(JSON.stringify(NEW_USER_BLANK_STATE));
      this.data.userName = username;
      this.saveState();
    }

    saveState() {
      if (!this.activeUser) return;
      const key = getUserStorageKey(this.activeUser);
      try {
        localStorage.setItem(key, JSON.stringify(this.data));
      } catch (e) {
        console.error('Error saving user data:', e);
      }
    }



    async changePassword(currentPassword, newPassword) {
      if (!this.activeUser) {
        return { success: false, message: 'No active user is logged in.' };
      }

      const norm = normalizeUsername(this.activeUser);
      const registry = this.getUsersRegistry();
      const userRecord = registry[norm];

      if (!userRecord) {
        return { success: false, message: 'User account record not found.' };
      }

      if (userRecord.password && userRecord.password !== currentPassword) {
        return { success: false, message: 'Current password does not match.' };
      }

      const validation = validatePassword(newPassword);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }

      userRecord.password = newPassword;
      userRecord.updatedAt = new Date().toISOString();
      this.saveUsersRegistry(registry);

      this.saveState();
      return { success: true, message: 'Password updated successfully!' };
    }

    logout() {
      this.activeUser = null;
      this.data = JSON.parse(JSON.stringify(NEW_USER_BLANK_STATE));
    }

    getUserName() { return this.activeUser || this.data.userName || ''; }
    setUserName(name) { this.data.userName = name; this.saveState(); }
    getCurrency() { return this.data.currency; }
    setCurrency(c) { this.data.currency = c; this.saveState(); }
    getTheme() { return this.data.theme || 'dark'; }
    setTheme(t) { this.data.theme = t; this.saveState(); }
    getTransactions() { return [...this.data.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)); }
    addTransaction(tx) {
      tx.id = 'tx-' + Date.now();
      tx.currency = tx.currency || this.getCurrency();
      const rate = CURRENCIES[tx.currency]?.rate || 1.0;
      tx.baseAmount = parseFloat(tx.amount) / rate;
      this.data.transactions.unshift(tx);
      this.saveState();
      return tx;
    }
    updateTransaction(tx) {
      tx.currency = tx.currency || this.getCurrency();
      const rate = CURRENCIES[tx.currency]?.rate || 1.0;
      tx.baseAmount = parseFloat(tx.amount) / rate;
      const idx = this.data.transactions.findIndex(t => t.id === tx.id);
      if (idx !== -1) { this.data.transactions[idx] = tx; this.saveState(); }
    }
    deleteTransaction(id) {
      this.data.transactions = this.data.transactions.filter(t => t.id !== id);
      this.saveState();
    }
    getBudgetLimits() { return { ...this.data.budgetLimits }; }
    setBudgetLimit(cat, amt) { this.data.budgetLimits[cat] = parseFloat(amt); this.saveState(); }
    getSavingsGoals() { return [...this.data.savingsGoals]; }
    depositToGoal(id, amt) {
      const g = this.data.savingsGoals.find(x => x.id === id);
      if (g) { g.currentAmount += parseFloat(amt); this.saveState(); return g; }
      return null;
    }
    getSubscriptions() { return [...this.data.subscriptions]; }
    toggleSubscriptionStatus(id) {
      const s = this.data.subscriptions.find(x => x.id === id);
      if (s) { s.status = s.status === 'Active' ? 'Cancelled' : 'Active'; this.saveState(); }
    }
    getAiChatHistory() { return [...this.data.aiChatHistory]; }
    addAiChatMessage(sender, text) { this.data.aiChatHistory.push({ sender, text }); this.saveState(); }
    getTotals() {
      let baseIncome = 0, baseExpenses = 0;
      const baseActualByCategory = {};
      this.data.transactions.forEach(t => {
        const baseAmt = getTxBaseAmount(t);
        if (t.type === 'income') baseIncome += baseAmt;
        else {
          baseExpenses += baseAmt;
          baseActualByCategory[t.category] = (baseActualByCategory[t.category] || 0) + baseAmt;
        }
      });

      const currRate = CURRENCIES[this.getCurrency()]?.rate || 1.0;
      const totalIncome = baseIncome * currRate;
      const totalExpenses = baseExpenses * currRate;
      const actualByCategory = {};
      for (const cat in baseActualByCategory) {
        actualByCategory[cat] = baseActualByCategory[cat] * currRate;
      }

      const netSavings = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
      const healthScore = calculateHealthScore(totalIncome, totalExpenses, this.data.budgetLimits, actualByCategory);
      return { totalIncome, totalExpenses, netSavings, savingsRate, healthScore, actualByCategory };
    }
  }

  const state = new StateManager();

  function getAuthRedirectUrl() {
    const currentOrigin = window.location.origin;
    if (currentOrigin && currentOrigin !== 'null') return currentOrigin;
    return 'http://localhost:8080';
  }

  function setAuthMessage(message, variant = 'info') {
    const messageEl = document.getElementById('auth-message');
    if (!messageEl) return;

    if (!message) {
      messageEl.textContent = '';
      messageEl.classList.add('hidden');
      return;
    }

    messageEl.textContent = message;
    messageEl.classList.remove('hidden');
    if (variant === 'error') {
      messageEl.style.background = 'rgba(244, 63, 94, 0.15)';
      messageEl.style.color = '#f43f5e';
      messageEl.style.border = '1px solid rgba(244, 63, 94, 0.25)';
    } else if (variant === 'success') {
      messageEl.style.background = 'rgba(16, 185, 129, 0.15)';
      messageEl.style.color = '#10b981';
      messageEl.style.border = '1px solid rgba(16, 185, 129, 0.25)';
    } else {
      messageEl.style.background = 'rgba(99, 102, 241, 0.12)';
      messageEl.style.color = 'var(--text-main)';
      messageEl.style.border = '1px solid rgba(99, 102, 241, 0.2)';
    }
  }

  function showAuthModal() {
    document.getElementById('auth-modal')?.classList.remove('hidden');
  }

  function hideAuthModal() {
    document.getElementById('auth-modal')?.classList.add('hidden');
    setAuthMessage('');
  }

  async function handleEmailAuth(email) {
    if (!window.supabase?.auth) {
      setAuthMessage('Supabase auth is not available yet.', 'error');
      return;
    }

    const { error } = await window.supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: getAuthRedirectUrl() }
    });

    if (error) {
      setAuthMessage(error.message || 'Unable to send the sign-in link.', 'error');
      return;
    }

    setAuthMessage(`Magic link sent to ${email}. Check your inbox and come back here.`, 'success');
  }

  async function handleGoogleAuth() {
    if (!window.supabase?.auth) {
      setAuthMessage('Supabase auth is not available yet.', 'error');
      return;
    }

    const { data, error } = await window.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthRedirectUrl() }
    });

    if (error) {
      setAuthMessage(error.message || 'Unable to start Google sign-in.', 'error');
      return;
    }

    if (data?.url) {
      window.location.href = data.url;
    } else {
      setAuthMessage('Google sign-in started. Complete the prompt in the browser window.', 'success');
    }
  }

  function bindAuthModalEvents() {
    const form = document.getElementById('auth-email-form');
    const emailInput = document.getElementById('auth-email');
    const googleBtn = document.getElementById('auth-google-btn');
    const skipBtn = document.getElementById('auth-skip-btn');

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = emailInput?.value?.trim() || '';
      if (!email) {
        setAuthMessage('Please enter your email address.', 'error');
        return;
      }
      await handleEmailAuth(email);
    });

    googleBtn?.addEventListener('click', () => handleGoogleAuth());
    skipBtn?.addEventListener('click', () => {
      hideAuthModal();
      state.setUserName('Guest User');
      updateUserIdentityUI('Guest User');
    });
  }

  /* --------------------------------------------------------------------------
     3. CHART.JS ENGINE WRAPPERS
     -------------------------------------------------------------------------- */
  let categoryChartInstance = null;
  let trendChartInstance = null;

  function renderCategoryChart(canvasId, actualByCategory, currencyCode = 'USD') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;
    if (categoryChartInstance) categoryChartInstance.destroy();

    const categories = Object.keys(actualByCategory);
    const dataValues = categories.map(c => actualByCategory[c]);
    const backgroundColors = categories.map(c => CATEGORY_META[c]?.color || '#9ca3af');

    categoryChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{ data: dataValues, backgroundColor: backgroundColors, borderWidth: 2, borderColor: '#0f1422', hoverOffset: 6 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 12 }, usePointStyle: true } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw, currencyCode)}` } }
        },
        cutout: '72%'
      }
    });
  }

  function renderTrendChart(canvasId, transactions, currencyCode = 'USD') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;
    if (trendChartInstance) trendChartInstance.destroy();

    const dateMap = {};
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedTxs.forEach(t => {
      if (!t.date) return;
      const formattedDate = formatDate(t.date);
      if (!dateMap[formattedDate]) {
        dateMap[formattedDate] = { income: 0, expense: 0 };
      }
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') {
        dateMap[formattedDate].income += amt;
      } else {
        dateMap[formattedDate].expense += amt;
      }
    });

    const labels = Object.keys(dateMap);
    const incomeData = labels.map(d => dateMap[d].income);
    const expenseData = labels.map(d => dateMap[d].expense);

    trendChartInstance = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [
          { label: 'Income', data: incomeData.length ? incomeData : [0], backgroundColor: 'rgba(16, 185, 129, 0.85)', borderRadius: 6 },
          { label: 'Expenses', data: expenseData.length ? expenseData : [0], backgroundColor: 'rgba(244, 63, 94, 0.85)', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 12 }, usePointStyle: true } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw, currencyCode)}` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', callback: (v) => formatCurrency(v, currencyCode).split('.')[0] } }
        }
      }
    });
  }

  /* --------------------------------------------------------------------------
     4. VIEWS
     -------------------------------------------------------------------------- */
  function renderDashboardView(container) {
    const currency = state.getCurrency();
    const totals = state.getTotals();
    const recentTxs = state.getTransactions().slice(0, 5);

    container.innerHTML = `
      <div class="grid-4">
        <div class="glass-card kpi-card" style="--kpi-glow: rgba(99, 102, 241, 0.2);">
          <div class="kpi-info">
            <label>Total Balance</label>
            <div class="kpi-value">${formatCurrency(totals.netSavings, currency)}</div>
            <div class="kpi-trend positive"><i data-lucide="trending-up"></i><span>+${totals.savingsRate.toFixed(1)}% savings rate</span></div>
          </div>
          <div class="kpi-icon-box" style="background: linear-gradient(135deg, #6366f1, #4f46e5);"><i data-lucide="wallet"></i></div>
        </div>
        <div class="glass-card kpi-card" style="--kpi-glow: rgba(16, 185, 129, 0.2);">
          <div class="kpi-info">
            <label>Monthly Income</label>
            <div class="kpi-value text-emerald">${formatCurrency(totals.totalIncome, currency)}</div>
            <div class="kpi-trend positive"><i data-lucide="arrow-up-right"></i><span>2 Income streams</span></div>
          </div>
          <div class="kpi-icon-box" style="background: linear-gradient(135deg, #10b981, #059669);"><i data-lucide="arrow-down-left"></i></div>
        </div>
        <div class="glass-card kpi-card" style="--kpi-glow: rgba(244, 63, 94, 0.2);">
          <div class="kpi-info">
            <label>Total Spent</label>
            <div class="kpi-value text-rose">${formatCurrency(totals.totalExpenses, currency)}</div>
            <div class="kpi-trend negative"><i data-lucide="arrow-down-right"></i><span>${Object.keys(totals.actualByCategory).length} Categories</span></div>
          </div>
          <div class="kpi-icon-box" style="background: linear-gradient(135deg, #f43f5e, #e11d48);"><i data-lucide="credit-card"></i></div>
        </div>
        <div class="glass-card kpi-card" style="--kpi-glow: rgba(6, 182, 212, 0.2);">
          <div class="kpi-info">
            <label>AI Health Score</label>
            <div class="kpi-value text-cyan">${totals.healthScore} <span style="font-size: 0.9rem; font-weight: 500;">/ 100</span></div>
            <div class="kpi-trend neutral"><i data-lucide="sparkles"></i><span>Optimal trajectory</span></div>
          </div>
          <div class="kpi-icon-box" style="background: linear-gradient(135deg, #06b6d4, #0891b2);"><i data-lucide="activity"></i></div>
        </div>
      </div>

      <div class="ai-insight-banner">
        <div class="banner-ai-avatar"><i data-lucide="bot"></i></div>
        <div class="banner-content">
          <h4>BudgetBot AI Insight & Forecast</h4>
          <button id="dash-ai-cta" class="btn btn-accent btn-glow" type="button" style="margin-top: 0.6rem;">
            <i data-lucide="sparkles"></i>
            <span>🚀 Start Saving with AI</span>
          </button>
        </div>
      </div>

      <div class="grid-2">
        <div class="glass-card">
          <div class="chart-header"><div class="chart-title-wrap"><h3>Income vs Expense Cash Flow</h3><p>Bi-weekly financial trajectory</p></div></div>
          <div class="chart-body"><canvas id="trendChartCanvas"></canvas></div>
        </div>
        <div class="glass-card">
          <div class="chart-header"><div class="chart-title-wrap"><h3>Expense Breakdown</h3><p>Spending distribution by category</p></div></div>
          <div class="chart-body"><canvas id="categoryChartCanvas"></canvas></div>
        </div>
      </div>

      <div class="glass-card">
        <div class="chart-header">
          <div class="chart-title-wrap"><h3>Recent Activity Feed</h3><p>Latest logged transactions</p></div>
          <button id="dash-view-all-tx" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.85rem;">View All Transactions</button>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead><tr><th>Description</th><th>Category</th><th>Date</th><th>Payment Method</th><th>Amount</th></tr></thead>
            <tbody>
              ${recentTxs.map(t => {
                const meta = CATEGORY_META[t.category] || CATEGORY_META['Miscellaneous'];
                return `
                  <tr>
                    <td>
                      <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 36px; height: 36px; border-radius: 10px; background: ${meta.bg}; color: ${meta.color}; display: flex; align-items: center; justify-content: center;">
                          <i data-lucide="${meta.icon}" style="width: 18px; height: 18px;"></i>
                        </div>
                        <span style="font-weight: 600;">${t.title}</span>
                      </div>
                    </td>
                    <td><span class="category-tag"><span style="width: 8px; height: 8px; border-radius: 50%; background: ${meta.color};"></span>${t.category}</span></td>
                    <td class="text-muted">${formatDate(t.date)}</td>
                    <td class="text-muted">${t.paymentMethod}</td>
                    <td class="${t.type === 'income' ? 'tx-amount income' : 'tx-amount expense'}">
                      ${t.type === 'income' ? '+' : '-'}${formatCurrency(getTxConvertedAmount(t, currency), currency)}
                      ${t.currency && t.currency !== currency ? `<div class="text-muted" style="font-size: 0.72rem; font-weight: 500;">(${CURRENCIES[t.currency]?.symbol || ''}${t.amount} ${t.currency})</div>` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    setTimeout(() => {
      renderCategoryChart('categoryChartCanvas', totals.actualByCategory, currency);
      renderTrendChart('trendChartCanvas', state.getTransactions(), currency);
      if (window.lucide) window.lucide.createIcons();
    }, 50);

    document.getElementById('dash-view-all-tx')?.addEventListener('click', () => {
      document.querySelector('.nav-item[data-view="expenses"]')?.click();
    });

    document.getElementById('dash-ai-cta')?.addEventListener('click', () => {
      document.querySelector('.nav-item[data-view="budgetbot"]')?.click();
    });
  }

  function renderTransactionsView(container, openEditModal, onDataChange, options = {}) {
    const currency = state.getCurrency();
    const filterType = options.filterType || 'ALL';
    const title = options.title || 'Transaction Ledger';
    const subtitle = options.subtitle || 'Search, filter, and manage your full financial records';
    const emptyMessage = options.emptyMessage || 'No transactions found matching criteria.';
    let filteredTransactions = [];

    container.innerHTML = `
      <div class="glass-card mb-3">
        <div class="chart-header" style="flex-wrap: wrap; gap: 1rem;">
          <div class="chart-title-wrap"><h3>${title}</h3><p>${subtitle}</p></div>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
            <div class="input-with-prefix" style="width: 220px;">
              <i data-lucide="search" class="currency-symbol-prefix" style="left: 0.75rem; width: 16px; height: 16px;"></i>
              <input type="text" id="tx-search-input" class="custom-input" placeholder="Search transactions..." style="padding-left: 2.2rem;">
            </div>
            <select id="tx-filter-category" class="custom-select">
              <option value="ALL">All Categories</option>
              <option value="Food & Dining">Food & Dining</option>
              <option value="Transportation">Transportation</option>
              <option value="Housing & Utilities">Housing & Utilities</option>
              <option value="Shopping & Tech">Shopping & Tech</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Health & Fitness">Health & Fitness</option>
              <option value="Subscriptions">Subscriptions</option>
              <option value="Income">Income</option>
            </select>
            <select id="tx-filter-type" class="custom-select" ${filterType !== 'ALL' ? 'disabled' : ''}>
              <option value="ALL">All Types</option>
              <option value="expense">Expenses Only</option>
              <option value="income">Income Only</option>
            </select>
            <button id="tx-export-csv" class="btn btn-secondary"><i data-lucide="download"></i><span>Export CSV</span></button>
          </div>
        </div>
        <div class="table-responsive" style="margin-top: 1rem;">
          <table class="custom-table">
            <thead><tr><th>Description</th><th>Category</th><th>Date</th><th>Payment Method</th><th>Recurring</th><th>Amount</th><th style="text-align: right;">Actions</th></tr></thead>
            <tbody id="tx-table-body"></tbody>
          </table>
        </div>
      </div>
    `;

    function populateTable() {
      const tbody = document.getElementById('tx-table-body');
      if (!tbody) return;

      const query = (document.getElementById('tx-search-input')?.value || '').toLowerCase();
      const selectedCat = document.getElementById('tx-filter-category')?.value || 'ALL';
      const selectedType = filterType !== 'ALL' ? filterType : (document.getElementById('tx-filter-type')?.value || 'ALL');

      let transactions = state.getTransactions();
      if (query) transactions = transactions.filter(t => t.title.toLowerCase().includes(query) || t.paymentMethod.toLowerCase().includes(query));
      if (selectedCat !== 'ALL') transactions = transactions.filter(t => t.category === selectedCat);
      if (selectedType !== 'ALL') transactions = transactions.filter(t => t.type === selectedType);

      filteredTransactions = transactions;
      if (transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);"><i data-lucide="inbox" style="width: 40px; height: 40px; margin-bottom: 0.5rem; opacity: 0.5;"></i><p>${emptyMessage}</p></td></tr>`;
        if (window.lucide) window.lucide.createIcons();
        return;
      }

      tbody.innerHTML = transactions.map(t => {
        const meta = CATEGORY_META[t.category] || CATEGORY_META['Miscellaneous'];
        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="width: 36px; height: 36px; border-radius: 10px; background: ${meta.bg}; color: ${meta.color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <i data-lucide="${meta.icon}" style="width: 18px; height: 18px;"></i>
                </div>
                <span style="font-weight: 600;">${t.title}</span>
              </div>
            </td>
            <td><span class="category-tag"><span style="width: 8px; height: 8px; border-radius: 50%; background: ${meta.color};"></span>${t.category}</span></td>
            <td class="text-muted">${formatDate(t.date)}</td>
            <td class="text-muted">${t.paymentMethod}</td>
            <td>${t.recurring && t.recurring !== 'false' ? `<span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-cyan); background: rgba(6, 182, 212, 0.1); padding: 2px 8px; border-radius: 10px;">${t.recurring}</span>` : `<span class="text-muted" style="font-size: 0.8rem;">Single</span>`}</td>
            <td class="${t.type === 'income' ? 'tx-amount income' : 'tx-amount expense'}">
              ${t.type === 'income' ? '+' : '-'}${formatCurrency(getTxConvertedAmount(t, currency), currency)}
              ${t.currency && t.currency !== currency ? `<div class="text-muted" style="font-size: 0.72rem; font-weight: 500;">(${CURRENCIES[t.currency]?.symbol || ''}${t.amount} ${t.currency})</div>` : ''}
            </td>
            <td style="text-align: right;">
              <div style="display: flex; gap: 0.4rem; justify-content: flex-end;">
                <button class="btn-icon-sm edit-tx-btn" data-id="${t.id}" title="Edit Transaction" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); cursor: pointer;"><i data-lucide="edit-3" style="width: 14px; height: 14px;"></i></button>
                <button class="btn-icon-sm delete-tx-btn" data-id="${t.id}" title="Delete Transaction" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(244, 63, 94, 0.3); background: rgba(244, 63, 94, 0.1); color: var(--accent-rose); cursor: pointer;"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      if (window.lucide) window.lucide.createIcons();

      tbody.querySelectorAll('.edit-tx-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const tx = state.getTransactions().find(t => t.id === id);
          if (tx && openEditModal) openEditModal(tx);
        });
      });
      tbody.querySelectorAll('.delete-tx-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          if (confirm('Delete this transaction record?')) {
            state.deleteTransaction(id);
            populateTable();
            if (onDataChange) onDataChange();
          }
        });
      });
    }

    setTimeout(() => {
      const typeSelect = document.getElementById('tx-filter-type');
      if (typeSelect) typeSelect.value = filterType;
      populateTable();
      if (window.lucide) window.lucide.createIcons();
    }, 50);

    document.getElementById('tx-search-input')?.addEventListener('input', populateTable);
    document.getElementById('tx-filter-category')?.addEventListener('change', populateTable);
    document.getElementById('tx-filter-type')?.addEventListener('change', populateTable);
    document.getElementById('tx-export-csv')?.addEventListener('click', () => exportTransactionsToCSV(filteredTransactions, currency));
  }

  function renderIncomeView(container, openEditModal, onDataChange) {
    renderTransactionsView(container, openEditModal, onDataChange, {
      filterType: 'income',
      title: 'Income Overview',
      subtitle: 'Review every income entry for your account',
      emptyMessage: 'No income transactions found.'
    });
  }

  function renderExpensesView(container, openEditModal, onDataChange) {
    renderTransactionsView(container, openEditModal, onDataChange, {
      filterType: 'expense',
      title: 'Expenses Overview',
      subtitle: 'Review all recorded expenses and spending trends',
      emptyMessage: 'No expense transactions found.'
    });
  }

  function renderAiCoachView(container) {
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
              <h3 style="font-size: 1.1rem; font-weight: 700;">BudgetBot — AI Financial Advisor</h3>
              <p class="text-muted" style="font-size: 0.8rem;">Powered by real-time budget analytics & voice intelligence</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <button id="ai-voice-toggle" class="btn btn-secondary voice-toggle-btn active" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;" title="Toggle AI Speech Voice Response">
              <i data-lucide="volume-2" style="width: 14px; height: 14px;"></i>
              <span id="voice-toggle-label">Voice: ON</span>
            </button>
            <button id="ai-clear-chat" class="btn btn-secondary" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">Clear History</button>
          </div>
        </div>
        <div id="ai-chat-history" class="chat-history"></div>
        <div class="prompt-pills">
          <button class="pill-btn" data-prompt="Salary ${sym}5000 credited">💼 Salary ${sym}5000 (Income Credited)</button>
          <button class="pill-btn" data-prompt="Add ${sym}250 for college fees">🎓 College fees ${sym}250 (Education)</button>
          <button class="pill-btn" data-prompt="Add ${sym}35 for Biryani, curry & vegetables">🍗 Biryani & Curry ${sym}35 (Food)</button>
          <button class="pill-btn" data-prompt="Predict my future expenses for next month">🔮 Predict future expenses</button>
          <button class="pill-btn" data-prompt="Display my balance amount">💰 Display balance amount</button>
        </div>
        <form id="ai-chat-form" class="chat-input-bar" style="flex-direction: column; gap: 0;">
          <div style="display: flex; gap: 0.75rem; width: 100%;">
            <div style="position: relative; flex: 1;">
              <input type="text" id="ai-chat-input" class="custom-input" placeholder="Ask BudgetBot anything or tap mic to speak..." autocomplete="off" required style="padding-right: 2.8rem;">
              <button type="button" id="ai-mic-btn" class="mic-input-btn" title="Click to Speak (Voice Input)">
                <i data-lucide="mic" style="width: 16px; height: 16px;"></i>
              </button>
            </div>
            <button type="submit" class="btn btn-accent btn-glow"><i data-lucide="send"></i><span>Ask BudgetBot</span></button>
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
        .replace(/<[^>]+>/g, ' ')
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
      if (preferredVoice) utterance.voice = preferredVoice;

      window.speechSynthesis.speak(utterance);
    }

    function renderHistory() {
      const historyContainer = document.getElementById('ai-chat-history');
      if (!historyContainer) return;
      historyContainer.innerHTML = state.getAiChatHistory().map(m => {
        if (m.sender === 'user') return `<div class="chat-bubble user">${m.text}</div>`;
        const cleanMsg = cleanMarkdownForSpeech(m.text).replace(/"/g, '&quot;');
        return `<div class="chat-bubble ai"><div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.4rem;"><span class="ai-name" style="margin-bottom: 0;"><i data-lucide="sparkles" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;"></i> BudgetBot AI</span><button class="speak-bubble-btn" data-speech="${cleanMsg}" title="Read message aloud"><i data-lucide="volume-2" style="width: 14px; height: 14px;"></i></button></div>${m.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>`;
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

    function extractAmountFromText(userText) {
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

    function parseAndAddTxFromText(userText) {
      const text = userText.toLowerCase();
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
      else if (text.includes('cad')) txCurrency = 'CAD';
      else if (text.includes('aud')) txCurrency = 'AUD';
      else if (text.includes('aed')) txCurrency = 'AED';
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
      } else if (text.includes('transport') || text.includes('uber') || text.includes('gas') || text.includes('fuel') || text.includes('taxi') || text.includes('bus') || text.includes('car') || text.includes('flight')) {
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
      if (window.app && window.app.updateSidebarHealth) {
        window.app.updateSidebarHealth();
      }

      const curr = state.getCurrency();
      const displayAmt = formatCurrency(getTxConvertedAmount(tx, curr), curr);
      const origNote = tx.currency !== curr ? ` (${CURRENCIES[tx.currency]?.symbol || ''}${tx.amount} ${tx.currency})` : '';

      if (hasSalary) {
        return `Successfully added **${displayAmt}**${origNote} to **Income** as **Salary Credited**!`;
      } else if (isCredit) {
        return `Successfully processed **Credit**: Added **${displayAmt}**${origNote} to your account balance for **"${title}"** under **${category}**!`;
      } else if (isDebit) {
        return `Successfully processed **Debit**: Transferred/Removed **${displayAmt}**${origNote} from your bank account for **"${title}"** under **${category}**!`;
      }

      return `Successfully added **${type === 'income' ? 'Income' : 'Expense'}** of **${displayAmt}**${origNote} for **"${title}"** under **${category}** to your transactions ledger!`;
    }

    function buildStarterTableReply() {
      return `
        <div class="ai-form-card">
          <div class="ai-form-card-title">Quick financial intake</div>
          <table class="ai-form-table">
            <tbody>
              <tr><th>Field</th><th>Details</th></tr>
              <tr><td>Income</td><td>Tell me your income amount</td></tr>
              <tr><td>Expenditure</td><td>Tell me your spending amount</td></tr>
              <tr><td>Sector</td><td>Tell me the category or sector</td></tr>
            </tbody>
          </table>
        </div>
      `;
    }

    function looksLikeGreeting(userText) {
      const text = userText.toLowerCase().trim();
      const cleanText = text.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      const words = cleanText.split(' ').filter(Boolean);

      if (!cleanText) return false;

      const greetingTokens = ['hi', 'hii', 'hey', 'hello', 'helo', 'hallo', 'heyy', 'yo', 'hola', 'namaste', 'greetings', 'sup'];
      const conversationalPatterns = ['good morning', 'good afternoon', 'good evening', 'good day', 'whats up', 'what is up', 'how are you', 'how you doing', 'how are you doing', 'thanks', 'thank you', 'thanku'];

      if (conversationalPatterns.some(pattern => cleanText.includes(pattern))) return true;
      if (words.length <= 4 && (greetingTokens.some(token => words.includes(token)) || words.some(word => ['hi', 'hii', 'hey', 'hello', 'helo', 'hallo', 'heyy'].includes(word) || word.startsWith('hi') || word.startsWith('hel') || word.startsWith('hey')))) return true;

      return false;
    }

    function generateAiResponse(userText) {
      const text = userText.toLowerCase().trim();
      const totals = state.getTotals();
      const curr = state.getCurrency();

      if (looksLikeGreeting(userText)) {
        return `Hi! I can help you manage your money better. ${buildStarterTableReply()}`;
      }

      if (text.includes('balance') || text.includes('remaining amount') || text.includes('how much balance') || text.includes('show balance') || text.includes('display balance')) {
        const remainingAmount = totals.netSavings;
        const formattedRemaining = formatCurrency(remainingAmount, curr);
        return `💰 **Account Balance Summary**:

Balance Amount : ${formattedRemaining}

*(Total Income: ${formatCurrency(totals.totalIncome, curr)} | Total Expenses: ${formatCurrency(totals.totalExpenses, curr)})*`;
      }

      // 3. Predict Future Expenses
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

      // Check for Credit / Debit definition or rule queries
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
        if (amount <= remaining * 0.7) return `Yes, you can afford a **${formatCurrency(amount, curr)}** purchase! You currently have a net monthly surplus of **${formatCurrency(remaining, curr)}**.`;
        return `Caution advised: A **${formatCurrency(amount, curr)}** purchase consumes **${((amount / Math.max(1, remaining)) * 100).toFixed(0)}%** of remaining monthly surplus (**${formatCurrency(remaining, curr)}**).`;
      }
      if (text.includes('overspend') || text.includes('where')) {
        let topCategory = 'Food & Dining', topAmount = 0;
        for (const cat in totals.actualByCategory) {
          if (totals.actualByCategory[cat] > topAmount) { topAmount = totals.actualByCategory[cat]; topCategory = cat; }
        }
        return `Your highest spending category is **${topCategory}** at **${formatCurrency(topAmount, curr)}** (**${((topAmount / totals.totalExpenses) * 100).toFixed(0)}%** of total expenses).`;
      }
      if (text.includes('save') || text.includes('increase')) {
        return `To boost savings by 15%: 1) Reduce Dining Out by $120. 2) Cancel unused magazine subscription. 3) Automate emergency fund transfers.`;
      }
      if (text.includes('subscription') || text.includes('audit')) {
        const activeSubs = state.getSubscriptions().filter(s => s.status === 'Active');
        const cost = activeSubs.reduce((a, s) => a + s.amount, 0);
        return `You have **${activeSubs.length} active subscriptions** costing **${formatCurrency(cost, curr)}/month**. Cancelling "Unused Magazine App" saves **${formatCurrency(179.88, curr)} annually**!`;
      }
      return `I analyzed *"${userText}"*. Financial health score: **${totals.healthScore}/100**. Net savings: **${formatCurrency(totals.netSavings, curr)}**.`;
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

    function handleSendMessage(userMsg) {
      clearAutoSendTimer();
      micStatus?.classList.add('hidden');
      if (!userMsg.trim()) return;

      if (window.speechSynthesis) window.speechSynthesis.cancel();
      state.addAiChatMessage('user', userMsg);
      renderHistory();
      setTimeout(() => {
        const aiReply = generateAiResponse(userMsg);
        state.addAiChatMessage('ai', aiReply);
        renderHistory();
        if (voiceOutputEnabled) {
          speakText(aiReply);
        }
      }, 500);
    }

    setTimeout(() => { renderHistory(); if (window.lucide) window.lucide.createIcons(); }, 50);

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
      const txt = input.value;
      input.value = '';
      handleSendMessage(txt);
    });

    input?.addEventListener('input', () => {
      clearAutoSendTimer();
      micStatus?.classList.add('hidden');
    });

    document.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        clearAutoSendTimer();
        handleSendMessage(btn.getAttribute('data-prompt'));
      });
    });

    document.getElementById('ai-clear-chat')?.addEventListener('click', () => {
      clearAutoSendTimer();
      micStatus?.classList.add('hidden');
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      state.data.aiChatHistory = [];
      state.saveState();
      renderHistory();
    });

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

  function renderBudgetsView(container, openGoalModal, onDataChange) {
    const currency = state.getCurrency();
    const totals = state.getTotals();
    const limits = state.getBudgetLimits();
    const goals = state.getSavingsGoals();

    container.innerHTML = `
      <div class="glass-card mb-3">
        <div class="chart-header"><div class="chart-title-wrap"><h3>Category Spending Limits</h3><p>Real-time budget tracking against monthly thresholds</p></div></div>
        <div class="grid-2-equal" style="margin-bottom: 0;">
          ${Object.keys(limits).map(category => {
            const limit = limits[category];
            const actual = totals.actualByCategory[category] || 0;
            const percentage = Math.min(100, Math.round((actual / limit) * 100));
            const meta = CATEGORY_META[category] || CATEGORY_META['Miscellaneous'];

            let statusClass = 'text-emerald', barBg = 'linear-gradient(90deg, #10b981, #059669)', statusText = 'Safe';
            if (percentage >= 100) { statusClass = 'text-rose'; barBg = 'linear-gradient(90deg, #f43f5e, #e11d48)'; statusText = 'Exceeded'; }
            else if (percentage >= 75) { statusClass = 'text-amber'; barBg = 'linear-gradient(90deg, #f59e0b, #d97706)'; statusText = 'Warning'; }

            return `
              <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                  <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <div style="width: 34px; height: 34px; border-radius: 8px; background: ${meta.bg}; color: ${meta.color}; display: flex; align-items: center; justify-content: center;"><i data-lucide="${meta.icon}" style="width: 18px; height: 18px;"></i></div>
                    <div><h4 style="font-size: 0.95rem; font-weight: 700;">${category}</h4><span style="font-size: 0.75rem;" class="${statusClass}">${statusText} (${percentage}%)</span></div>
                  </div>
                  <div style="text-align: right;"><div style="font-weight: 800; font-size: 1.05rem;">${formatCurrency(actual, currency)}</div><div class="text-muted" style="font-size: 0.75rem;">Limit: ${formatCurrency(limit, currency)}</div></div>
                </div>
                <div class="health-bar-track" style="height: 8px; margin-bottom: 0.75rem;"><div class="health-bar-fill" style="width: ${percentage}%; background: ${barBg};"></div></div>
                <div style="display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem;"><span class="text-muted" style="font-size: 0.75rem;">Edit Cap:</span><input type="number" class="custom-input budget-limit-input" data-category="${category}" value="${limit}" style="width: 90px; padding: 0.2rem 0.5rem; font-size: 0.78rem;"></div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="glass-card">
        <div class="chart-header"><div class="chart-title-wrap"><h3>Savings Goals & Milestones</h3><p>Track targets and celebrate financial wins</p></div></div>
        <div class="grid-4" style="margin-bottom: 0;">
          ${goals.map(goal => {
            const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
            return `
              <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                    <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(99, 102, 241, 0.15); color: ${goal.color}; display: flex; align-items: center; justify-content: center;"><i data-lucide="${goal.icon}" style="width: 20px; height: 20px;"></i></div>
                    <span style="font-size: 0.75rem; font-weight: 700; color: ${goal.color}; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 12px;">${pct}%</span>
                  </div>
                  <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.25rem;">${goal.title}</h4>
                  <p class="text-muted" style="font-size: 0.78rem; margin-bottom: 1rem;">Target: ${goal.targetDate}</p>
                  <div style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.2rem;">${formatCurrency(goal.currentAmount, currency)}</div>
                  <div class="text-muted" style="font-size: 0.78rem; margin-bottom: 0.75rem;">Goal: ${formatCurrency(goal.targetAmount, currency)}</div>
                  <div class="health-bar-track" style="height: 8px; margin-bottom: 1rem;"><div class="health-bar-fill" style="width: ${pct}%; background: linear-gradient(90deg, ${goal.color}, var(--accent-cyan));"></div></div>
                </div>
                <button class="btn btn-accent deposit-goal-btn" data-id="${goal.id}" style="width: 100%; font-size: 0.8rem; padding: 0.5rem;"><i data-lucide="plus-circle"></i><span>Add Funds</span></button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);

    document.querySelectorAll('.budget-limit-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (val > 0) {
          state.setBudgetLimit(e.target.getAttribute('data-category'), val);
          renderBudgetsView(container, openGoalModal, onDataChange);
          if (onDataChange) onDataChange();
        }
      });
    });

    document.querySelectorAll('.deposit-goal-btn').forEach(btn => {
      btn.addEventListener('click', () => { if (openGoalModal) openGoalModal(btn.getAttribute('data-id')); });
    });
  }

  function renderSubscriptionsView(container) {
    const currency = state.getCurrency();
    const subs = state.getSubscriptions();
    const activeSubs = subs.filter(s => s.status === 'Active');
    const monthlyTotal = activeSubs.reduce((acc, s) => acc + s.amount, 0);

    container.innerHTML = `
      <div class="grid-2 mb-3">
        <div class="glass-card" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.1));">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <label class="text-muted" style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase;">Active Monthly Subscriptions</label>
              <div style="font-family: 'Outfit', sans-serif; font-size: 2.2rem; font-weight: 800; color: var(--accent-cyan);">${formatCurrency(monthlyTotal, currency)} <span style="font-size: 0.9rem; color: var(--text-muted);">/ month</span></div>
              <p class="text-muted" style="font-size: 0.82rem; margin-top: 0.25rem;">Projected annual spend: <strong>${formatCurrency(monthlyTotal * 12, currency)}</strong></p>
            </div>
            <div class="kpi-icon-box" style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--accent-cyan), var(--primary));"><i data-lucide="repeat" style="width: 28px; height: 28px;"></i></div>
          </div>
        </div>
        <div class="ai-insight-banner" style="margin-bottom: 0;">
          <div class="banner-ai-avatar"><i data-lucide="scissors"></i></div>
          <div class="banner-content"><h4 style="color: var(--accent-amber);">AI Subscription Auditor</h4><p>Deactivating "Unused Magazine App" ($14.99/mo) boosts annual savings by <strong>${formatCurrency(179.88, currency)}</strong>.</p></div>
        </div>
      </div>
      <div class="glass-card">
        <div class="chart-header"><div class="chart-title-wrap"><h3>Recurring Subscriptions Ledger</h3><p>Toggle or audit recurring payments</p></div></div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead><tr><th>Service Name</th><th>Category</th><th>Billing Cycle</th><th>Next Renewal</th><th>Cost</th><th>Audit Status</th><th style="text-align: right;">Action</th></tr></thead>
            <tbody>
              ${subs.map(s => {
                const isActive = s.status === 'Active';
                return `
                  <tr>
                    <td><div style="display: flex; align-items: center; gap: 0.75rem;"><div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(99, 102, 241, 0.15); color: var(--primary); display: flex; align-items: center; justify-content: center;"><i data-lucide="repeat" style="width: 18px; height: 18px;"></i></div><span style="font-weight: 600;">${s.name}</span></div></td>
                    <td class="text-muted">${s.category}</td>
                    <td><span class="category-tag">${s.billingCycle}</span></td>
                    <td class="text-muted">${s.nextBillDate}</td>
                    <td style="font-weight: 700;">${formatCurrency(s.amount, currency)}</td>
                    <td><span style="font-size: 0.75rem; font-weight: 700; padding: 3px 10px; border-radius: 12px; ${isActive ? 'background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald);' : s.status === 'Under Review' ? 'background: rgba(245, 158, 11, 0.15); color: var(--accent-amber);' : 'background: rgba(244, 63, 94, 0.15); color: var(--accent-rose);'}">${s.status}</span></td>
                    <td style="text-align: right;"><button class="btn ${isActive ? 'btn-secondary' : 'btn-accent'} toggle-sub-btn" data-id="${s.id}" style="font-size: 0.78rem; padding: 0.35rem 0.75rem;">${isActive ? 'Cancel / Deactivate' : 'Reactivate'}</button></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);

    document.querySelectorAll('.toggle-sub-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.toggleSubscriptionStatus(btn.getAttribute('data-id'));
        renderSubscriptionsView(container);
      });
    });
  }

  function renderScannerView(container, onDataChange) {
    const currency = state.getCurrency();
    const currSymbol = CURRENCIES[currency]?.symbol || '$';
    const SAMPLE_RECEIPTS = [
      { id: 'rec-1', merchant: 'Whole Foods Market', amount: 142.85, category: 'Food & Dining', date: '2026-07-24', paymentMethod: 'Apple Pay / Wallet', items: ['Organic Almond Milk - $4.99', 'Wild Caught Salmon - $24.50', 'Fresh Avocados - $6.99'] },
      { id: 'rec-2', merchant: 'Apple Store 5th Ave', amount: 129.00, category: 'Shopping & Tech', date: '2026-07-23', paymentMethod: 'Credit Card', items: ['MagSafe Battery Pack - $99.00', 'USB-C Cable - $29.00'] },
      { id: 'rec-3', merchant: 'Starbucks Reserve', amount: 18.75, category: 'Food & Dining', date: '2026-07-24', paymentMethod: 'Debit Card', items: ['Oat Milk Latte - $7.50', 'Iced Americano - $5.25', 'Croissant - $6.00'] },
      { id: 'rec-4', merchant: 'Shell Energy Station', amount: 55.40, category: 'Transportation', date: '2026-07-22', paymentMethod: 'Credit Card', items: ['Fuel (12.4 Gal) - $55.40'] }
    ];

    container.innerHTML = `
      <div class="grid-2">
        <div class="glass-card">
          <div class="chart-header"><div class="chart-title-wrap"><h3>AI Receipt OCR Scanner</h3><p>Scan receipts to auto-extract merchant, total, date, and category</p></div></div>
          <div id="scanner-dropzone" class="scanner-dropzone">
            <div class="laser-line" id="laser-line"></div>
            <div id="dropzone-idle">
              <div class="logo-icon-wrap" style="width: 56px; height: 56px; margin: 0 auto 1rem; background: linear-gradient(135deg, var(--accent-cyan), var(--primary));"><i data-lucide="scan" style="width: 28px; height: 28px;"></i></div>
              <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.4rem;">Drop Receipt Image Here</h4>
              <p class="text-muted" style="font-size: 0.82rem; margin-bottom: 1.25rem;">Supports PNG, JPG, PDF receipt documents</p>
              <button id="browse-file-btn" class="btn btn-secondary" style="font-size: 0.82rem;">Browse Local File</button>
            </div>
            <div id="dropzone-scanning" style="display: none; padding: 2rem 0;">
              <div class="logo-icon-wrap" style="width: 56px; height: 56px; margin: 0 auto 1rem; background: linear-gradient(135deg, var(--accent-cyan), var(--primary)); animation: pulse-glow 1.5s infinite;"><i data-lucide="cpu" style="width: 28px; height: 28px;"></i></div>
              <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 0.4rem;">AI OCR Engine Analyzing...</h4>
              <p class="text-muted" style="font-size: 0.85rem;">Extracting merchant metadata, line items, and taxes...</p>
            </div>
          </div>
          <div style="margin-top: 1.5rem;">
            <label class="text-muted" style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 0.75rem;">Or Select a Demo Receipt to Scan:</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              ${SAMPLE_RECEIPTS.map(r => `
                <button class="pill-btn sample-receipt-btn" data-id="${r.id}" style="text-align: left; padding: 0.6rem 0.85rem; border-radius: var(--radius-md);">
                  <div style="font-weight: 700; font-size: 0.85rem;">${r.merchant}</div>
                  <div class="text-muted" style="font-size: 0.75rem;">${formatCurrency(r.amount, currency)} • ${r.category}</div>
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="glass-card">
          <div class="chart-header"><div class="chart-title-wrap"><h3>Extracted Data Verification</h3><p>Review AI-extracted fields before confirming to ledger</p></div></div>
          <div id="ocr-results-empty" style="text-align: center; padding: 4rem 1rem; color: var(--text-muted);"><i data-lucide="file-text" style="width: 44px; height: 44px; margin-bottom: 0.75rem; opacity: 0.4;"></i><p>Select or upload a receipt to trigger AI extraction.</p></div>
          <form id="ocr-confirm-form" class="modal-body" style="display: none; padding: 0;">
            <div class="ai-insight-banner" style="margin-bottom: 1rem; padding: 0.85rem 1rem;"><i data-lucide="check-circle-2" class="text-emerald" style="width: 22px; height: 22px; flex-shrink: 0;"></i><div style="font-size: 0.82rem;"><strong>99.4% OCR Confidence Match!</strong> Extracted line items successfully.</div></div>
            <div class="form-group"><label>Merchant Name</label><input type="text" id="ocr-merchant" class="custom-input" required></div>
            <div class="form-row">
              <div class="form-group">
                <label>Tx Currency</label>
                <select id="ocr-currency" class="custom-input" required>
                  <option value="USD">🇺🇸 USD ($)</option>
                  <option value="EUR">🇪🇺 EUR (€)</option>
                  <option value="GBP">🇬🇧 GBP (£)</option>
                  <option value="INR">🇮🇳 INR (₹)</option>
                  <option value="JPY">🇯🇵 JPY (¥)</option>
                  <option value="CAD">🇨🇦 CAD (CA$)</option>
                  <option value="AUD">🇦🇺 AUD (A$)</option>
                  <option value="CHF">🇨🇭 CHF (CHF)</option>
                  <option value="CNY">🇨🇳 CNY (¥)</option>
                  <option value="AED">🇦🇪 AED (AED)</option>
                  <option value="BRL">🇧🇷 BRL (R$)</option>
                  <option value="SGD">🇸🇬 SGD (S$)</option>
                </select>
              </div>
              <div class="form-group"><label>Amount</label><div class="input-with-prefix"><span class="currency-symbol-prefix" id="ocr-currency-symbol">${currSymbol}</span><input type="number" id="ocr-amount" step="0.01" class="custom-input" required></div></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Category</label><select id="ocr-category" class="custom-input" required><option value="Food & Dining">Food & Dining</option><option value="Transportation">Transportation</option><option value="Housing & Utilities">Housing & Utilities</option><option value="Shopping & Tech">Shopping & Tech</option><option value="Entertainment">Entertainment</option><option value="Health & Fitness">Health & Fitness</option><option value="Subscriptions">Subscriptions</option><option value="Miscellaneous">Miscellaneous</option></select></div>
              <div class="form-group"><label>Date</label><input type="date" id="ocr-date" class="custom-input" required></div>
            </div>
            <div class="form-row">
              <div class="form-group" style="grid-column: span 2;"><label>Payment Method</label><input type="text" id="ocr-payment" class="custom-input" required></div>
            </div>
            <div class="form-group"><label>Line Items Parsed</label><div id="ocr-line-items" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.75rem; font-size: 0.8rem; color: var(--text-muted);"></div></div>
            <button type="submit" class="btn btn-primary btn-glow" style="width: 100%; margin-top: 0.5rem;"><i data-lucide="check"></i><span>Confirm & Add Transaction</span></button>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);

    function triggerScan(sample) {
      const laser = document.getElementById('laser-line');
      const idleView = document.getElementById('dropzone-idle');
      const scanView = document.getElementById('dropzone-scanning');
      const emptyResults = document.getElementById('ocr-results-empty');
      const form = document.getElementById('ocr-confirm-form');

      if (!laser || !idleView || !scanView) return;
      idleView.style.display = 'none';
      scanView.style.display = 'block';
      laser.classList.add('scanning');

      setTimeout(() => {
        laser.classList.remove('scanning');
        scanView.style.display = 'none';
        idleView.style.display = 'block';
        emptyResults.style.display = 'none';
        form.style.display = 'flex';

        document.getElementById('ocr-merchant').value = sample.merchant;
        if (document.getElementById('ocr-currency')) document.getElementById('ocr-currency').value = currency;
        document.getElementById('ocr-amount').value = sample.amount;
        document.getElementById('ocr-category').value = sample.category;
        document.getElementById('ocr-date').value = sample.date;
        document.getElementById('ocr-payment').value = sample.paymentMethod;
        document.getElementById('ocr-line-items').innerHTML = sample.items.map(it => `<div style="padding: 2px 0;">• ${it}</div>`).join('');
        if (window.lucide) window.lucide.createIcons();
      }, 1000);
    }

    document.querySelectorAll('.sample-receipt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sample = SAMPLE_RECEIPTS.find(r => r.id === btn.getAttribute('data-id'));
        if (sample) triggerScan(sample);
      });
    });

    document.getElementById('browse-file-btn')?.addEventListener('click', () => {
      triggerScan(SAMPLE_RECEIPTS[Math.floor(Math.random() * SAMPLE_RECEIPTS.length)]);
    });

    document.getElementById('ocr-currency')?.addEventListener('change', (e) => {
      const selected = e.target.value;
      const sym = document.getElementById('ocr-currency-symbol');
      if (sym) sym.textContent = CURRENCIES[selected]?.symbol || '$';
    });

    document.getElementById('ocr-confirm-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const txCurrency = document.getElementById('ocr-currency')?.value || currency;
      const tx = {
        type: 'expense',
        title: document.getElementById('ocr-merchant').value,
        currency: txCurrency,
        amount: parseFloat(document.getElementById('ocr-amount').value),
        category: document.getElementById('ocr-category').value,
        date: document.getElementById('ocr-date').value,
        paymentMethod: document.getElementById('ocr-payment').value,
        recurring: 'false'
      };
      state.addTransaction(tx);
      alert(`Scanned transaction from "${tx.title}" (${CURRENCIES[txCurrency]?.symbol || ''}${tx.amount} ${txCurrency}) saved successfully!`);
      renderScannerView(container, onDataChange);
      if (onDataChange) onDataChange();
    });
  }

  function renderSettingsView(container, onLogout, onDataChange) {
    if (!container) return;
    const currentUsername = state.getUserName() || 'Guest User';

    container.innerHTML = `
      <div class="settings-view-wrapper" style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 900px; margin: 0 auto; padding-bottom: 2rem;">
        
        <!-- Profile & Status Card -->
        <div class="card glass-card" style="padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div class="user-avatar" style="width: 54px; height: 54px; font-size: 1.3rem; font-weight: 800; background: linear-gradient(135deg, var(--primary), var(--accent-cyan)); box-shadow: 0 0 15px var(--primary-glow);">
              ${currentUsername.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.15rem;">
                ${currentUsername}
              </h2>
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-muted);">
                <span><i data-lucide="shield-check" style="width: 14px; height: 14px; color: var(--accent-emerald); vertical-align: middle;"></i> Account Active</span>
                <span>•</span>
                <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); font-weight: 600;">
                  💾 Local Storage Mode
                </span>
              </div>
            </div>
          </div>
        </div>



        <!-- Password Reset & Security Card -->
        <div class="card glass-card" style="padding: 1.5rem;">
          <div class="chart-header" style="margin-bottom: 1.25rem;">
            <div class="chart-title-wrap">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i data-lucide="lock" style="color: var(--primary); width: 22px; height: 22px;"></i>
                <h3 style="font-size: 1.1rem; font-weight: 700;">Password Reset & Security</h3>
              </div>
              <p class="text-muted" style="font-size: 0.82rem; margin-top: 0.2rem;">
                Reset or change your account password to secure your account.
              </p>
            </div>
          </div>

          <form id="app-pass-reset-form" style="display: flex; flex-direction: column; gap: 1.1rem;">
            <div class="form-group">
              <label for="app-current-pass" style="font-size: 0.82rem; font-weight: 700; color: var(--text-main);">Current Password</label>
              <div class="input-with-prefix">
                <i data-lucide="key-round" class="currency-symbol-prefix" style="left: 0.85rem; width: 18px; height: 18px;"></i>
                <input type="password" id="app-current-pass" class="custom-input" placeholder="Enter current password" required style="padding-left: 2.5rem; font-size: 0.95rem;" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
              <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <label for="app-new-pass" style="font-size: 0.82rem; font-weight: 700; color: var(--text-main);">New Password</label>
                  <button type="button" id="app-toggle-pass-btn" style="background: none; border: none; color: var(--accent-cyan); cursor: pointer; font-size: 0.75rem; font-weight: 600;">Show</button>
                </div>
                <div class="input-with-prefix">
                  <i data-lucide="lock" class="currency-symbol-prefix" style="left: 0.85rem; width: 18px; height: 18px;"></i>
                  <input type="password" id="app-new-pass" class="custom-input" placeholder="Enter new password" required style="padding-left: 2.5rem; font-size: 0.95rem;" />
                </div>
              </div>

              <div class="form-group">
                <label for="app-confirm-pass" style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem; display: block;">Confirm New Password</label>
                <div class="input-with-prefix">
                  <i data-lucide="check-circle-2" class="currency-symbol-prefix" style="left: 0.85rem; width: 18px; height: 18px;"></i>
                  <input type="password" id="app-confirm-pass" class="custom-input" placeholder="Re-enter new password" required style="padding-left: 2.5rem; font-size: 0.95rem;" />
                </div>
              </div>
            </div>

            <!-- Password Requirements Checklist -->
            <div class="password-rules-box" style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.75rem 0.9rem; font-size: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem;">
              <div style="font-weight: 700; color: var(--text-main); margin-bottom: 0.15rem; display: flex; align-items: center; gap: 0.35rem;">
                <i data-lucide="shield" style="width: 13px; height: 13px; color: var(--accent-cyan);"></i> Password Strength Requirements:
              </div>
              <div class="rule-item" id="app-rule-length" style="color: var(--text-muted); font-weight: 500;">❌ At least 8 characters long</div>
              <div class="rule-item" id="app-rule-complexity" style="color: var(--text-muted); font-weight: 500;">❌ Mix of uppercase, lowercase, numbers & symbols (or 5-7 word passphrase)</div>
              <div class="rule-item" id="app-rule-match" style="color: var(--text-muted); font-weight: 500;">❌ New password and Confirm password must match</div>
            </div>

            <!-- Alert Banner -->
            <div id="app-password-alert" class="hidden" style="padding: 0.65rem 0.9rem; border-radius: var(--radius-md); font-size: 0.82rem; font-weight: 600; text-align: center;"></div>

            <div style="display: flex; justify-content: flex-end; margin-top: 0.25rem;">
              <button type="submit" class="btn btn-primary btn-glow" style="font-size: 0.9rem; padding: 0.65rem 1.4rem;">
                <i data-lucide="key"></i>
                <span>Reset & Update Password</span>
              </button>
            </div>
          </form>
        </div>

        <!-- Session Logout Card (At the end) -->
        <div class="card glass-card" style="padding: 1.5rem; border: 1px solid rgba(244, 63, 94, 0.2); background: linear-gradient(135deg, rgba(18, 24, 40, 0.8), rgba(244, 63, 94, 0.05));">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i data-lucide="log-out" style="color: var(--accent-rose); width: 22px; height: 22px;"></i>
                <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">Session Logout</h3>
              </div>
              <p class="text-muted" style="font-size: 0.82rem; margin-top: 0.25rem;">
                Log out of your active session. By using logout option you can again come back to login page.
              </p>
            </div>

            <button type="button" id="app-logout-btn" class="btn" style="background: linear-gradient(135deg, #f43f5e, #e11d48); color: #fff; border: none; padding: 0.7rem 1.4rem; font-weight: 700; box-shadow: 0 4px 15px rgba(244, 63, 94, 0.3); border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: transform 0.2s ease;">
              <i data-lucide="log-out" style="width: 18px; height: 18px;"></i>
              <span>Logout Account</span>
            </button>
          </div>
        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();


    const currentPassInput = container.querySelector('#app-current-pass');
    const newPassInput = container.querySelector('#app-new-pass');
    const confirmPassInput = container.querySelector('#app-confirm-pass');
    const togglePassBtn = container.querySelector('#app-toggle-pass-btn');
    const alertBanner = container.querySelector('#app-password-alert');
    const passForm = container.querySelector('#app-pass-reset-form');

    const ruleLength = container.querySelector('#app-rule-length');
    const ruleComplexity = container.querySelector('#app-rule-complexity');
    const ruleMatch = container.querySelector('#app-rule-match');

    togglePassBtn?.addEventListener('click', () => {
      const isPass = newPassInput.type === 'password';
      newPassInput.type = isPass ? 'text' : 'password';
      confirmPassInput.type = isPass ? 'text' : 'password';
      togglePassBtn.textContent = isPass ? 'Hide' : 'Show';
    });

    const validateRealtime = () => {
      const newPass = newPassInput?.value || '';
      const confirmPass = confirmPassInput?.value || '';
      const words = newPass.trim().split(/\s+/);
      const isPassphrase = words.length >= 5 && words.length <= 7 && newPass.length >= 8;
      const hasMinLen = newPass.length >= 8;
      const hasUpper = /[A-Z]/.test(newPass);
      const hasLower = /[a-z]/.test(newPass);
      const hasNum = /[0-9]/.test(newPass);
      const hasSym = /[!@#$%^&*(),.?":{}|<>]/.test(newPass);
      const hasComplex = isPassphrase || (hasUpper && hasLower && hasNum && hasSym);
      const isMatch = newPass && newPass === confirmPass;

      if (ruleLength) ruleLength.textContent = (hasMinLen ? '✔️' : '❌') + ' At least 8 characters long';
      if (ruleComplexity) ruleComplexity.textContent = (hasComplex ? '✔️' : '❌') + ' Mix of uppercase, lowercase, numbers & symbols (or 5-7 word passphrase)';
      if (ruleMatch) ruleMatch.textContent = (isMatch ? '✔️' : '❌') + ' New password and Confirm password must match';
    };

    newPassInput?.addEventListener('input', validateRealtime);
    confirmPassInput?.addEventListener('input', validateRealtime);

    passForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentP = currentPassInput?.value || '';
      const newP = newPassInput?.value || '';
      const confirmP = confirmPassInput?.value || '';

      if (newP !== confirmP) {
        if (alertBanner) {
          alertBanner.classList.remove('hidden');
          alertBanner.style.background = 'rgba(244, 63, 94, 0.15)';
          alertBanner.style.color = '#f43f5e';
          alertBanner.textContent = '❌ New passwords do not match. Please re-enter.';
        }
        return;
      }

      const res = await state.changePassword(currentP, newP);
      if (alertBanner) {
        alertBanner.classList.remove('hidden');
        alertBanner.style.background = res.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';
        alertBanner.style.color = res.success ? '#10b981' : '#f43f5e';
        alertBanner.textContent = (res.success ? '🎉 ' : '❌ ') + res.message;
      }
      if (res.success) {
        currentPassInput.value = '';
        newPassInput.value = '';
        confirmPassInput.value = '';
        validateRealtime();
        if (window.confetti) window.confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      }
    });

    container.querySelector('#app-logout-btn')?.addEventListener('click', () => {
      if (onLogout) onLogout();
    });
  }

  /* --------------------------------------------------------------------------
     5. MAIN APPLICATION CONTROLLER
     -------------------------------------------------------------------------- */
  class AppController {
    constructor() {
      this.currentView = 'dashboard';
      this.initIntroTransition();
      this.initTheme();
      this.initCurrency();
      this.initSidebarNav();
      this.initModals();
      this.initAuthentication();
      this.renderCurrentView();
      this.updateSidebarHealth();
    }

    initIntroTransition() {
      const introScreen = document.getElementById('intro-screen');
      const introBrand = document.getElementById('intro-brand');
      const appShell = document.getElementById('app-container');

      if (!introScreen || !introBrand || !appShell) return;

      const enterDashboard = () => {
        introBrand.classList.add('is-entering');
        introScreen.classList.add('is-hidden');
        document.body.classList.add('intro-active');
        appShell.classList.remove('app-shell-hidden');
        appShell.classList.add('app-shell-visible');

        window.setTimeout(() => {
          introScreen.remove();
          document.body.classList.remove('intro-active');
        }, 1400);
      };

      introBrand.addEventListener('click', enterDashboard);
      introBrand.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          enterDashboard();
        }
      });

      if (window.lucide) window.lucide.createIcons();
    }

    async initAuthentication() {
      // Redirect to dedicated login page if not authenticated
      if (!window.supabase?.auth) {
<<<<<<< HEAD
        window.location.href = './login.html';
=======
        hideAuthModal();
        this.updateUserIdentityUI('Guest User');
>>>>>>> 753cdc443838bbf635017206a49c3c00f8d5517c
        return;
      }

      const { data: { session } } = await window.supabase.auth.getSession();
      this.handleAuthSession(session);

      if (!session?.user) {
        const redirectTo = window.location.pathname || '/';
        window.location.href = `./login.html?redirect=${encodeURIComponent(redirectTo)}`;
        return;
      }

      window.supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
<<<<<<< HEAD
          window.location.href = './login.html';
=======
          this.updateUserIdentityUI('Guest User');
          hideAuthModal();
>>>>>>> 753cdc443838bbf635017206a49c3c00f8d5517c
          return;
        }
        this.handleAuthSession(session, event);
      });
    }

    handleAuthSession(session) {
      const userName = session?.user?.user_metadata?.full_name || session?.user?.email || '';
      if (session?.user) {
        state.setUserName(userName || 'FinPulse User');
        this.updateUserIdentityUI(userName || 'FinPulse User');
      } else {
<<<<<<< HEAD
        // No active session — ensure user lands on login page
        window.location.href = './login.html';
=======
        this.updateUserIdentityUI('Guest User');
        hideAuthModal();
>>>>>>> 753cdc443838bbf635017206a49c3c00f8d5517c
      }
    }

    initTheme() {
      const savedTheme = state.getTheme();
      document.documentElement.setAttribute('data-theme', savedTheme);
      document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        state.setTheme(next);
      });
    }

    updateUserIdentityUI(name) {
      const displayNameEl = document.getElementById('user-display-name');
      const avatarTextEl = document.getElementById('user-avatar-text');
      const headerCurrSelect = document.getElementById('currency-select');
      
      if (headerCurrSelect) {
        headerCurrSelect.value = state.getCurrency();
      }

      if (!name || !name.trim()) {
        if (displayNameEl) displayNameEl.textContent = 'Guest User';
        if (avatarTextEl) avatarTextEl.textContent = '?';
        return;
      }

      const trimmed = name.trim();
      if (displayNameEl) displayNameEl.textContent = trimmed;

      const parts = trimmed.split(/\s+/);
      let initials = parts[0].charAt(0);
      if (parts.length > 1) {
        initials += parts[parts.length - 1].charAt(0);
      } else if (trimmed.length > 1) {
        initials += trimmed.charAt(1);
      }
      if (avatarTextEl) avatarTextEl.textContent = initials.toUpperCase();
    }

    isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    updateModalCurrencySymbols() {
      const curr = CURRENCIES[state.getCurrency()] || CURRENCIES.USD;
      document.querySelectorAll('span.currency-symbol-prefix').forEach(el => {
        el.textContent = curr.symbol;
      });
    }

    initCurrency() {
      const select = document.getElementById('currency-select');
      if (select) {
        select.value = state.getCurrency();
        select.addEventListener('change', (e) => {
          state.setCurrency(e.target.value);
          this.renderCurrentView();
          this.updateSidebarHealth();
          this.updateModalCurrencySymbols();
        });
      }
      this.updateModalCurrencySymbols();
    }

    initSidebarNav() {
      const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
      navItems.forEach(item => {
        item.addEventListener('click', () => {
          navItems.forEach(n => n.classList.remove('active'));
          item.classList.add('active');
          this.currentView = item.getAttribute('data-view');
          this.renderCurrentView();
          document.querySelector('.sidebar')?.classList.remove('mobile-open');
        });
      });

      document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
        document.querySelector('.sidebar')?.classList.toggle('mobile-open');
      });
    }

    updateSidebarHealth() {
      const totals = state.getTotals();
      const scoreVal = document.getElementById('sidebar-health-score');
      const scoreBar = document.getElementById('sidebar-health-bar');
      const scoreDesc = document.getElementById('sidebar-health-desc');

      if (scoreVal) scoreVal.textContent = totals.healthScore;
      if (scoreBar) scoreBar.style.width = `${totals.healthScore}%`;
      if (scoreDesc) {
        if (totals.healthScore >= 80) scoreDesc.textContent = 'Optimal savings trajectory. Keep it up!';
        else if (totals.healthScore >= 60) scoreDesc.textContent = 'Moderate budget health. Watch dining expenses.';
        else scoreDesc.textContent = 'Action needed! Expenses exceed recommended limits.';
      }
    }

    renderCurrentView() {
      const stage = document.getElementById('view-container');
      const titleEl = document.getElementById('view-title');
      const subtitleEl = document.getElementById('view-subtitle');
      if (!stage) return;

      if (window.lucide) window.lucide.createIcons();

      switch (this.currentView) {
        case 'dashboard':
          if (titleEl) titleEl.textContent = 'Financial Dashboard';
          if (subtitleEl) subtitleEl.textContent = 'Real-time spend analytics and intelligent AI insights';
          renderDashboardView(stage);
          break;

        case 'budgeting':
          if (titleEl) titleEl.textContent = 'Budgeting';
          if (subtitleEl) subtitleEl.textContent = 'Track budgets and savings goals with a simple overview';
          renderBudgetsView(stage, (goalId) => this.openGoalModal(goalId), () => this.updateSidebarHealth());
          break;

        case 'income':
          if (titleEl) titleEl.textContent = 'Income Overview';
          if (subtitleEl) subtitleEl.textContent = 'View and manage only your income entries';
          renderIncomeView(stage, (tx) => this.openTransactionModal(tx), () => this.updateSidebarHealth());
          break;

        case 'expenses':
          if (titleEl) titleEl.textContent = 'Expenses Overview';
          if (subtitleEl) subtitleEl.textContent = 'View and manage all your expense entries';
          renderExpensesView(stage, (tx) => this.openTransactionModal(tx), () => this.updateSidebarHealth());
          break;

        case 'budgetbot':
          if (titleEl) titleEl.textContent = 'BudgetBot';
          if (subtitleEl) subtitleEl.textContent = 'Ask natural language questions about your money & savings';
          renderAiCoachView(stage);
          break;

        case 'subscriptions':
          if (titleEl) titleEl.textContent = 'Subscription Audit';
          if (subtitleEl) subtitleEl.textContent = 'Identify unused recurring bills and eliminate money leaks';
          renderSubscriptionsView(stage);
          break;

        case 'scanner':
          if (titleEl) titleEl.textContent = 'AI Receipt Scanner';
          if (subtitleEl) subtitleEl.textContent = 'Optical receipt OCR scanner with auto-field extraction';
          renderScannerView(stage, () => this.updateSidebarHealth());
          break;

        case 'settings':
          if (titleEl) titleEl.textContent = 'Account Settings & Security';
          if (subtitleEl) subtitleEl.textContent = 'Manage password security, Supabase Cloud configuration, and session options';
          renderSettingsView(stage, () => this.handleLogout(), () => this.updateSidebarHealth());
          break;

        default:
          renderDashboardView(stage);
      }
    }

    async handleLogout() {
      try {
        if (window.authHelpers && window.authHelpers.signOutUser) {
          await window.authHelpers.signOutUser();
        } else if (window.supabase && window.supabase.auth) {
          await window.supabase.auth.signOut();
        }
      } catch (e) {
        console.warn('Error during sign out', e);
      }

      state.logout();
      this.updateUserIdentityUI('Guest User');
      // Redirect to login page after logout
      window.location.href = './login.html';
    }

    initModals() {
      document.getElementById('quick-add-btn')?.addEventListener('click', () => this.openTransactionModal(null));
      document.getElementById('modal-close')?.addEventListener('click', () => this.closeModal('transaction-modal'));
      document.getElementById('modal-cancel-btn')?.addEventListener('click', () => this.closeModal('transaction-modal'));
      document.getElementById('goal-modal-close')?.addEventListener('click', () => this.closeModal('goal-deposit-modal'));
      document.getElementById('goal-modal-cancel')?.addEventListener('click', () => this.closeModal('goal-deposit-modal'));


      ['transaction-modal', 'goal-deposit-modal'].forEach(modalId => {
        const modal = document.getElementById(modalId);
        modal?.addEventListener('click', (e) => {
          if (e.target === modal) this.closeModal(modalId);
        });
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeModal('transaction-modal');
          this.closeModal('goal-deposit-modal');
        }
      });

      document.getElementById('tx-currency')?.addEventListener('change', (e) => {
        const curr = e.target.value;
        const symEl = document.getElementById('tx-currency-symbol');
        if (symEl) symEl.textContent = CURRENCIES[curr]?.symbol || '$';
      });

      document.getElementById('transaction-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('tx-id').value;
        const txData = {
          type: document.getElementById('tx-type').value,
          currency: document.getElementById('tx-currency')?.value || state.getCurrency(),
          amount: parseFloat(document.getElementById('tx-amount').value),
          title: document.getElementById('tx-title').value,
          category: document.getElementById('tx-category').value,
          date: document.getElementById('tx-date').value || new Date().toISOString().split('T')[0],
          paymentMethod: document.getElementById('tx-payment').value,
          recurring: document.getElementById('tx-recurring').value
        };

        if (id) { txData.id = id; state.updateTransaction(txData); }
        else { state.addTransaction(txData); }

        this.closeModal('transaction-modal');
        this.renderCurrentView();
        this.updateSidebarHealth();
      });

      document.getElementById('goal-deposit-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const goalId = document.getElementById('goal-id').value;
        const amount = parseFloat(document.getElementById('goal-deposit-amount').value);
        const updatedGoal = state.depositToGoal(goalId, amount);

        this.closeModal('goal-deposit-modal');
        this.renderCurrentView();
        this.updateSidebarHealth();

        if (updatedGoal && updatedGoal.currentAmount >= updatedGoal.targetAmount && window.confetti) {
          window.confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        }
      });
    }

    openTransactionModal(tx = null) {
      const modal = document.getElementById('transaction-modal');
      const title = document.getElementById('modal-title');
      if (!modal) return;

      this.updateModalCurrencySymbols();

      if (tx) {
        title.textContent = 'Edit Transaction';
        document.getElementById('tx-id').value = tx.id;
        document.getElementById('tx-type').value = tx.type;
        if (document.getElementById('tx-currency')) {
          document.getElementById('tx-currency').value = tx.currency || state.getCurrency();
        }
        document.getElementById('tx-amount').value = tx.amount;
        document.getElementById('tx-title').value = tx.title;
        document.getElementById('tx-category').value = tx.category;
        document.getElementById('tx-date').value = tx.date;
        document.getElementById('tx-payment').value = tx.paymentMethod;
        document.getElementById('tx-recurring').value = tx.recurring || 'false';
      } else {
        title.textContent = 'Add New Transaction';
        document.getElementById('tx-id').value = '';
        document.getElementById('tx-type').value = 'expense';
        if (document.getElementById('tx-currency')) {
          document.getElementById('tx-currency').value = state.getCurrency();
        }
        document.getElementById('tx-amount').value = '';
        document.getElementById('tx-title').value = '';
        document.getElementById('tx-category').value = 'Food & Dining';
        document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('tx-payment').value = 'Credit Card';
        document.getElementById('tx-recurring').value = 'false';
      }

      const activeTxCurr = document.getElementById('tx-currency')?.value || state.getCurrency();
      const symEl = document.getElementById('tx-currency-symbol');
      if (symEl) symEl.textContent = CURRENCIES[activeTxCurr]?.symbol || '$';

      modal.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();
    }

    openGoalModal(goalId) {
      const modal = document.getElementById('goal-deposit-modal');
      const goal = state.getSavingsGoals().find(g => g.id === goalId);
      if (!modal || !goal) return;

      this.updateModalCurrencySymbols();

      document.getElementById('goal-id').value = goalId;
      document.getElementById('goal-modal-title').textContent = `Deposit to "${goal.title}"`;
      document.getElementById('goal-deposit-amount').value = '';

      modal.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();
    }

    closeModal(modalId) {
      document.getElementById(modalId)?.classList.add('hidden');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
  });
})();
