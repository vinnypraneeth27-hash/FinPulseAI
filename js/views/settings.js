/* ==========================================================================
   FinPulse AI - Settings View
   ========================================================================== */

import { state, validatePassword } from '../state.js';

export function renderSettingsView(container, onLogout, onDataChange) {
  if (!container) return;

  const currentUsername = state.getUserName() || 'Guest User';

  container.innerHTML = `
    <div class="settings-view-wrapper" style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 900px; margin: 0 auto; padding-bottom: 2rem;">
      
      <!-- 1. Profile & Connection Status Header Card -->
      <div class="card glass-card" style="padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="user-avatar" style="width: 56px; height: 56px; font-size: 1.4rem; font-weight: 800; background: linear-gradient(135deg, var(--primary), var(--accent-cyan)); box-shadow: 0 0 15px var(--primary-glow);">
            ${currentUsername.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.15rem;">
              ${escapeHtml(currentUsername)}
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

        <div style="display: flex; gap: 0.5rem;">
          <button id="theme-toggle-btn-settings" class="btn btn-outline btn-sm">
            <i data-lucide="${state.getTheme() === 'dark' ? 'sun' : 'moon'}"></i>
            <span>${state.getTheme() === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
          </button>
        </div>
      </div>

      <!-- 2. Password Reset & Security Card -->
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

        <form id="password-reset-form" style="display: flex; flex-direction: column; gap: 1.1rem;">
          <div class="form-group">
            <label for="settings-current-pass" style="font-size: 0.82rem; font-weight: 700; color: var(--text-main);">
              Current Password
            </label>
            <div class="input-with-prefix" style="position: relative;">
              <i data-lucide="key-round" class="currency-symbol-prefix" style="left: 0.85rem; width: 18px; height: 18px;"></i>
              <input 
                type="password" 
                id="settings-current-pass" 
                class="custom-input" 
                placeholder="Enter your current password" 
                required 
                style="padding-left: 2.5rem; font-size: 0.95rem;" 
              />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <label for="settings-new-pass" style="font-size: 0.82rem; font-weight: 700; color: var(--text-main);">
                  New Password
                </label>
                <button type="button" id="settings-toggle-pass-btn" style="background: none; border: none; color: var(--accent-cyan); cursor: pointer; font-size: 0.75rem; font-weight: 600;">
                  Show
                </button>
              </div>
              <div class="input-with-prefix" style="position: relative;">
                <i data-lucide="lock" class="currency-symbol-prefix" style="left: 0.85rem; width: 18px; height: 18px;"></i>
                <input 
                  type="password" 
                  id="settings-new-pass" 
                  class="custom-input" 
                  placeholder="Enter new strong password" 
                  required 
                  style="padding-left: 2.5rem; font-size: 0.95rem;" 
                />
              </div>
            </div>

            <div class="form-group">
              <label for="settings-confirm-pass" style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem; display: block;">
                Confirm New Password
              </label>
              <div class="input-with-prefix" style="position: relative;">
                <i data-lucide="check-circle-2" class="currency-symbol-prefix" style="left: 0.85rem; width: 18px; height: 18px;"></i>
                <input 
                  type="password" 
                  id="settings-confirm-pass" 
                  class="custom-input" 
                  placeholder="Re-enter new password" 
                  required 
                  style="padding-left: 2.5rem; font-size: 0.95rem;" 
                />
              </div>
            </div>
          </div>

          <!-- Password Requirements Checklist -->
          <div class="password-rules-box" style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.75rem 0.9rem; font-size: 0.75rem; display: flex; flex-direction: column; gap: 0.35rem;">
            <div style="font-weight: 700; color: var(--text-main); margin-bottom: 0.15rem; display: flex; align-items: center; gap: 0.35rem;">
              <i data-lucide="shield" style="width: 13px; height: 13px; color: var(--accent-cyan);"></i> Password Strength Requirements:
            </div>
            <div class="rule-item" id="settings-rule-length" style="color: var(--text-muted); font-weight: 500;">❌ At least 8 characters long</div>
            <div class="rule-item" id="settings-rule-complexity" style="color: var(--text-muted); font-weight: 500;">❌ Mix of uppercase, lowercase, numbers & symbols (or 5-7 word passphrase)</div>
            <div class="rule-item" id="settings-rule-match" style="color: var(--text-muted); font-weight: 500;">❌ New password and Confirm password must match</div>
          </div>

          <!-- Alert Banner -->
          <div id="settings-password-alert" class="hidden" style="padding: 0.65rem 0.9rem; border-radius: var(--radius-md); font-size: 0.82rem; font-weight: 600; text-align: center;"></div>

          <div style="display: flex; justify-content: flex-end; margin-top: 0.25rem;">
            <button type="submit" id="btn-submit-password-reset" class="btn btn-primary btn-glow" style="font-size: 0.9rem; padding: 0.65rem 1.4rem;">
              <i data-lucide="key"></i>
              <span>Reset & Update Password</span>
            </button>
          </div>
        </form>
      </div>

      <!-- 4. Session & Logout Option (At the end) -->
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

          <button type="button" id="settings-logout-btn" class="btn" style="background: linear-gradient(135deg, #f43f5e, #e11d48); color: #fff; border: none; padding: 0.7rem 1.4rem; font-weight: 700; box-shadow: 0 4px 15px rgba(244, 63, 94, 0.3); border-radius: var(--radius-md); cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: transform 0.2s ease;">
            <i data-lucide="log-out" style="width: 18px; height: 18px;"></i>
            <span>Logout Account</span>
          </button>
        </div>
      </div>

    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  initSettingsEventHandlers(container, onLogout, onDataChange);
}

function initSettingsEventHandlers(container, onLogout, onDataChange) {
  // Theme Toggle Button
  const themeToggle = container.querySelector('#theme-toggle-btn-settings');
  themeToggle?.addEventListener('click', () => {
    const nextTheme = state.getTheme() === 'dark' ? 'light' : 'dark';
    state.setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    if (onDataChange) onDataChange();
    renderSettingsView(container, onLogout, onDataChange);
  });



  // Password Reset Form Handlers
  const passForm = container.querySelector('#password-reset-form');
  const currentPassInput = container.querySelector('#settings-current-pass');
  const newPassInput = container.querySelector('#settings-new-pass');
  const confirmPassInput = container.querySelector('#settings-confirm-pass');
  const togglePassBtn = container.querySelector('#settings-toggle-pass-btn');

  const ruleLength = container.querySelector('#settings-rule-length');
  const ruleComplexity = container.querySelector('#settings-rule-complexity');
  const ruleMatch = container.querySelector('#settings-rule-match');
  const alertBanner = container.querySelector('#settings-password-alert');

  togglePassBtn?.addEventListener('click', () => {
    if (!newPassInput) return;
    const isPass = newPassInput.type === 'password';
    newPassInput.type = isPass ? 'text' : 'password';
    if (confirmPassInput) confirmPassInput.type = isPass ? 'text' : 'password';
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

    if (ruleLength) {
      if (hasMinLen) {
        ruleLength.classList.add('valid');
        ruleLength.textContent = '✔️ At least 8 characters long';
        ruleLength.style.color = 'var(--accent-emerald)';
      } else {
        ruleLength.classList.remove('valid');
        ruleLength.textContent = '❌ At least 8 characters long';
        ruleLength.style.color = 'var(--text-muted)';
      }
    }

    if (ruleComplexity) {
      if (hasComplex) {
        ruleComplexity.classList.add('valid');
        ruleComplexity.textContent = '✔️ Mix of uppercase, lowercase, numbers & symbols (or 5-7 word passphrase)';
        ruleComplexity.style.color = 'var(--accent-emerald)';
      } else {
        ruleComplexity.classList.remove('valid');
        ruleComplexity.textContent = '❌ Mix of uppercase, lowercase, numbers & symbols (or 5-7 word passphrase)';
        ruleComplexity.style.color = 'var(--text-muted)';
      }
    }

    if (ruleMatch) {
      if (isMatch) {
        ruleMatch.classList.add('valid');
        ruleMatch.textContent = '✔️ New password and Confirm password match';
        ruleMatch.style.color = 'var(--accent-emerald)';
      } else {
        ruleMatch.classList.remove('valid');
        ruleMatch.textContent = '❌ New password and Confirm password must match';
        ruleMatch.style.color = 'var(--text-muted)';
      }
    }
  };

  newPassInput?.addEventListener('input', validateRealtime);
  confirmPassInput?.addEventListener('input', validateRealtime);

  passForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPass = currentPassInput?.value || '';
    const newPass = newPassInput?.value || '';
    const confirmPass = confirmPassInput?.value || '';

    if (!currentPass || !newPass || !confirmPass) return;

    if (newPass !== confirmPass) {
      showAlert(alertBanner, '❌ New passwords do not match. Please re-enter.', 'error');
      return;
    }

    if (!state.changePassword) {
      showAlert(alertBanner, '❌ Password change feature unavailable in state.', 'error');
      return;
    }

    const result = await state.changePassword(currentPass, newPass);
    if (result.success) {
      showAlert(alertBanner, '🎉 ' + result.message, 'success');
      currentPassInput.value = '';
      newPassInput.value = '';
      confirmPassInput.value = '';
      validateRealtime();
      if (window.confetti) {
        window.confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      }
    } else {
      showAlert(alertBanner, '❌ ' + result.message, 'error');
    }
  });

  // Logout Button Handler (At the end)
  const logoutBtn = container.querySelector('#settings-logout-btn');
  logoutBtn?.addEventListener('click', () => {
    if (onLogout) onLogout();
  });
}

function showAlert(el, msg, type = 'error') {
  if (!el) return;
  el.classList.remove('hidden');
  el.textContent = msg;
  if (type === 'success') {
    el.style.background = 'rgba(16, 185, 129, 0.15)';
    el.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    el.style.color = '#10b981';
  } else {
    el.style.background = 'rgba(244, 63, 94, 0.15)';
    el.style.border = '1px solid rgba(244, 63, 94, 0.3)';
    el.style.color = '#f43f5e';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
