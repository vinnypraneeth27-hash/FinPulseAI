/* ==========================================================================
   FinPulse AI - Central State Management & Storage
   ========================================================================== */

import { calculateHealthScore } from './utils.js';

const STORAGE_KEY = 'FINPULSE_AI_STATE_V1';

const DEFAULT_SEED_DATA = {
  currency: 'USD',
  theme: 'dark',
  transactions: [
    { id: 'tx-101', type: 'income', title: 'TechCorp Senior Dev Salary', category: 'Income', amount: 5500.00, date: '2026-07-01', paymentMethod: 'Bank Transfer', recurring: 'monthly' },
    { id: 'tx-102', type: 'expense', title: 'Luxury Apartment Rent', category: 'Housing & Utilities', amount: 1850.00, date: '2026-07-02', paymentMethod: 'Bank Transfer', recurring: 'monthly' },
    { id: 'tx-103', type: 'expense', title: 'Whole Foods Market Organic Groceries', category: 'Food & Dining', amount: 245.50, date: '2026-07-04', paymentMethod: 'Credit Card', recurring: 'false' },
    { id: 'tx-104', type: 'expense', title: 'Tesla Supercharger Station', category: 'Transportation', amount: 42.00, date: '2026-07-05', paymentMethod: 'Apple Pay / Wallet', recurring: 'false' },
    { id: 'tx-105', type: 'expense', title: 'Netflix Ultra HD Subscription', category: 'Subscriptions', amount: 22.99, date: '2026-07-06', paymentMethod: 'Credit Card', recurring: 'monthly' },
    { id: 'tx-106', type: 'expense', title: 'Spotify Premium Family Plan', category: 'Subscriptions', amount: 16.99, date: '2026-07-07', paymentMethod: 'Credit Card', recurring: 'monthly' },
    { id: 'tx-107', type: 'income', title: 'Freelance UI/UX Consultation', category: 'Income', amount: 1200.00, date: '2026-07-10', paymentMethod: 'Bank Transfer', recurring: 'false' },
    { id: 'tx-108', type: 'expense', title: 'Equinox Fitness Club Pass', category: 'Health & Fitness', amount: 180.00, date: '2026-07-11', paymentMethod: 'Credit Card', recurring: 'monthly' },
    { id: 'tx-109', type: 'expense', title: 'Apple Store - Wireless Headphones', category: 'Shopping & Tech', amount: 349.00, date: '2026-07-14', paymentMethod: 'Credit Card', recurring: 'false' },
    { id: 'tx-110', type: 'expense', title: 'Nobu Restaurant Omakase Dinner', category: 'Food & Dining', amount: 310.00, date: '2026-07-18', paymentMethod: 'Credit Card', recurring: 'false' },
    { id: 'tx-111', type: 'expense', title: 'OpenAI ChatGPT Plus Subscription', category: 'Subscriptions', amount: 20.00, date: '2026-07-20', paymentMethod: 'Credit Card', recurring: 'monthly' },
    { id: 'tx-112', type: 'expense', title: 'Concert Tickets - Summer Music Fest', category: 'Entertainment', amount: 175.00, date: '2026-07-22', paymentMethod: 'Credit Card', recurring: 'false' }
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
    {
      sender: 'ai',
      text: 'Hello! I am **Finny**, your AI Financial Coach. I have analyzed your July 2026 cash flow. You are currently saving **52%** of your total monthly income. How can I help optimize your budget today?'
    }
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
      text: 'Welcome! I am **Finny**, your AI Financial Coach. Your new account is active.\n\n• **Total Balance**: **$0.00**\n• **Monthly Income**: **$0.00**\n• **Total Spent**: **$0.00**\n• **AI Health Score**: **100/100**\n\nAdd your first income or expense transaction or tap the mic to start tracking!'
    }
  ]
};

const REGISTRY_KEY = 'FINPULSE_USERS_REGISTRY_V1';

export function normalizeUsername(name) {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export function getUserStorageKey(username) {
  const norm = normalizeUsername(username);
  return `FINPULSE_USER_DATA_${norm}`;
}

export function validatePassword(password) {
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
    return { valid: false, message: 'Password must contain uppercase (A-Z), lowercase (a-z), numbers (0-9), and symbols (!@#$).' };
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
    } catch (e) {
      return {};
    }
  }

  saveUsersRegistry(registry) {
    try {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {
      console.error(e);
    }
  }

  userExists(username) {
    const norm = normalizeUsername(username);
    if (!norm) return false;
    const registry = this.getUsersRegistry();
    return !!registry[norm];
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
    // New users open freshly with blank new user state
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
      console.warn('Failed to load user data from localStorage.', e);
    }
    // New user fallback: fresh clean blank state
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

  // User Profile Name Management
  getUserName() { return this.activeUser || this.data.userName || ''; }
  setUserName(name) { this.data.userName = name; this.saveState(); }

  // Getters
  getCurrency() { return this.data.currency; }
  setCurrency(curr) { this.data.currency = curr; this.saveState(); }

  getTheme() { return this.data.theme || 'dark'; }
  setTheme(theme) { this.data.theme = theme; this.saveState(); }

  getTransactions() {
    return [...this.data.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  addTransaction(tx) {
    tx.id = 'tx-' + Date.now();
    this.data.transactions.unshift(tx);
    this.saveState();
    return tx;
  }

  updateTransaction(updatedTx) {
    const idx = this.data.transactions.findIndex(t => t.id === updatedTx.id);
    if (idx !== -1) {
      this.data.transactions[idx] = updatedTx;
      this.saveState();
    }
  }

  deleteTransaction(id) {
    this.data.transactions = this.data.transactions.filter(t => t.id !== id);
    this.saveState();
  }

  getBudgetLimits() { return { ...this.data.budgetLimits }; }
  setBudgetLimit(category, amount) {
    this.data.budgetLimits[category] = parseFloat(amount);
    this.saveState();
  }

  getSavingsGoals() { return [...this.data.savingsGoals]; }
  
  depositToGoal(goalId, amount) {
    const goal = this.data.savingsGoals.find(g => g.id === goalId);
    if (goal) {
      goal.currentAmount += parseFloat(amount);
      this.saveState();
      return goal;
    }
    return null;
  }

  getSubscriptions() { return [...this.data.subscriptions]; }

  toggleSubscriptionStatus(subId) {
    const sub = this.data.subscriptions.find(s => s.id === subId);
    if (sub) {
      sub.status = sub.status === 'Active' ? 'Cancelled' : 'Active';
      this.saveState();
    }
  }

  getAiChatHistory() { return [...this.data.aiChatHistory]; }
  
  addAiChatMessage(sender, text) {
    this.data.aiChatHistory.push({ sender, text });
    this.saveState();
  }

  // Calculated Metrics
  getTotals() {
    let income = 0;
    let expenses = 0;
    const actualByCategory = {};

    this.data.transactions.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') {
        income += amt;
      } else {
        expenses += amt;
        actualByCategory[t.category] = (actualByCategory[t.category] || 0) + amt;
      }
    });

    const netSavings = income - expenses;
    const savingsRate = income > 0 ? (netSavings / income) * 100 : 0;
    const healthScore = calculateHealthScore(income, expenses, this.data.budgetLimits, actualByCategory);

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netSavings,
      savingsRate,
      healthScore,
      actualByCategory
    };
  }
}

export const state = new StateManager();
