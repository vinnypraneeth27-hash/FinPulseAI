/* ==========================================================================
   FinPulse AI - Simulated AI Receipt Scanner View
   ========================================================================== */

import { state } from '../state.js';
import { formatCurrency } from '../utils.js';

const SAMPLE_RECEIPTS = [
  {
    id: 'rec-1',
    merchant: 'Whole Foods Market',
    amount: 142.85,
    category: 'Food & Dining',
    date: '2026-07-24',
    paymentMethod: 'Apple Pay / Wallet',
    items: ['Organic Almond Milk - $4.99', 'Wild Caught Salmon Fillet - $24.50', 'Fresh Organic Avocados - $6.99', 'Artisan Sourdough Bread - $5.50']
  },
  {
    id: 'rec-2',
    merchant: 'Apple Store 5th Ave',
    amount: 129.00,
    category: 'Shopping & Tech',
    date: '2026-07-23',
    paymentMethod: 'Credit Card',
    items: ['MagSafe Battery Pack - $99.00', 'USB-C Fast Charging Cable - $29.00']
  },
  {
    id: 'rec-3',
    merchant: 'Starbucks Reserve Roastery',
    amount: 18.75,
    category: 'Food & Dining',
    date: '2026-07-24',
    paymentMethod: 'Debit Card',
    items: ['Draft Oat Milk Latte - $7.50', 'Iced Americano - $5.25', 'Butter Croissant - $6.00']
  },
  {
    id: 'rec-4',
    merchant: 'Shell Energy Station',
    amount: 55.40,
    category: 'Transportation',
    date: '2026-07-22',
    paymentMethod: 'Credit Card',
    items: ['V-Power Nitro+ Fuel (12.4 Gal) - $55.40']
  }
];

