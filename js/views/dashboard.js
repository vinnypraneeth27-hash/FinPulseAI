/* ==========================================================================
   FinPulse AI - Dashboard View
   ========================================================================== */

import { state } from '../state.js';
import { formatCurrency, formatDate, CATEGORY_META } from '../utils.js';
import { renderCategoryChart, renderTrendChart } from '../charts.js';

export function renderDashboardView(container) {
  const currency = state.getCurrency();
  const totals = state.getTotals();
  const recentTxs = state.getTransactions().slice(0, 5);

  container.innerHTML = `
    <!-- Top KPI Row -->
    <div class="grid-4">
      <div class="glass-card kpi-card" style="--kpi-glow: rgba(99, 102, 241, 0.2);">
        <div class="kpi-info">
          <label>Total Balance</label>
          <div class="kpi-value">${formatCurrency(totals.netSavings, currency)}</div>
          <div class="kpi-trend positive">
            <i data-lucide="trending-up"></i>
            <span>+${totals.savingsRate.toFixed(1)}% savings rate</span>
          </div>
        </div>
        <div class="kpi-icon-box" style="background: linear-gradient(135deg, #6366f1, #4f46e5);">
          <i data-lucide="wallet"></i>
        </div>
      </div>

      <div class="glass-card kpi-card" style="--kpi-glow: rgba(16, 185, 129, 0.2);">
        <div class="kpi-info">
          <label>Monthly Income</label>
          <div class="kpi-value text-emerald">${formatCurrency(totals.totalIncome, currency)}</div>
          <div class="kpi-trend positive">
            <i data-lucide="arrow-up-right"></i>
            <span>2 Income streams</span>
          </div>
        </div>
        <div class="kpi-icon-box" style="background: linear-gradient(135deg, #10b981, #059669);">
          <i data-lucide="arrow-down-left"></i>
        </div>
      </div>

      <div class="glass-card kpi-card" style="--kpi-glow: rgba(244, 63, 94, 0.2);">
        <div class="kpi-info">
          <label>Total Spent</label>
          <div class="kpi-value text-rose">${formatCurrency(totals.totalExpenses, currency)}</div>
          <div class="kpi-trend negative">
            <i data-lucide="arrow-down-right"></i>
            <span>${Object.keys(totals.actualByCategory).length} Active Categories</span>
          </div>
        </div>
        <div class="kpi-icon-box" style="background: linear-gradient(135deg, #f43f5e, #e11d48);">
          <i data-lucide="credit-card"></i>
        </div>
      </div>

      <div class="glass-card kpi-card" style="--kpi-glow: rgba(6, 182, 212, 0.2);">
        <div class="kpi-info">
          <label>AI Health Score</label>
          <div class="kpi-value text-cyan">${totals.healthScore} <span style="font-size: 0.9rem; font-weight: 500;">/ 100</span></div>
          <div class="kpi-trend neutral">
            <i data-lucide="sparkles"></i>
            <span>Optimal trajectory</span>
          </div>
        </div>
        <div class="kpi-icon-box" style="background: linear-gradient(135deg, #06b6d4, #0891b2);">
          <i data-lucide="activity"></i>
        </div>
      </div>
    </div>

    <!-- AI Anomaly Alert Banner -->
    <div class="ai-insight-banner">
      <div class="banner-ai-avatar">
        <i data-lucide="bot"></i>
      </div>
      <div class="banner-content">
        <h4>Finny AI Insight & Forecast</h4>
        <p>You have saved <strong>${formatCurrency(totals.netSavings, currency)}</strong> this month! Food & Dining spending is at <strong>85%</strong> of your monthly limit. I recommend reducing dining out by ${formatCurrency(50, currency)} to reach your Kyoto Vacation savings goal 12 days faster.</p>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid-2">
      <div class="glass-card">
        <div class="chart-header">
          <div class="chart-title-wrap">
            <h3>Income vs Expense Cash Flow</h3>
            <p>Bi-weekly financial trajectory</p>
          </div>
        </div>
        <div class="chart-body">
          <canvas id="trendChartCanvas"></canvas>
        </div>
      </div>

      <div class="glass-card">
        <div class="chart-header">
          <div class="chart-title-wrap">
            <h3>Expense Breakdown</h3>
            <p>Spending distribution by category</p>
          </div>
        </div>
        <div class="chart-body">
          <canvas id="categoryChartCanvas"></canvas>
        </div>
      </div>
    </div>

    <!-- Recent Activity Section -->
    <div class="glass-card">
      <div class="chart-header">
        <div class="chart-title-wrap">
          <h3>Recent Activity Feed</h3>
          <p>Latest logged transactions</p>
        </div>
        <button id="dash-view-all-tx" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.85rem;">
          View All Transactions
        </button>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Date</th>
              <th>Payment Method</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${recentTxs.map(t => {
              const meta = CATEGORY_META[t.category] || CATEGORY_META['Miscellaneous'];
              return `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <div style="width: 36px; height: 36px; border-radius: 10px; background: ${meta.bg}; color: ${meta.color}; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="${meta.icon}" style="width: 18px; height: 18px;"></i>
                      </div>
                      <span style="font-weight: 600;">${t.title}</span>
                    </div>
                  </td>
                  <td><span class="category-tag"><span style="width: 8px; height: 8px; border-radius: 50%; background: ${meta.color};"></span>${t.category}</span></td>
                  <td class="text-muted">${formatDate(t.date)}</td>
                  <td class="text-muted">${t.paymentMethod}</td>
                  <td class="${t.type === 'income' ? 'tx-amount income' : 'tx-amount expense'}">
                    ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount, currency)}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Render Charts after DOM injection
  setTimeout(() => {
    renderCategoryChart('categoryChartCanvas', totals.actualByCategory, currency);
    renderTrendChart('trendChartCanvas', state.getTransactions(), currency);
    if (window.lucide) window.lucide.createIcons();
  }, 50);

  // Wire View All button
  document.getElementById('dash-view-all-tx')?.addEventListener('click', () => {
    const txNav = document.querySelector('.nav-item[data-view="transactions"]');
    if (txNav) txNav.click();
  });
}
