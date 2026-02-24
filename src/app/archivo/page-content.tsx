'use client';
import { useState } from 'react';
import { ArchiveLoginForm } from '@/components/archivo/login-form';
import { ArchiveDashboard } from '@/components/archivo/archive-dashboard';

export default function PageContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {isAuthenticated ? (
        <ArchiveDashboard onLogout={handleLogout} />
      ) : (
        <ArchiveLoginForm
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
