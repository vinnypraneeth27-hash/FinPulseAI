import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Supabase Configuration (Replace with your actual project URL and Anon Key)
const SUPABASE_URL = 'https://wwtzyuyjjizglecsvqxb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3dHp5dXlqaml6Z2xlY3N2cXhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MzM4MjUsImV4cCI6MjEwNTIwOTgyNX0.FxovK82C-cimBVqCLlxXOthEV0jA8IrMStks_As7hOE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Sends a One-Time Password (OTP) / Magic Link to the user's email.
 * Configured with emailRedirectTo using the current website URL.
 * 
 * @param {string} email - The user's email address
 */
export async function sendOTP(email) {
  // Dynamically uses current website URL (origin), fallback to http://localhost:8080
  const websiteUrl = window.location.origin || 'http://localhost:8080';

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
      options: { redirectTo: window.location.origin }
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

window.authHelpers = {
  signInWithGoogle,
  signOutUser,
  getCurrentSession,
};
