import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://wwtzyuyjjizglecsvqxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3dHp5dXlqaml6Z2xlY3N2cXhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzM4MjUsImV4cCI6MjEwNTIwOTgyNX0.FxovK82C-cimBVqCLlxXOthEV0jA8IrMStks_As7hOE';

export function normalizeTransactionType(transactionType) {
  const value = String(transactionType || '').trim().toLowerCase();
  return value === 'income' ? 'income' : 'expense';
}

function resolveAppUrl(page) {
  return new URL(`./${page}`, window.location.href).href;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function sendOTP(email) {
  const websiteUrl = resolveAppUrl('dashboard.html');

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: websiteUrl }
  });

  if (error) {
    console.error('Error sending OTP:', error.message);
    return { success: false, error };
  }

  console.log('OTP sent successfully to:', email);
  return { success: true, data };
}

window.supabase = supabase;
window.sendOTP = sendOTP;

async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: resolveAppUrl('login.html') }
    });
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

async function signOutUser() {
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (err) {
    return { error: err };
  }
}

async function getCurrentSession() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch (err) {
    console.error('Supabase session lookup failed:', err);
    return null;
  }
}

export async function getUserProfile() {
  try {
    const session = await getCurrentSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, currency, created_at, updated_at')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to load user profile:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Failed to load user profile:', error);
    return null;
  }
}

export async function saveUserCurrency(currency) {
  const normalizedCurrency = String(currency || 'INR').trim().toUpperCase();

  try {
    const session = await getCurrentSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: session.user.id,
        currency: normalizedCurrency,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Failed to save user currency:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to save user currency:', error);
    return null;
  }
}

export async function loadUserCurrency() {
  try {
    const profile = await getUserProfile();
    if (profile?.currency) {
      return String(profile.currency).toUpperCase();
    }

    const session = await getCurrentSession();
    if (!session?.user) return 'INR';

    const defaultProfile = await saveUserCurrency('INR');
    return defaultProfile?.currency || 'INR';
  } catch (error) {
    console.error('Failed to load user currency:', error);
    return 'INR';
  }
}

async function listTransactionsForUser() {
  try {
    const session = await getCurrentSession();
    if (!session?.user) return [];

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', session.user.id)
      .order('expense_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Supabase load failed:', error);
    return [];
  }
}

function buildSupabasePayload(tx, userId) {
  const type = normalizeTransactionType(tx?.type || tx?.transaction_type);
  const amount = Number(tx?.amount ?? 0);

  if (!userId) {
    throw new Error('Missing authenticated user id.');
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Transaction amount must be greater than zero.');
  }

  return {
    user_id: userId,
    amount,
    category: tx?.category || 'Miscellaneous',
    description: tx?.title || tx?.description || 'Transaction',
    expense_date: tx?.date || new Date().toISOString().split('T')[0],
    transaction_type: type
  };
}

async function saveExpenseToSupabase(tx) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      throw new Error('No logged-in user. Transaction was not saved to Supabase.');
    }

    const payload = buildSupabasePayload(tx, session.user.id);
    const { data, error } = await supabase
      .from('expenses')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Supabase expense save error:', error);
      throw error;
    }

    console.log('Expense saved to Supabase:', data);
    return data;
  } catch (error) {
    console.error('Error saving expense:', error);
    throw error;
  }
}

async function updateExpenseInSupabase(tx) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      throw new Error('No logged-in user. Transaction update failed.');
    }

    const txId = tx?.id || tx?.supabaseId;
    if (!txId) {
      throw new Error('No transaction id found for Supabase update.');
    }

    const payload = buildSupabasePayload(tx, session.user.id);
    const { data, error } = await supabase
      .from('expenses')
      .update({
        amount: payload.amount,
        category: payload.category,
        description: payload.description,
        expense_date: payload.expense_date,
        transaction_type: payload.transaction_type
      })
      .eq('id', txId)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      console.error('Supabase expense update error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error updating expense:', error);
    throw error;
  }
}

async function deleteExpenseFromSupabase(txId) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.user) {
      throw new Error('No logged-in user. Transaction deletion failed.');
    }

    if (!txId) {
      return null;
    }

    const { data, error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', txId)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      console.error('Supabase expense delete error:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
}

window.authHelpers = {
  signInWithGoogle,
  signOutUser,
  getCurrentSession,
  getUserProfile,
  saveUserCurrency,
  loadUserCurrency,
  listTransactionsForUser,
  saveExpenseToSupabase,
  updateExpenseInSupabase,
  deleteExpenseFromSupabase
};