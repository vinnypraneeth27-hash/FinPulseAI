/* ==========================================================================
   FinPulse AI - Subscription Audit View
   ========================================================================== */

import { state } from '../state.js';
import { formatCurrency } from '../utils.js';

export function renderSubscriptionsView(container) {
  const currency = state.getCurrency();
  const subs = state.getSubscriptions();

  const activeSubs = subs.filter(s => s.status === 'Active');
  const monthlyTotal = activeSubs.reduce((acc, s) => acc + s.amount, 0);
  const annualTotal = monthlyTotal * 12;

  container.innerHTML = `
    <!-- Top Summary Banner -->
    <div class="grid-2 mb-3">
      <div class="glass-card" style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.1));">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <label class="text-muted" style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase;">Active Monthly Subscriptions</label>
            <div style="font-family: 'Outfit', sans-serif; font-size: 2.2rem; font-weight: 800; color: var(--accent-cyan);">
              ${formatCurrency(monthlyTotal, currency)} <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted);">/ month</span>
            </div>
            <p class="text-muted" style="font-size: 0.82rem; margin-top: 0.25rem;">
              Projected annual spend: <strong>${formatCurrency(annualTotal, currency)}</strong> across ${activeSubs.length} active services.
            </p>
          </div>
          <div class="kpi-icon-box" style="width: 60px; height: 60px; background: linear-gradient(135deg, var(--accent-cyan), var(--primary));">
            <i data-lucide="repeat" style="width: 28px; height: 28px;"></i>
          </div>
        </div>
      </div>

      ${activeSubs.length > 0 ? `
        <div class="ai-insight-banner" style="margin-bottom: 0;">
          <div class="banner-ai-avatar">
            <i data-lucide="scissors"></i>
          </div>
          <div class="banner-content">
            <h4 style="color: var(--accent-amber);">AI Subscription Auditor</h4>
            <p>Finny identified recurring services. Deactivating unused subscriptions will boost your annual net savings.</p>
          </div>
        </div>
      ` : `
        <div class="ai-insight-banner" style="margin-bottom: 0; border-color: rgba(16, 185, 129, 0.3);">
          <div class="banner-ai-avatar" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
            <i data-lucide="check-circle-2"></i>
          </div>
          <div class="banner-content">
            <h4 style="color: #10b981;">Subscription Audit Clean</h4>
            <p>All subscription audits are clear! No recurring charges detected for this user.</p>
          </div>
        </div>
      `}
    </div>

    <!-- Subscriptions Table -->
    <div class="glass-card">
      <div class="chart-header">
        <div class="chart-title-wrap">
          <h3>Recurring Subscriptions Ledger</h3>
          <p>Toggle or audit recurring payments</p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Service Name</th>
              <th>Category</th>
              <th>Billing Cycle</th>
              <th>Next Renewal Date</th>
              <th>Cost</th>
              <th>Audit Status</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${subs.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                  <i data-lucide="shield-check" style="width: 40px; height: 40px; margin-bottom: 0.5rem; opacity: 0.5; color: #10b981;"></i>
                  <p>All subscription audits are clear! No recurring charges detected.</p>
                </td>
              </tr>
            ` : subs.map(s => {
              const isActive = s.status === 'Active';
              return `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(99, 102, 241, 0.15); color: var(--primary); display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="repeat" style="width: 18px; height: 18px;"></i>
                      </div>
                      <span style="font-weight: 600;">${s.name}</span>
                    </div>
                  </td>
                  <td class="text-muted">${s.category}</td>
                  <td><span class="category-tag">${s.billingCycle}</span></td>
                  <td class="text-muted">${s.nextBillDate}</td>
                  <td style="font-weight: 700;">${formatCurrency(s.amount, currency)}</td>
                  <td>
                    <span style="font-size: 0.75rem; font-weight: 700; padding: 3px 10px; border-radius: 12px; ${
                      isActive 
                        ? 'background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald);' 
                        : s.status === 'Under Review'
                          ? 'background: rgba(245, 158, 11, 0.15); color: var(--accent-amber);'
                          : 'background: rgba(244, 63, 94, 0.15); color: var(--accent-rose);'
                    }">
                      ${s.status}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <button class="btn ${isActive ? 'btn-secondary' : 'btn-accent'} toggle-sub-btn" data-id="${s.id}" style="font-size: 0.78rem; padding: 0.35rem 0.75rem;">
                      ${isActive ? 'Cancel / Deactivate' : 'Reactivate'}
                    </button>
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
    if (window.lucide) window.lucide.createIcons();
  }, 50);

  // Toggle button listener
  document.querySelectorAll('.toggle-sub-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      state.toggleSubscriptionStatus(id);
      renderSubscriptionsView(container);
    });
  });
}
