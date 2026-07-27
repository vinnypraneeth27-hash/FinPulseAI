import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Supabase Configuration (Replace with your actual project URL and Anon Key)
const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd2F5Y252bXpqbWl1eXVpc3RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5NjQ5NTcsImV4cCI6MjEwMDU0MDk1N30.DJpDqhQDmcJA-KW0shHZq1SMyBWycD5IyY5PpY6Ieio';

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
