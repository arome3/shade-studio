import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/components/providers/providers';
import { Header } from '@/components/layout/header';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Private Grant Studio',
    template: '%s | Private Grant Studio',
  },
  description:
    'Privacy-first AI workspace for Web3 builders on NEAR Protocol. Securely manage grant proposals with end-to-end encryption and zero-knowledge proofs.',
  keywords: [
    'NEAR Protocol',
    'Web3',
    'grants',
    'privacy',
    'encryption',
    'AI',
    'proposals',
    'blockchain',
    'zero-knowledge proofs',
  ],
  authors: [{ name: 'Private Grant Studio Team' }],
  creator: 'Private Grant Studio',
  publisher: 'Private Grant Studio',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://private-grant-studio.near.page',
    siteName: 'Private Grant Studio',
    title: 'Private Grant Studio',
    description:
      'Privacy-first AI workspace for Web3 builders on NEAR Protocol',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Private Grant Studio',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Private Grant Studio',
    description:
      'Privacy-first AI workspace for Web3 builders on NEAR Protocol',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0F1419',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
