import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import './studio.css';
import './studio-app.css';
import './mobile-shell.css';
import './labs.css';
import './agent-landing.css';
import { assetPath } from '@/lib/paths';
export const metadata: Metadata = {
  title: 'NFT-Studio — Your imagination. Your agent. On-chain.',
  applicationName: 'NFT-Studio',
  description:
    'Teach your agent how to mint. Clone NFT-Studio, open Codex or Claude Code, and turn your ideas into art, games, music and useful NFTs on Cardano.',
  openGraph: {
    title: 'Your imagination. Your agent. On-chain.',
    description:
      'Give your agent the NFT-Studio skill. Then tell it what’s on your mind.',
    url: 'https://beacnpool.github.io/NFT-Studio/',
    siteName: 'NFT-Studio',
    images: [
      {
        url: 'https://beacnpool.github.io/NFT-Studio/agent/imagination.webp',
        width: 1024,
        height: 1024,
        alt: 'An impossible silver and chartreuse sculpture',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NFT-Studio — Your imagination. Your agent. On-chain.',
    description:
      'Teach your agent how to mint. Then tell it what’s on your mind.',
    images: ['https://beacnpool.github.io/NFT-Studio/agent/imagination.webp'],
  },
  icons: { icon: assetPath('/brand/nft-studio.svg') },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f3f1e9',
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
