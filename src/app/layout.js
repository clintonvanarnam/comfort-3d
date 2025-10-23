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
        <meta name="google-site-verification" content="QI7EAmc1fOQivVRwSwWAbzMAnuJ6dqLzWp4-UBTNqOI" />
        <link rel="icon" href="/favicon/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon/favicon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="icon" href="/favicon/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/favicon/apple-touch-icon.png" />
        <link rel="icon" href="/favicon/android-chrome-192x192.png" sizes="192x192" type="image/png" />
        <link rel="icon" href="/favicon/android-chrome-512x512.png" sizes="512x512" type="image/png" />
      </head>
      <body suppressHydrationWarning={true}>
        {/* Apply font variable classes on the client only to avoid hydration
            mismatches caused by extension-injected body attributes */}
      
        <SetVh />
        <AnimatedLayout>{children}</AnimatedLayout>
      </body>
    </html>
  );
}