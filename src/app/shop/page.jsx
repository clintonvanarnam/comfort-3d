import { fetchProducts } from "@/lib/shopify";
import NavBar from "@/components/NavBar";
import ShopCartWrapper from "@/components/ShopCartWrapper";

export const metadata = {
  title: 'COMFORT | SHOP',
};

export default async function Page() {
  let products = [];
  try {
    // Fetch from a specific collection that store owners can manually sort in Shopify admin
    const collectionHandle = process.env.SHOPIFY_COLLECTION_HANDLE || 'all';
    
    const result = await fetchProducts({ first: 24, collectionHandle });
    // fetchProducts now returns { products, __errors }
    products = Array.isArray(result) ? result : result.products || [];
    if (result && result.__errors) {
      console.warn('Shopify fetch returned errors:', result.__errors);
    }
  } catch (err) {
    console.warn('shop-fetch-error', err);
  }

  return (
    <>
      <NavBar />
      <main className="shop-page">
        {products.length === 0 ? (
          <div className="shop-instructions">No products found. Ensure SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_ACCESS_TOKEN are set.</div>
        ) : (
          <ShopCartWrapper products={products} />
        )}
      </main>
    </>
  );
}
