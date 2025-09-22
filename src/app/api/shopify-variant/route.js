import { NextResponse } from 'next/server'

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

export async function POST(req) {
  if (!domain || !token) {
    return NextResponse.json({ error: 'Missing store domain or storefront token' }, { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const variantIds = Array.isArray(body?.variantIds) ? body.variantIds : [];
  if (!variantIds.length) return NextResponse.json({ data: {} });

  // Build GraphQL nodes query
  const query = `query nodes($ids: [ID!]!) { nodes(ids: $ids) { __typename ... on ProductVariant { id title sku priceV2 { amount currencyCode } product { id title handle images(first:1) { edges { node { url altText } } } } } } }`;

  try {
    const res = await fetch(`https://${domain}/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query, variables: { ids: variantIds } }),
    });
    const json = await res.json().catch(() => null);
    const nodes = json?.data?.nodes || [];
    const map = {};
    for (const n of nodes) {
      if (!n || n.__typename !== 'ProductVariant') continue;
      const image = n.product?.images?.edges?.[0]?.node;
      map[n.id] = {
        variantTitle: n.title,
        sku: n.sku,
        priceAmount: n.priceV2 ? Number(n.priceV2.amount) : null,
        priceCurrency: n.priceV2 ? n.priceV2.currencyCode : null,
        productTitle: n.product?.title || null,
        productHandle: n.product?.handle || null,
        image: image ? { url: image.url, altText: image.altText } : null,
      };
    }
    return NextResponse.json({ data: map });
  } catch (err) {
    return NextResponse.json({ error: 'Fetch failed', detail: String(err) }, { status: 500 });
  }
}
