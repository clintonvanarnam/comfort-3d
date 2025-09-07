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
import { halftone } from '@/lib/halftone';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const src = searchParams.get('src');
    if (!src) return new Response('missing src', { status: 400 });

    const cell = Number(searchParams.get('cell') || 8);
    const angle = Number(searchParams.get('angle') || 45);
    const ink = searchParams.get('ink') || '#070061';
    const bg = searchParams.get('bg') || '#ffffff';
    const width = Number(searchParams.get('width') || 1600);
    const nocache = searchParams.get('nocache') === '1';

    // Debug log for dev
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[halftone] request', { src, cell, angle, ink, bg, width, nocache });
    }

    // Fetch source image
    const res = await fetch(src);
    if (!res.ok) return new Response('failed to fetch source', { status: 502 });
    const buffer = Buffer.from(await res.arrayBuffer());

    const out = await halftone(buffer, { cell, angle, ink, bg, width });

    const headers = {
      'Content-Type': 'image/webp'
    };
    if (process.env.NODE_ENV === 'production' && !nocache) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else {
      // in dev or when nocache=1 we avoid long caching to see updates immediately
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }
  // Echo the params for debugging in response headers
  headers['X-Halftone-Ink'] = String(ink || '');
  headers['X-Halftone-Cell'] = String(cell);
  headers['X-Halftone-Angle'] = String(angle);
  headers['X-Halftone-Width'] = String(width);

    return new Response(out, { status: 200, headers });
  } catch (err) {
    return new Response(String(err || 'error'), { status: 500 });
  }
}
