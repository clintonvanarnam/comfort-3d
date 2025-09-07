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