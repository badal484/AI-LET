import type { Metadata } from 'next';
import '../styles/globals.css';
import { AuthProvider } from '../components/AuthGuard';
import { AdminShell } from '../components/AdminShell';

export const metadata: Metadata = {
  title: 'AI Companion Operations Console',
  description: 'Production administration dashboard for AI Companion Platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AdminShell>{children}</AdminShell>
        </AuthProvider>
      </body>
    </html>
  );
}
