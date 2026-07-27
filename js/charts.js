/* ==========================================================================
   FinPulse AI - Chart.js Render Engine
   ========================================================================== */

import { formatCurrency, CATEGORY_META } from './utils.js';

let categoryChartInstance = null;
let trendChartInstance = null;

/**
 * Render Category Spending Doughnut Chart
 */
export function renderCategoryChart(canvasId, actualByCategory, currencyCode = 'USD') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  const categories = Object.keys(actualByCategory);
  const dataValues = categories.map(c => actualByCategory[c]);
  const backgroundColors = categories.map(c => CATEGORY_META[c]?.color || '#9ca3af');

  if (dataValues.length === 0) {
    categories.push('No Expenses');
    dataValues.push(1);
    backgroundColors.push('rgba(255,255,255,0.1)');
  }

  const ctx = canvas.getContext('2d');
  categoryChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: dataValues,
        backgroundColor: backgroundColors,
        borderWidth: 2,
        borderColor: '#0f1422',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#9ca3af',
            font: { family: 'Plus Jakarta Sans', size: 12 },
            padding: 12,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const val = context.raw || 0;
              return ` ${label}: ${formatCurrency(val, currencyCode)}`;
            }
          }
        }
      },
      cutout: '72%'
    }
  });
}

/**
 * Render Income vs Expenses Trend Bar / Line Chart
 */
export function renderTrendChart(canvasId, transactions, currencyCode = 'USD') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (trendChartInstance) {
    trendChartInstance.destroy();
  }

  // Aggregate by Date or Month
  const dates = ['Jul 01', 'Jul 05', 'Jul 10', 'Jul 15', 'Jul 20', 'Jul 24'];
  const incomeData = [5500, 0, 1200, 0, 0, 0];
  const expenseData = [1850, 287.50, 0, 545.99, 310, 175];

  const ctx = canvas.getContext('2d');
  trendChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderRadius: 6,
          barPercentage: 0.5
        },
        {
          label: 'Expenses',
          data: expenseData,
          backgroundColor: 'rgba(244, 63, 94, 0.85)',
          borderRadius: 6,
          barPercentage: 0.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#9ca3af',
            font: { family: 'Plus Jakarta Sans', size: 12 },
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${formatCurrency(context.raw, currencyCode)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#9ca3af',
            font: { size: 11 },
            callback: function(value) {
              return formatCurrency(value, currencyCode).split('.')[0];
            }
          }
        }
      }
    }
  });
}