export function renderScannerView(container) {
  const currency = state.getCurrency();

  container.innerHTML = `
    <div class="grid-2">
      <!-- Left Column: Dropzone & Scan Controls -->
      <div class="glass-card">
        <div class="chart-header">
          <div class="chart-title-wrap">
            <h3>AI Optical Receipt OCR Scanner</h3>
            <p>Scan receipts to auto-extract merchant, total, date, and category</p>
          </div>
        </div>

        <!-- Scanner Dropzone Container -->
        <div id="scanner-dropzone" class="scanner-dropzone">
          <div class="laser-line" id="laser-line"></div>
          
          <div id="dropzone-idle">
            <div class="logo-icon-wrap" style="width: 56px; height: 56px; margin: 0 auto 1rem; background: linear-gradient(135deg, var(--accent-cyan), var(--primary));">
              <i data-lucide="scan" style="width: 28px; height: 28px;"></i>
            </div>
            <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.4rem;">Drop Receipt Image Here</h4>
            <p class="text-muted" style="font-size: 0.82rem; margin-bottom: 1.25rem;">Supports PNG, JPG, PDF receipt documents</p>
            <button id="browse-file-btn" class="btn btn-secondary" style="font-size: 0.82rem;">Browse Local File</button>
          </div>

          <div id="dropzone-scanning" style="display: none; padding: 2rem 0;">
            <div class="logo-icon-wrap" style="width: 56px; height: 56px; margin: 0 auto 1rem; background: linear-gradient(135deg, var(--accent-cyan), var(--primary)); animation: pulse-glow 1.5s infinite;">
              <i data-lucide="cpu" style="width: 28px; height: 28px;"></i>
            </div>
            <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 0.4rem;">AI OCR Engine Analyzing...</h4>
            <p class="text-muted" style="font-size: 0.85rem;">Extracting merchant metadata, line items, and taxes...</p>
          </div>
        </div>

        <div style="margin-top: 1.5rem;">
          <label class="text-muted" style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 0.75rem;">
            Or Select a Demo Receipt to Scan:
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            ${SAMPLE_RECEIPTS.map(r => `
              <button class="pill-btn sample-receipt-btn" data-id="${r.id}" style="text-align: left; padding: 0.6rem 0.85rem; border-radius: var(--radius-md);">
                <div style="font-weight: 700; font-size: 0.85rem;">${r.merchant}</div>
                <div class="text-muted" style="font-size: 0.75rem;">${formatCurrency(r.amount, currency)} • ${r.category}</div>
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Right Column: Extracted Receipt Data & Confirmation Form -->
      <div class="glass-card">
        <div class="chart-header">
          <div class="chart-title-wrap">
            <h3>Extracted Data Verification</h3>
            <p>Review AI-extracted fields before confirming to ledger</p>
          </div>
        </div>

        <div id="ocr-results-empty" style="text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
          <i data-lucide="file-text" style="width: 44px; height: 44px; margin-bottom: 0.75rem; opacity: 0.4;"></i>
          <p>Select or upload a receipt to trigger AI extraction.</p>
        </div>

        <form id="ocr-confirm-form" class="modal-body" style="display: none; padding: 0;">
          <div class="ai-insight-banner" style="margin-bottom: 1rem; padding: 0.85rem 1rem;">
            <i data-lucide="check-circle-2" class="text-emerald" style="width: 22px; height: 22px; flex-shrink: 0;"></i>
            <div style="font-size: 0.82rem;">
              <strong>99.4% OCR Confidence Match!</strong> Extracted 4 line items successfully.
            </div>
          </div>

          <div class="form-group">
            <label>Merchant Name</label>
            <input type="text" id="ocr-merchant" class="custom-input" required>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Amount</label>
              <div class="input-with-prefix">
                <span class="currency-symbol-prefix">$</span>
                <input type="number" id="ocr-amount" step="0.01" class="custom-input" required>
              </div>
            </div>

            <div class="form-group">
              <label>Category</label>
              <select id="ocr-category" class="custom-input" required>
                <option value="Food & Dining">Food & Dining</option>
                <option value="Transportation">Transportation</option>
                <option value="Housing & Utilities">Housing & Utilities</option>
                <option value="Shopping & Tech">Shopping & Tech</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Health & Fitness">Health & Fitness</option>
                <option value="Subscriptions">Subscriptions</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Date</label>
              <input type="date" id="ocr-date" class="custom-input" required>
            </div>

            <div class="form-group">
              <label>Payment Method</label>
              <input type="text" id="ocr-payment" class="custom-input" required>
            </div>
          </div>

          <div class="form-group">
            <label>Line Items Parsed</label>
            <div id="ocr-line-items" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.75rem; font-size: 0.8rem; color: var(--text-muted);">
              <!-- Line items listed here -->
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-glow" style="width: 100%; margin-top: 0.5rem;">
            <i data-lucide="check"></i>
            <span>Confirm & Add Transaction</span>
          </button>
        </form>
      </div>
    </div>
  `;

  setTimeout(() => {
    if (window.lucide) window.lucide.createIcons();
  }, 50);

  function triggerScan(sample) {
    const laser = document.getElementById('laser-line');
    const idleView = document.getElementById('dropzone-idle');
    const scanView = document.getElementById('dropzone-scanning');
    const emptyResults = document.getElementById('ocr-results-empty');
    const form = document.getElementById('ocr-confirm-form');

    if (!laser || !idleView || !scanView) return;

    idleView.style.display = 'none';
    scanView.style.display = 'block';
    laser.classList.add('scanning');

    setTimeout(() => {
      laser.classList.remove('scanning');
      scanView.style.display = 'none';
      idleView.style.display = 'block';

      // Populate Form
      emptyResults.style.display = 'none';
      form.style.display = 'flex';

      document.getElementById('ocr-merchant').value = sample.merchant;
      document.getElementById('ocr-amount').value = sample.amount;
      document.getElementById('ocr-category').value = sample.category;
      document.getElementById('ocr-date').value = sample.date;
      document.getElementById('ocr-payment').value = sample.paymentMethod;

      const itemsWrap = document.getElementById('ocr-line-items');
      itemsWrap.innerHTML = sample.items.map(it => `<div style="padding: 2px 0;">• ${it}</div>`).join('');

      if (window.lucide) window.lucide.createIcons();
    }, 1200);
  }

  // Attach Sample Clickers
  document.querySelectorAll('.sample-receipt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const sample = SAMPLE_RECEIPTS.find(r => r.id === id);
      if (sample) triggerScan(sample);
    });
  });

  // Browse file button trigger
  document.getElementById('browse-file-btn')?.addEventListener('click', () => {
    // Pick random sample for browse trigger
    const randomSample = SAMPLE_RECEIPTS[Math.floor(Math.random() * SAMPLE_RECEIPTS.length)];
    triggerScan(randomSample);
  });

  // Confirm Form Submit
  document.getElementById('ocr-confirm-form')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const tx = {
      type: 'expense',
      title: document.getElementById('ocr-merchant').value,
      amount: parseFloat(document.getElementById('ocr-amount').value),
      category: document.getElementById('ocr-category').value,
      date: document.getElementById('ocr-date').value,
      paymentMethod: document.getElementById('ocr-payment').value,
      recurring: 'false'
    };

    state.addTransaction(tx);

    alert(`Successfully logged scanned transaction from "${tx.title}" (${formatCurrency(tx.amount, currency)})!`);
    
    // Reset view
    renderScannerView(container);
  });
}
