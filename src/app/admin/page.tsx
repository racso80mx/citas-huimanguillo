'use client';
import { useState } from 'react';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { LoginForm } from '@/components/admin/login-form';

export default function AdminPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const handleSuperAdminLogin = () => {
    setIsSuperAdmin(true);
  };

  const handleLogout = () => {
    setIsSuperAdmin(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {isSuperAdmin ? (
        <AdminDashboard onLogout={handleLogout} />
      ) : (
        <LoginForm onSuperAdminLogin={handleSuperAdminLogin} />
      )}
    </div>
  );
}
