'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AdminShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <main>{children}</main>;
  }

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-content-area">
        <Header />
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
};
