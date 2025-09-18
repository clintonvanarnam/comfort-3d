"use server";
/**
 * Minimal Shopify Storefront fetch helper.
 * Expects the following env vars to be set on the server:
 * - SHOPIFY_STORE_DOMAIN (e.g. your-shop.myshopify.com)
 * - SHOPIFY_STOREFRONT_ACCESS_TOKEN
 */
export async function fetchProducts({ first = 20 } = {}) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  if (!domain || !token) {
    throw new Error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_ACCESS_TOKEN');
  }

  const query = `query products($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          handle
          title
          descriptionHtml
          images(first: 1) { edges { node { url altText } } }
          variants(first: 10) {
            edges {
              node {
                id
                title
                selectedOptions { name value }
                price { amount currencyCode }
                availableForSale
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetch(`https://${domain}/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({ query, variables: { first } }),
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Shopify Storefront fetch failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  if (json.errors) {
    // surface errors to the server logs
    console.error('Shopify API errors:', json.errors);
  }
  if (json.data?.products?.edges?.length === 0) {
    console.warn('Shopify API: No products returned. Check product status and sales channel.');
  }
  return (json.data?.products?.edges || []).map((e) => {
    const node = e.node;
    return {
      id: node.id,
      handle: node.handle,
      title: node.title,
      descriptionHtml: node.descriptionHtml,
      images: (node.images?.edges || []).map((ie) => ie.node),
      variants: (node.variants?.edges || []).map((ve) => ({
        id: ve.node.id,
        title: ve.node.title,
        selectedOptions: ve.node.selectedOptions || [],
        price: ve.node.price,
        availableForSale: ve.node.availableForSale,
      })),
    };
  });
}
