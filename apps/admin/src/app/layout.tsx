import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = { title: 'Lovira admin', robots: { index: false, follow: false } };

// Applies the saved theme before paint (dark unless the admin chose light), so there's no flash.
const themeScript = `try{if(localStorage.getItem('theme')!=='light')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
