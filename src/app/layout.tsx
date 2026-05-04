import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/context/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'ELECTAI Election Assistant',
  description: 'Verified step-by-step voter guidance powered by Google Civic Information data.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
