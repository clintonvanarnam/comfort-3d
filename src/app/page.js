// app/page.js

"use client";
import dynamic from 'next/dynamic';

// Dynamically import the heavy ThreeScene client component and disable SSR
const ThreeScene = dynamic(() => import('@/components/ThreeScene'), {
  ssr: false,
  // Small loading placeholder while the 3D scene loads
  loading: () => <div style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Loading…</div>
});

export default function Home() {
  // Keep the page lightweight on first paint; ThreeScene will hydrate after JS loads
  return <ThreeScene />;
}