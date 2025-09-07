export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const src = searchParams.get('src');
    if (!src) return new Response('missing src', { status: 400 });

    // Proxy the source image directly (no processing)
    const res = await fetch(src);
    if (!res.ok) return new Response('failed to fetch source', { status: 502 });
    const buf = Buffer.from(await res.arrayBuffer());

    const headers = {
      'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      // Keep short caching so developers see changes; in prod you can increase.
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    };

    return new Response(buf, { status: 200, headers });
  } catch (err) {
    return new Response(String(err || 'error'), { status: 500 });
  }
}
