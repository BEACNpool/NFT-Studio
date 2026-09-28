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
  title: 'NFT-Studio — The MCP NFT creator for your AI agent',
  applicationName: 'NFT-Studio',
  description:
    'Teach your agent how to mint. Clone NFT-Studio, open Codex or Claude Code, and turn your ideas into art, games, music and useful NFTs on Cardano.',
  openGraph: {
    title: 'NFT-Studio — The MCP NFT creator for your AI agent',
    description:
      'Create art, games and utility with Codex or Claude Code. Preview and mint with your browser wallet.',
    url: 'https://beacnpool.github.io/NFT-Studio/',
    siteName: 'NFT-Studio',
    images: [
      {
        url: 'https://beacnpool.github.io/NFT-Studio/social/make-your-own-nft-v2.png',
        width: 1200,
        height: 630,
        alt: 'Make Your Own by BEACN — the mintable NFT artwork featured on the NFT-Studio homepage.',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NFT-Studio — The MCP NFT creator for your AI agent',
    description:
      'Create art, games and utility with your AI agent. Preview and mint with your browser wallet.',
    images: [
      'https://beacnpool.github.io/NFT-Studio/social/make-your-own-nft-v2.png',
    ],
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
