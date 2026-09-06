import type { Metadata } from 'next';
import './globals.css';
import './studio.css';
import { assetPath } from '@/lib/paths';
export const metadata: Metadata = {
  title: 'NFT Studio by BEACN — Create on Cardano',
  description:
    'Create fully on-chain art, music, games, useful apps, Ledger Scrolls and Ledger Books. Build, preview and sign with your Cardano wallet.',
  icons: { icon: assetPath('/brand/beacn-64.png') },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
