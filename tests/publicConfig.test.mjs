import assert from 'node:assert/strict';
import test from 'node:test';
import publicConfig from '../netlify/functions/public-config.js';

test('public configuration exposes only browser settings and disables caching', async () => {
  const reads = [];
  globalThis.Netlify = { env: { get(name) {
    reads.push(name);
    return {
      SUPABASE_URL: 'https://example.invalid',
      SUPABASE_PUBLISHABLE_KEY: 'public-test-key'
    }[name];
  } } };
  try {
    const response = await publicConfig(new Request('https://example.invalid'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      supabaseUrl: 'https://example.invalid', supabaseAnonKey: 'public-test-key'
    });
    assert.ok(!reads.includes('SUPABASE_SERVICE_ROLE_KEY'));
  } finally { delete globalThis.Netlify; }
});

test('missing runtime configuration returns a generic error', async () => {
  globalThis.Netlify = { env: { get: () => undefined } };
  try {
    const response = await publicConfig(new Request('https://example.invalid'));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Public connection settings are unavailable.' });
  } finally { delete globalThis.Netlify; }
});

test('public configuration rejects non-GET requests', async () => {
  const response = await publicConfig(new Request('https://example.invalid', { method: 'POST' }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
});
