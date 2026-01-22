import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Yuki - Your Helpful Accountant',
  description: 'A local-first personal finance tracker that accepts your chaos. Upload receipts, statements, or just tell her about your spending. Yuki organizes everything for you.',
  keywords: ['finance tracker', 'personal finance', 'budgeting', 'receipts', 'expense tracking', 'local-first', 'privacy'],
  authors: [{ name: 'Yuki Team' }],
  openGraph: {
    title: 'Yuki - Your Helpful Accountant',
    description: 'A personal finance tracker that accepts your chaos. Not a guilt machine.',
    images: ['https://raw.githubusercontent.com/porkytheblack/yuki/refs/heads/main/landing/public/og-image.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yuki - Your Helpful Accountant',
    description: 'A personal finance tracker that accepts your chaos. Not a guilt machine.',
    images: [
      "https://raw.githubusercontent.com/porkytheblack/yuki/refs/heads/main/landing/public/og-image.png"
    ]
  },
  icons: {
    icon: '/yuki-icon.png',
    apple: '/yuki-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
