// src/app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AnimatedLayout from "../components/AnimatedLayout"; // we'll create this next
import SetVh from '../components/SetVh'
import BodyClassSetter from '@/components/BodyClassSetter';



import { metadata as siteMetadata } from './metadata';

export const metadata = siteMetadata;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=3" sizes="any" />
        <link rel="icon" href="/favicon.ico?v=3" type="image/x-icon" />
        <link rel="shortcut icon" href="/favicon.ico?v=3" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/favicon.ico?v=3" />
        <link rel="icon" type="image/x-icon" href="data:," />
      </head>
      <body>
        {/* Apply font variable classes on the client only to avoid hydration
            mismatches caused by extension-injected body attributes */}
      
        <SetVh />
        <AnimatedLayout>{children}</AnimatedLayout>
      </body>
    </html>
  );
}