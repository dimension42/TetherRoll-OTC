import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Web3Provider from '@/components/providers/Web3Provider';
import Navbar from '@/components/layout/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TetherRoll — Crypto × Fiat Trading',
  description: 'Decentralized OTC trading platform. Secure escrow for Crypto ↔ Fiat and Crypto ↔ Crypto trades.',
  keywords: ['TetherRoll', 'OTC', 'crypto', 'trading', 'escrow', 'defi', 'bitcoin', 'ethereum'],
  openGraph: {
    title: 'TetherRoll',
    description: 'Secure On-Chain OTC Trading',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className={`${inter.className} min-h-full`} style={{ background: '#080808' }}>
        <Web3Provider>
          <Navbar />
          <main>{children}</main>
        </Web3Provider>
      </body>
    </html>
  );
}
