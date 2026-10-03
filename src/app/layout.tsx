import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Nav } from '@/components/nav';
import { getSessionProfile } from '@/lib/auth/session';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CafeCorp — Cafeteria POS',
  description: 'Order, kitchen ticket, and billing for small cafeterias.',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const profile = await getSessionProfile();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav profile={profile} />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
