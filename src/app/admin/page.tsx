'use client';
import { useState, useEffect } from 'react';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { LoginForm } from '@/components/admin/login-form';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const { auth } = initializeFirebase();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);


  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  if (isAuthLoading) {
      return (
          <div className="flex items-center justify-center min-h-screen">
              <p>Cargando...</p>
          </div>
      )
  }

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
