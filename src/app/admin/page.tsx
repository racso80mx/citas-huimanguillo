'use client';
import { useState } from 'react';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { LoginForm } from '@/components/admin/login-form';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {!isAuthenticated ? (
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      ) : (
        <AdminDashboard onLogout={handleLogout} />
      )}
    </div>
  );
}
