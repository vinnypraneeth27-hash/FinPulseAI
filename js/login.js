(function(){
  'use strict';

  function el(id){ return document.getElementById(id); }

  function setFeedback(message, variant='info'){
    const f = el('auth-feedback');
    if(!f) return;
    f.textContent = message || '';
    f.style.color = variant === 'error' ? 'var(--accent-rose)' : (variant === 'success' ? 'var(--accent-emerald)' : 'var(--text-main)');
  }

  async function checkSessionAndRedirect(){
    try{
      const session = await window.authHelpers.getCurrentSession();
      if(session && session.user){
        // Already authenticated
        window.location.href = './index.html';
        return true;
      }
    }catch(e){ /* ignore */ }
    return false;
  }

  function showSpinner(show){
    el('spinner').style.display = show ? 'block' : 'none';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const googleBtn = el('google-signin');
    const themeToggle = el('theme-toggle-login');

    // Quick session check — if already signed in, go to dashboard
    await checkSessionAndRedirect();

    // Handle theme toggle
    themeToggle?.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      setFeedback('Theme: ' + next, 'info');
    });

    // Listen for Supabase auth state changes
    if(window.supabase && window.supabase.auth && window.supabase.auth.onAuthStateChange){
      window.supabase.auth.onAuthStateChange((event, session) => {
        if(event === 'SIGNED_IN' || event === 'USER_UPDATED'){
          setFeedback('Sign-in successful — redirecting...', 'success');
          try{ if(window.confetti) window.confetti({ particleCount: 60, spread: 60 }); }catch(e){}
          setTimeout(() => window.location.href = './index.html', 700);
        }
        if(event === 'SIGNED_OUT'){
          setFeedback('Signed out.', 'info');
        }
      });
    }

    googleBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      setFeedback('Starting Google sign-in...', 'info');
      showSpinner(true);

      try{
        const { data, error } = await window.authHelpers.signInWithGoogle();
        showSpinner(false);
        if(error){
          console.error('Google sign-in error', error);
          setFeedback(error.message || 'Unable to start Google sign-in.', 'error');
          return;
        }

        // Supabase may return a url to redirect the browser to.
        if(data?.url){
          window.location.href = data.url;
          return;
        }

        setFeedback('Google sign-in initiated. Follow the browser prompt.', 'info');
      }catch(err){
        console.error(err);
        showSpinner(false);
        setFeedback('An unexpected error occurred. Try again.', 'error');
      }
    });
  });
})();
