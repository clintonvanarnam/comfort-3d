// src/app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AnimatedLayout from "../components/AnimatedLayout"; // we'll create this next
import SetVh from '../components/SetVh'
import BodyClassSetter from '@/components/BodyClassSetter';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { metadata as siteMetadata } from './metadata';

export const metadata = siteMetadata;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <link rel="icon" type="image/png" href="/favicon.png?v=2" sizes="any" />
  <link rel="icon" href="/fav.png?v=2" type="image/png" />
  <link rel="shortcut icon" href="/favicon.png?v=2" type="image/png" />
  <link rel="apple-touch-icon" href="/favicon.png?v=2" />
  <link rel="icon" type="image/x-icon" href="data:," />
      </head>
      <body>
        {/* Apply font variable classes on the client only to avoid hydration
            mismatches caused by extension-injected body attributes */}
        <BodyClassSetter classes={`${geistSans.variable} ${geistMono.variable}`} />
        <SetVh />
        <AnimatedLayout>{children}</AnimatedLayout>
      </body>
    </html>
  );
}