import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PDX Deliciousness Finder',
  description: 'Find and track your favorite Portland restaurants',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
