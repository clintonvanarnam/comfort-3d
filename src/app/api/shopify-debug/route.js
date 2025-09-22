import { fetchProducts } from '@/lib/shopify';

export async function GET() {
  try {
    const result = await fetchProducts({ first: 10 });
    // result is { products, __errors }
    const products = Array.isArray(result) ? result : result.products || [];
    const errors = result && result.__errors ? result.__errors : null;

  const sample = products.slice(0, 3).map((p) => ({ id: p.id, title: p.title, handle: p.handle, variants: (p.variants || []).map(v=>({ id: v.id, title: v.title, availableForSale: v.availableForSale })) }));

    return new Response(JSON.stringify({ count: products.length, sample, __errors: errors }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
