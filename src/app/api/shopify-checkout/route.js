import { NextResponse } from "next/server";

export async function POST(req) {
  const { cart } = await req.json();
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  // incoming cart
  if (!domain || !token) {
    console.error('Missing Shopify credentials', { domain, token });
    return NextResponse.json({ error: "Missing Shopify credentials" }, { status: 500 });
  }
  const lineItems = cart.map((item) => ({ merchandiseId: item.variantId, quantity: item.quantity }));
  // Introspect mutations first so we can provide a clearer error when checkoutCreate isn't available
  const introspectQuery = `query IntrospectMutations { __schema { mutationType { fields { name } } } }`;
  const introspectRes = await fetch(`https://${domain}/api/2023-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query: introspectQuery }),
  });
  const introspectJson = await introspectRes.json().catch(() => null);

  const mutationFields = (introspectJson?.data?.__schema?.mutationType?.fields || []).map((f) => f.name);
  if (!mutationFields.includes('checkoutCreate')) {
  console.warn('checkoutCreate is not present in schema mutations; attempting cartCreate fallback');

    // Attempt Cart API fallback (cartCreate) — returns a checkoutUrl when available
    const cartQuery = `mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
        }
        userErrors { field message }
      }
    }`;

    const cartRes = await fetch(`https://${domain}/api/2023-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query: cartQuery, variables: { input: { lines: lineItems } } }),
    });
  const cartJson = await cartRes.json().catch(() => null);

    const cartObj = cartJson?.data?.cartCreate?.cart;
    if (cartObj?.checkoutUrl) {
      return NextResponse.json({ checkoutUrl: cartObj.checkoutUrl });
    }
    if (cartObj?.id) {
      // No checkoutUrl available, return cart id so client can continue or inspect
      return NextResponse.json({ cartId: cartObj.id, message: 'Cart created but no checkoutUrl returned by Shopify' });
    }

    // If we reach here, cartCreate failed — return introspection + cart response to help debugging
    return NextResponse.json({ error: "Neither checkoutCreate nor cartCreate produced a checkout URL", mutationFields, introspect: introspectJson, cartResponse: cartJson }, { status: 500 });
  }

  const query = `mutation checkoutCreate($input: CheckoutCreateInput!) {
    checkoutCreate(input: $input) {
      checkout {
        id
        webUrl
      }
      userErrors {
        field
        message
      }
    }
  }`;

  const res = await fetch(`https://${domain}/api/2023-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables: { input: { lineItems } } }),
  });
  const json = await res.json();
  const checkout = json.data?.checkoutCreate?.checkout;
  if (checkout?.webUrl) {
    return NextResponse.json({ checkoutUrl: checkout.webUrl });
  }
  console.error('Checkout failed', json);
  return NextResponse.json({ error: "Checkout failed", details: json }, { status: 500 });
}
