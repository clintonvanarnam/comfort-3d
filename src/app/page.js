// app/page.js

"use client";
import dynamic from 'next/dynamic';
import BodyClassSetter from '@/components/BodyClassSetter';

// Dynamically import the heavy ThreeScene client component and disable SSR
const ThreeScene = dynamic(() => import('@/components/ThreeScene'), {
  ssr: false,
});

export default function Home() {
  // Keep the page lightweight on first paint; ThreeScene will hydrate after JS loads
  return (
    <>
      <BodyClassSetter classes="no-scroll" />
      <ThreeScene />
    </>
  );
}