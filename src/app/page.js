// app/page.js

"use client";
import dynamic from 'next/dynamic';

// Dynamically import the heavy ThreeScene client component and disable SSR
const ThreeScene = dynamic(() => import('@/components/ThreeScene'), {
  ssr: false,
});

export default function Home() {
  // Keep the page lightweight on first paint; ThreeScene will hydrate after JS loads
  return <ThreeScene />;
}