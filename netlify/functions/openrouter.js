// Retain a defined response for this inactive endpoint instead of an empty function.
export default async function openrouter() {
  return new Response(JSON.stringify({ error: 'This endpoint is no longer available.' }), {
    status: 410,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
