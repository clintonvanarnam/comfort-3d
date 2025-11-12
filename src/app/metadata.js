// src/app/metadata.js
export const metadata = {
  metadataBase: new URL('https://www.comfortmagazine.world'),
  title: 'COMFORT',
  description: 'COMFORT ideas for a better tomorrow.',
  icons: {
    icon: '/favicon/favicon.ico',
    shortcut: '/favicon/favicon.ico',
    apple: '/favicon/apple-touch-icon.png',
  },
  openGraph: {
    title: 'COMFORT',
    description: 'COMFORT ideas for a better tomorrow.',
    siteName: 'COMFORT',
    type: 'website',
    url: 'https://www.comfortmagazine.world',
    locale: 'en_US',
    // fallback image; use optimized OG image for social sharing
    images: [
      {
        url: 'https://www.comfortmagazine.world/og.png',
        width: 1200,
        height: 630,
        alt: 'COMFORT Magazine - Ideas for a better tomorrow',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'COMFORT',
    description: 'COMFORT ideas for a better tomorrow.',
    images: ['/COMFORT_MAG_LOGO_WHITE.svg'],
  },
};