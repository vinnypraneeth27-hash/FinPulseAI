/* ==========================================================================
   FinPulse AI - Transactions View
   ========================================================================== */

import { state } from '../state.js';
import { formatCurrency, formatDate, CATEGORY_META, exportTransactionsToCSV } from '../utils.js';

export function renderTransactionsView(container, openEditModal) {
  const currency = state.getCurrency();

  container.innerHTML = `
    <div class="glass-card mb-3">
      <!-- Toolbar Header -->
      <div class="chart-header" style="flex-wrap: wrap; gap: 1rem;">
        <div class="chart-title-wrap">
          <h3>Transaction Ledger</h3>
          <p>Search, filter, and manage your full financial records</p>
        </div>

        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
          <!-- Search Bar -->
          <div class="input-with-prefix" style="width: 220px;">
            <i data-lucide="search" class="currency-symbol-prefix" style="left: 0.75rem; width: 16px; height: 16px;"></i>
            <input type="text" id="tx-search-input" class="custom-input" placeholder="Search transactions..." style="padding-left: 2.2rem;">
          </div>

          <!-- Category Filter -->
          <select id="tx-filter-category" class="custom-select">
            <option value="ALL">All Categories</option>
            <option value="Food & Dining">Food & Dining</option>
            <option value="Transportation">Transportation</option>
            <option value="Housing & Utilities">Housing & Utilities</option>
            <option value="Shopping & Tech">Shopping & Tech</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Health & Fitness">Health & Fitness</option>
            <option value="Subscriptions">Subscriptions</option>
            <option value="Income">Income</option>
          </select>

          <!-- Type Filter -->
          <select id="tx-filter-type" class="custom-select">
            <option value="ALL">All Types</option>
            <option value="expense">Expenses Only</option>
            <option value="income">Income Only</option>
          </select>

          <!-- CSV Export Button -->
          <button id="tx-export-csv" class="btn btn-secondary" title="Export to CSV">
            <i data-lucide="download"></i>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <!-- Ledger Table -->
      <div class="table-responsive" style="margin-top: 1rem;">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Date</th>
              <th>Payment Method</th>
              <th>Recurring</th>
              <th>Amount</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody id="tx-table-body">
            <!-- Rendered by function -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  function populateTable() {
    const tbody = document.getElementById('tx-table-body');
    if (!tbody) return;

    const query = (document.getElementById('tx-search-input')?.value || '').toLowerCase();
    const selectedCat = document.getElementById('tx-filter-category')?.value || 'ALL';
    const selectedType = document.getElementById('tx-filter-type')?.value || 'ALL';

    let transactions = state.getTransactions();

    // Filters
    if (query) {
      transactions = transactions.filter(t => t.title.toLowerCase().includes(query) || t.paymentMethod.toLowerCase().includes(query));
    }
    if (selectedCat !== 'ALL') {
      transactions = transactions.filter(t => t.category === selectedCat);
    }
    if (selectedType !== 'ALL') {
      transactions = transactions.filter(t => t.type === selectedType);
    }

    if (transactions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            <i data-lucide="inbox" style="width: 40px; height: 40px; margin-bottom: 0.5rem; opacity: 0.5;"></i>
            <p>No transactions found matching your criteria.</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = transactions.map(t => {
      const meta = CATEGORY_META[t.category] || CATEGORY_META['Miscellaneous'];
      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: ${meta.bg}; color: ${meta.color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <i data-lucide="${meta.icon}" style="width: 18px; height: 18px;"></i>
              </div>
              <span style="font-weight: 600;">${t.title}</span>
            </div>
          </td>
          <td><span class="category-tag"><span style="width: 8px; height: 8px; border-radius: 50%; background: ${meta.color};"></span>${t.category}</span></td>
          <td class="text-muted">${formatDate(t.date)}</td>
          <td class="text-muted">${t.paymentMethod}</td>
          <td>
            ${t.recurring && t.recurring !== 'false' 
              ? `<span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-cyan); background: rgba(6, 182, 212, 0.1); padding: 2px 8px; border-radius: 10px;">${t.recurring}</span>` 
              : `<span class="text-muted" style="font-size: 0.8rem;">Single</span>`}
          </td>
          <td class="${t.type === 'income' ? 'tx-amount income' : 'tx-amount expense'}">
            ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount, currency)}
          </td>
          <td style="text-align: right;">
            <div style="display: flex; gap: 0.4rem; justify-content: flex-end;">
              <button class="btn-icon-sm edit-tx-btn" data-id="${t.id}" title="Edit Transaction" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-main); cursor: pointer;">
                <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
              </button>
              <button class="btn-icon-sm delete-tx-btn" data-id="${t.id}" title="Delete Transaction" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(244, 63, 94, 0.3); background: rgba(244, 63, 94, 0.1); color: var(--accent-rose); cursor: pointer;">
                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Attach row event listeners
    tbody.querySelectorAll('.edit-tx-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const tx = state.getTransactions().find(t => t.id === id);
        if (tx && openEditModal) openEditModal(tx);
      });
    });

    tbody.querySelectorAll('.delete-tx-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this transaction record?')) {
          state.deleteTransaction(id);
          populateTable();
        }
      });
    });
  }

  // Initial populate
  setTimeout(() => {
    populateTable();
    if (window.lucide) window.lucide.createIcons();
  }, 50);

  // Attach search & filter listeners
  document.getElementById('tx-search-input')?.addEventListener('input', populateTable);
  document.getElementById('tx-filter-category')?.addEventListener('change', populateTable);
  document.getElementById('tx-filter-type')?.addEventListener('change', populateTable);

  // CSV Export
  document.getElementById('tx-export-csv')?.addEventListener('click', () => {
    exportTransactionsToCSV(state.getTransactions(), currency);
  });
}
