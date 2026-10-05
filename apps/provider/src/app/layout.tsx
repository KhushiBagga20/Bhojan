import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Atkinson_Hyperlegible_Next, Fraunces } from 'next/font/google';
import { tokensCss } from '@/lib/tokens-css';
import { Providers } from './providers';
import './globals.css';

const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin'], weight: ['600'] });
const atkinson = Atkinson_Hyperlegible_Next({
  variable: '--font-atkinson',
  subsets: ['latin'],
  weight: ['400', '700'],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: 'Bhojan for Kitchens',
  description: "Manage your tiffin service: today's orders, menus, meal plans and customers.",
};

export const viewport: Viewport = {
  themeColor: '#FBF7F2',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${atkinson.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: tokensCss() }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
