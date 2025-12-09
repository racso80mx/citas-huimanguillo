'use client';
import { useState, useEffect } from 'react';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { LoginForm } from '@/components/admin/login-form';
import { useAuth } from '@/firebase';
import type { User } from '@/lib/definitions';
import { onAuthStateChanged } from 'firebase/auth';

export default function AdminPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const auth = useAuth();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // We only care if the user is logged in or not, not who they are for this check.
      // SuperAdmin is handled separately.
      if (firebaseUser) {
        setIsSuperAdmin(true); // Treat any logged-in user as having admin-level access for UI purposes
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  const handleSuperAdminLogin = async () => {
    setIsSuperAdmin(true);
  };
  
  const handleLogout = async () => {
    if (auth.currentUser) {
       await auth.signOut();
    }
    setIsSuperAdmin(false);
  };


  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </div>
    );
  }

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
