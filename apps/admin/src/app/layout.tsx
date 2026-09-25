import type { Metadata } from 'next';
import '../styles/globals.css';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { AuthProvider } from '../components/AuthGuard';

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
          <div className="admin-layout">
            <Sidebar />
            <div className="admin-content-area">
              <Header />
              <main className="admin-main">{children}</main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
