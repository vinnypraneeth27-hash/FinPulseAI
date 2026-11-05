import assert from 'node:assert/strict';
import test from 'node:test';
import openrouter from '../netlify/functions/openrouter.js';

test('inactive OpenRouter endpoint returns a defined unavailable response', async () => {
  const response = await openrouter(new Request('https://example.invalid', { method: 'POST' }));
  assert.equal(response.status, 410);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'This endpoint is no longer available.' });
});
