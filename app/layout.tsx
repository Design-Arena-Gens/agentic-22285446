import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crypto Live Dashboard',
  description: 'Live crypto prices, candlestick patterns, and trade signals',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
