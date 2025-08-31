// src/app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AnimatedLayout from "../components/AnimatedLayout"; // we'll create this next

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Comfort 3D",
  description: "Comfort 3D — immersive, shareable 3D scenes and image carousels.",
  openGraph: {
    title: "Comfort 3D",
    description: "Comfort 3D — immersive, shareable 3D scenes and image carousels.",
    url: "https://your-domain.com",
    siteName: "Comfort 3D",
    images: [
      {
        url: "/globe.svg",
        width: 1200,
        height: 630,
        alt: "Comfort 3D",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Comfort 3D",
    description: "Comfort 3D — immersive, shareable 3D scenes and image carousels.",
    images: ["/globe.svg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
        <AnimatedLayout>{children}</AnimatedLayout>
      </body>
    </html>
  );
}