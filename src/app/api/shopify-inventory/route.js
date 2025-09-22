/**
 * POST { variantId }
 * Returns { inventoryQuantity: number|null, availableForSale: boolean|null, errors?: any }
 * Requires env: SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_API_TOKEN (Admin API access). If admin token missing, returns { inventoryQuantity: null }.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const variantId = body?.variantId;
    if (!variantId) return new Response(JSON.stringify({ error: 'variantId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
    if (!domain || !adminToken) {
      // Admin token not configured; return fallback indicating numeric inventory unavailable
      return new Response(JSON.stringify({ inventoryQuantity: null, availableForSale: null, reason: 'missing_admin_token' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const query = `query variant($id: ID!) { productVariant(id: $id) { id inventoryQuantity availableForSale } }`;
    const res = await fetch(`https://${domain}/admin/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminToken,
      },
      body: JSON.stringify({ query, variables: { id: variantId } }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return new Response(JSON.stringify({ error: `Admin API fetch failed: ${res.status} ${text}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const json = await res.json();
    if (json.errors) {
      return new Response(JSON.stringify({ inventoryQuantity: null, availableForSale: null, errors: json.errors }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const variant = json.data?.productVariant || null;
    const inventoryQuantity = typeof variant?.inventoryQuantity === 'number' ? variant.inventoryQuantity : null;
    const availableForSale = typeof variant?.availableForSale === 'boolean' ? variant.availableForSale : null;

    return new Response(JSON.stringify({ inventoryQuantity, availableForSale }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
