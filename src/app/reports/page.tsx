'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { getUserByUID, User } from '@/lib/data';
import { LoginForm } from '@/components/admin/login-form';
import { ReportsDashboard } from '@/components/reports/reports-dashboard';

export default function ReportsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const auth = useAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userProfile = await getUserByUID(firebaseUser.uid);
        setUser(userProfile);
      } else {
        setUser(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  const handleLogout = async () => {
    await auth.signOut();
    setUser(null);
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
      {user && (user.role === 'doctor' || user.role === 'admin') ? (
        <ReportsDashboard user={user} onLogout={handleLogout} />
      ) : (
        <LoginForm isReportsPage={true} />
      )}
    </div>
  );
}
