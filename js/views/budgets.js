/* ==========================================================================
   FinPulse AI - Smart Budgets & Goals View
   ========================================================================== */

import { state } from '../state.js';
import { formatCurrency, CATEGORY_META } from '../utils.js';

export function renderBudgetsView(container, openGoalModal) {
  const currency = state.getCurrency();
  const totals = state.getTotals();
  const limits = state.getBudgetLimits();
  const goals = state.getSavingsGoals();

  container.innerHTML = `
    <!-- Category Budgets Section -->
    <div class="glass-card mb-3">
      <div class="chart-header">
        <div class="chart-title-wrap">
          <h3>Category Spending Limits & Caps</h3>
          <p>Real-time budget tracking against monthly thresholds</p>
        </div>
      </div>

      <div class="grid-2-equal" style="margin-bottom: 0;">
        ${Object.keys(limits).map(category => {
          const limit = limits[category];
          const actual = totals.actualByCategory[category] || 0;
          const percentage = Math.min(100, Math.round((actual / limit) * 100));
          const meta = CATEGORY_META[category] || CATEGORY_META['Miscellaneous'];

          let statusClass = 'text-emerald';
          let barBg = 'linear-gradient(90deg, #10b981, #059669)';
          let statusText = 'Safe';

          if (percentage >= 100) {
            statusClass = 'text-rose';
            barBg = 'linear-gradient(90deg, #f43f5e, #e11d48)';
            statusText = 'Limit Exceeded';
          } else if (percentage >= 75) {
            statusClass = 'text-amber';
            barBg = 'linear-gradient(90deg, #f59e0b, #d97706)';
            statusText = 'Warning Threshold';
          }

          return `
            <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                  <div style="width: 34px; height: 34px; border-radius: 8px; background: ${meta.bg}; color: ${meta.color}; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="${meta.icon}" style="width: 18px; height: 18px;"></i>
                  </div>
                  <div>
                    <h4 style="font-size: 0.95rem; font-weight: 700;">${category}</h4>
                    <span style="font-size: 0.75rem;" class="${statusClass}">${statusText} (${percentage}%)</span>
                  </div>
                </div>

                <div style="text-align: right;">
                  <div style="font-weight: 800; font-size: 1.05rem;">${formatCurrency(actual, currency)}</div>
                  <div class="text-muted" style="font-size: 0.75rem;">Limit: ${formatCurrency(limit, currency)}</div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="health-bar-track" style="height: 8px; margin-bottom: 0.75rem;">
                <div class="health-bar-fill" style="width: ${percentage}%; background: ${barBg};"></div>
              </div>

              <!-- Update Limit Inline -->
              <div style="display: flex; justify-content: flex-end; align-items: center; gap: 0.5rem;">
                <span class="text-muted" style="font-size: 0.75rem;">Edit Cap:</span>
                <input type="number" class="custom-input budget-limit-input" data-category="${category}" value="${limit}" style="width: 90px; padding: 0.2rem 0.5rem; font-size: 0.78rem;">
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Savings Goals Section -->
    <div class="glass-card">
      <div class="chart-header">
        <div class="chart-title-wrap">
          <h3>Savings Goals & Milestones</h3>
          <p>Track your targets and celebrate financial wins</p>
        </div>
      </div>

      <div class="grid-4" style="margin-bottom: 0;">
        ${goals.map(goal => {
          const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const isComplete = pct >= 100;

          return `
            <div style="background: var(--bg-card-hover); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; display: flex; flex-direction: column; justify-space-between;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                  <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(99, 102, 241, 0.15); color: ${goal.color}; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="${goal.icon}" style="width: 20px; height: 20px;"></i>
                  </div>
                  <span style="font-size: 0.75rem; font-weight: 700; color: ${goal.color}; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 12px;">
                    ${pct}% Complete
                  </span>
                </div>

                <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.25rem;">${goal.title}</h4>
                <p class="text-muted" style="font-size: 0.78rem; margin-bottom: 1rem;">Target: ${goal.targetDate}</p>

                <div style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.2rem;">
                  ${formatCurrency(goal.currentAmount, currency)}
                </div>
                <div class="text-muted" style="font-size: 0.78rem; margin-bottom: 0.75rem;">
                  Goal: ${formatCurrency(goal.targetAmount, currency)}
                </div>

                <div class="health-bar-track" style="height: 8px; margin-bottom: 1rem;">
                  <div class="health-bar-fill" style="width: ${pct}%; background: linear-gradient(90deg, ${goal.color}, var(--accent-cyan));"></div>
                </div>
              </div>

              <button class="btn btn-accent deposit-goal-btn" data-id="${goal.id}" style="width: 100%; font-size: 0.8rem; padding: 0.5rem;">
                <i data-lucide="plus-circle" style="width: 16px; height: 16px;"></i>
                <span>Add Funds</span>
              </button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  setTimeout(() => {
    if (window.lucide) window.lucide.createIcons();
  }, 50);

  // Attach inline budget limit change listeners
  document.querySelectorAll('.budget-limit-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const cat = e.target.getAttribute('data-category');
      const val = parseFloat(e.target.value);
      if (val > 0) {
        state.setBudgetLimit(cat, val);
        renderBudgetsView(container, openGoalModal);
      }
    });
  });

  // Attach Goal Deposit Listeners
  document.querySelectorAll('.deposit-goal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const goalId = btn.getAttribute('data-id');
      if (openGoalModal) openGoalModal(goalId);
    });
  });
}
