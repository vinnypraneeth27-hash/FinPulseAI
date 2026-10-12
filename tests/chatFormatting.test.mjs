import assert from 'node:assert/strict';
import test from 'node:test';
import { renderChatMarkdown } from '../js/chatFormatting.js';

test('renders advice as separate Markdown ordered and bullet lists', () => {
  const html = renderChatMarkdown(
    '**Your Budget-Saving Plan for October 2026**\n\n' +
    '1. **Review your finances**\n' +
    '   - Monthly income: ₹25,000.\n' +
    '   - Monthly expenses: ₹6,000.\n' +
    '2. **Track progress**\n' +
    '   - Review FinPulse weekly.'
  );

  assert.match(html, /<ol><li><strong>Review your finances<\/strong><ul>/);
  assert.match(html, /<li>Monthly income: ₹25,000\.<\/li>/);
  assert.match(html, /<\/ul><\/li><li><strong>Track progress<\/strong><ul>/);
  assert.match(html, /<li>Review FinPulse weekly\.<\/li>/);
  assert.match(html, /<p><strong>Your Budget-Saving Plan for October 2026<\/strong><\/p>/);
});

test('escapes untrusted content while retaining only supported Markdown formatting', () => {
  const html = renderChatMarkdown('<img src=x onerror=alert(1)>\n**Safe heading**');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /<strong>Safe heading<\/strong>/);
});
