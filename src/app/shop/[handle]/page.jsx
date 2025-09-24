import React from 'react';
import { fetchProductByHandle } from '../../../../src/lib/shopify';
import NavBar from '@/components/NavBar';
import ProductPage from '../../../../src/components/ProductPage';

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const { product } = await fetchProductByHandle(handle);
  const title = product ? `COMFORT | ${product.title}` : 'COMFORT | Product';
  return {
    title,
  };
}

export default async function ProductDetailPage({ params }) {
  const { handle } = await params;
  const { product, __errors } = await fetchProductByHandle(handle);
  if (!product) {
    return <div style={{ padding: 40 }}>Product not found.</div>;
  }

  return (
    <>
      <NavBar />
      <div style={{ padding: '40px var(--site-gutter)' }}>
        <ProductPage product={product} />
        {__errors && <pre style={{ marginTop: 12, color: '#900' }}>{JSON.stringify(__errors, null, 2)}</pre>}
      </div>
    </>
  );
}
