'use client';
import { useState, useEffect } from 'react';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { LoginForm } from '@/components/admin/login-form';
import { useAuth } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function AdminPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const auth = useAuth();
  
  // This effect will check if a user (any user, including anonymous) is authenticated.
  // We need an auth session to be active for Firestore security rules to pass.
  useEffect(() => {
    if (!auth) {
        // If auth service is not ready, we keep loading.
        setIsAuthLoading(true);
        return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // As soon as we know there's a user (even anonymous), we can proceed.
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  const handleSuperAdminLogin = () => {
    setIsSuperAdmin(true);
  };
  
  const handleLogout = () => {
    // This doesn't sign out of Firebase, it just resets the UI state
    // to show the login form again. The anonymous session persists.
    setIsSuperAdmin(false);
  };

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando y estableciendo sesión...</p>
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
