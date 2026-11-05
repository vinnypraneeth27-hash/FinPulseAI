// Only browser-safe Supabase settings belong in this response.
export default async function publicConfig(request) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET' } });
  }

  const supabaseUrl = Netlify.env.get('SUPABASE_URL');
  const supabaseAnonKey = Netlify.env.get('SUPABASE_PUBLISHABLE_KEY') || Netlify.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Public connection settings are unavailable.' }), {
      status: 503, headers
    });
  }

  return new Response(JSON.stringify({ supabaseUrl, supabaseAnonKey }), { headers });
}
