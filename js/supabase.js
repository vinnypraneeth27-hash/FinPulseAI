import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Supabase Configuration (Replace with your actual project URL and Anon Key)
const SUPABASE_URL = 'https://wwtzyuyjjizglecsvqxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3dHp5dXlqaml6Z2xlY3N2cXhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzM4MjUsImV4cCI6MjEwNTIwOTgyNX0.FxovK82C-cimBVqCLlxXOthEV0jA8IrMStks_As7hOE';

function resolveAppUrl() {
  const origin = window.location?.origin;
  const protocol = window.location?.protocol;

  if (origin && origin !== 'null' && protocol !== 'file:') {
    return origin;
  }

  return 'http://localhost:8000';
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Sends a One-Time Password (OTP) / Magic Link to the user's email.
 * Configured with emailRedirectTo using the current website URL.
 * 
 * @param {string} email - The user's email address
 */
export async function sendOTP(email) {
  const websiteUrl = resolveAppUrl();

  const { data, error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      emailRedirectTo: websiteUrl
    }
  });

  if (error) {
    console.error("Error sending OTP:", error.message);
    return { success: false, error };
  }

  console.log("OTP sent successfully to:", email);
  return { success: true, data };
}

// Expose on window for direct access across app modules
window.supabase = supabase;
window.sendOTP = sendOTP;

// Auth helpers for non-module scripts
async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: resolveAppUrl() }
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
    return null;
  }
}

async function saveExpenseToSupabase(tx) {
  try {
    const session = await getCurrentSession();

    if (!session || !session.user) {
      console.log('No logged-in user. Expense not saved to Supabase.');
      return null;
    }

    const userId = session.user.id;

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id: userId,
        amount: parseFloat(tx.amount),
        category: tx.category,
        description: tx.title,
        expense_date: tx.date
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase expense save error:', error);
      return null;
    }

    console.log('Expense saved to Supabase:', data);
    return data;

  } catch (error) {
    console.error('Error saving expense:', error);
    return null;
  }
}

window.authHelpers = {
  signInWithGoogle,
  signOutUser,
  getCurrentSession,
  saveExpenseToSupabase,
};