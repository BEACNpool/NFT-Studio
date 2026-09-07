import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import './studio.css';
import './studio-app.css';
import './mobile-shell.css';
import { assetPath } from '@/lib/paths';
export const metadata: Metadata = {
  title: 'NFT-Studio — Create on Cardano',
  applicationName: 'NFT-Studio',
  description:
    'Create fully on-chain art, music, games, useful apps, Ledger Scrolls and Ledger Books. Build, preview and sign with your Cardano wallet.',
  icons: { icon: assetPath('/brand/nft-studio.svg') },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0d0d12',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <Script
          src={assetPath('/studio-navigation.js')}
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
