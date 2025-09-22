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
  const apiErrors = json.errors || null;
  if (apiErrors) {
    // Use warn instead of error to avoid Next's overlay in dev.
    console.warn('Shopify API returned errors (check response):', apiErrors);
  }
  if (json.data?.products?.edges?.length === 0) {
    console.warn('Shopify API: No products returned. Check product status and sales channel.');
  }
  const products = (json.data?.products?.edges || []).map((e) => {
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
  // Attach API errors to the returned object so callers can inspect without throwing.
  return { products, __errors: apiErrors };
}

export async function fetchProductByHandle(handle) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  if (!domain || !token) {
    throw new Error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_ACCESS_TOKEN');
  }

  const query = `query productByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      handle
      title
      descriptionHtml
      images(first: 10) { edges { node { url altText } } }
      variants(first: 50) {
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
  }`;

  const res = await fetch(`https://${domain}/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({ query, variables: { handle } }),
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Shopify Storefront fetch failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const apiErrors = json.errors || null;
  if (apiErrors) {
    console.warn('Shopify API returned errors (check response):', apiErrors);
  }

  const node = json.data?.productByHandle;
  if (!node) return { product: null, __errors: apiErrors };

  const product = {
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

  return { product, __errors: apiErrors };
}
