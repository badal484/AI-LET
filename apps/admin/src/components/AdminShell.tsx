'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';

export const AdminShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [isOmnibarOpen, setIsOmnibarOpen] = useState(false);
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOmnibarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoginPage) {
    return <main>{children}</main>;
  }

  return (
    <div className="admin-layout">
      <Sidebar onOpenOmnibar={() => setIsOmnibarOpen(true)} />
      <div className="admin-content-area">
        <Header onOpenOmnibar={() => setIsOmnibarOpen(true)} />
        <main className="admin-main">{children}</main>
      </div>
      <CommandPalette isOpen={isOmnibarOpen} onClose={() => setIsOmnibarOpen(false)} />
    </div>
  );
};
