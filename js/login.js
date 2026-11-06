
import './supabase.js';

(function () {
  'use strict';

  function el(id) {
    return document.getElementById(id);
  }

  let authMode = 'login';
  let isProcessing = false;

  function setFeedback(message, variant = 'info') {
    const feedback = el('auth-feedback');
    if (!feedback) return;

    feedback.textContent = message || '';

    feedback.style.color =
      variant === 'error'
        ? 'var(--accent-rose)'
        : variant === 'success'
          ? 'var(--accent-emerald)'
          : 'var(--text-main)';
  }

  function showSpinner(show) {
    const spinner = el('spinner');
    if (spinner) {
      spinner.style.display = show ? 'block' : 'none';
    }
  }

  function setProcessing(processing) {
    isProcessing = processing;

    const submitButton = el('email-auth-submit');
    const googleButton = el('google-signin');
    const modeButton = el('auth-mode-toggle');

    if (submitButton) submitButton.disabled = processing;
    if (googleButton) googleButton.disabled = processing;
    if (modeButton) modeButton.disabled = processing;

    showSpinner(processing);
  }

  async function checkSessionAndRedirect() {
    try {
      const session = await window.authHelpers.getCurrentSession();

      if (session && session.user) {
        window.location.replace('./dashboard.html');
        return true;
      }
    } catch (error) {
      console.error('Unable to verify the current sign-in session:', error);
      setFeedback('Unable to verify your sign-in. Please try again.', 'error');
    }

    return false;
  }

  function updateAuthMode() {
    const heading = el('login-heading');
    const description = el('login-description');
    const submitButton = el('email-auth-submit');
    const modeText = el('auth-mode-text');
    const modeToggle = el('auth-mode-toggle');
    const passwordInput = el('auth-password');

    if (authMode === 'signup') {
      heading.textContent = 'Create Account';
      description.textContent = 'Create your FinPulse AI account to get started.';
      submitButton.textContent = 'Create Account';
      modeText.textContent = 'Already have an account?';
      modeToggle.textContent = 'Sign In';
      passwordInput.autocomplete = 'new-password';
    } else {
      heading.textContent = 'Welcome Back';
      description.textContent = 'Sign in to continue managing your finances.';
      submitButton.textContent = 'Sign In';
      modeText.textContent = 'New to FinPulse AI?';
      modeToggle.textContent = 'Create Account';
      passwordInput.autocomplete = 'current-password';
    }

    setFeedback('');
  }

  async function handleEmailAuthentication(event) {
    event.preventDefault();

    if (isProcessing) return;

    const email = el('auth-email').value.trim();
    const password = el('auth-password').value;

    if (!email || !password) {
      setFeedback('Please enter your email and password.', 'error');
      return;
    }

    setProcessing(true);

    try {
      if (authMode === 'signup') {
        setFeedback('Creating your account...', 'info');

        const { data, error } =
          await window.authHelpers.signUpWithPassword(email, password);

        if (error) {
          console.error('Account creation error:', error);
          setFeedback(error.message || 'Unable to create your account.', 'error');
          return;
        }

        if (data?.session) {
          setFeedback('Account created successfully. Redirecting...', 'success');

          try {
            if (window.confetti) {
              window.confetti({ particleCount: 60, spread: 60 });
            }
          } catch (error) {}

          window.location.replace('./dashboard.html');
          return;
        }

        // Switch to sign-in mode after account creation.
        authMode = 'login';
        updateAuthMode();

        setFeedback(
          'Account created! Please check your email and confirm your account before signing in.',
          'success'
        );

      } else {
        setFeedback('Signing in...', 'info');

        const { data, error } =
          await window.authHelpers.signInWithPassword(email, password);

        if (error) {
          console.error('Email/password sign-in error:', error);
          setFeedback(error.message || 'Unable to sign in. Please check your details.', 'error');
          return;
        }

        if (data?.session) {
          setFeedback('Sign-in successful. Redirecting...', 'success');

          try {
            if (window.confetti) {
              window.confetti({ particleCount: 60, spread: 60 });
            }
          } catch (error) {}

          window.location.replace('./dashboard.html');
        } else {
          setFeedback('Sign-in completed, but no active session was returned.', 'error');
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setFeedback(error.message || 'An unexpected error occurred. Please try again.', 'error');
    } finally {
      setProcessing(false);
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const googleButton = el('google-signin');
    const themeToggle = el('theme-toggle-login');
    const authForm = el('email-auth-form');
    const modeToggle = el('auth-mode-toggle');

    if (await checkSessionAndRedirect()) return;

    // Email and password login / registration.
    authForm?.addEventListener('submit', handleEmailAuthentication);

    // Switch between Sign In and Create Account.
    modeToggle?.addEventListener('click', () => {
      if (isProcessing) return;

      authMode = authMode === 'login' ? 'signup' : 'login';
      updateAuthMode();
    });

    // Theme toggle.
    themeToggle?.addEventListener('click', () => {
      const next =
        document.documentElement.getAttribute('data-theme') === 'dark'
          ? 'light'
          : 'dark';

      document.documentElement.setAttribute('data-theme', next);
      setFeedback('Theme: ' + next, 'info');
    });

    // Supabase authentication state changes.
    if (
      window.supabase &&
      window.supabase.auth &&
      window.supabase.auth.onAuthStateChange
    ) {
      window.supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setFeedback('Sign-in successful. Redirecting...', 'success');

          try {
            if (window.confetti) {
              window.confetti({ particleCount: 60, spread: 60 });
            }
          } catch (error) {}

          window.location.replace('./dashboard.html');
        }

        if (event === 'SIGNED_OUT') {
          setFeedback('Signed out.', 'info');
        }
      });
    }

    // Existing Google OAuth sign-in.
    googleButton?.addEventListener('click', async (event) => {
      event.preventDefault();

      if (isProcessing) return;

      setProcessing(true);
      setFeedback('Starting Google sign-in...', 'info');

      try {
        const { data, error } =
          await window.authHelpers.signInWithGoogle();

        if (error) {
          console.error('Google sign-in error:', error);
          setFeedback(error.message || 'Unable to start Google sign-in.', 'error');
          return;
        }

        if (data?.url) {
          window.location.assign(data.url);
          return;
        }

        setFeedback('Google sign-in initiated. Follow the browser prompt.', 'info');
      } catch (error) {
        console.error('Google sign-in error:', error);
        setFeedback('An unexpected error occurred. Please try again.', 'error');
      } finally {
        setProcessing(false);
      }
    });
  });
})();
