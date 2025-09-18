import { fetchProducts } from "@/lib/shopify";
import NavBar from "@/components/NavBar";
import ShopCartWrapper from "@/components/ShopCartWrapper";

export default async function Page() {
  let products = [];
  try {
    products = await fetchProducts({ first: 24 });
  } catch (err) {
    console.error('shop-fetch-error', err);
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
