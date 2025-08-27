import client from '@/lib/sanity';

export async function GET() {
  try {
    const query = `*[_type == "about"][0]{body}`;
    const about = await client.fetch(query);

    const body = about?.body || [];

    return new Response(JSON.stringify({ body }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
