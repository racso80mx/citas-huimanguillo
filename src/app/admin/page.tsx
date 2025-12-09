'use client';
import { useState, useEffect } from 'react';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { LoginForm } from '@/components/admin/login-form';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { getUserByUID } from '@/lib/data';
import type { User } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const auth = useAuth();
  const { toast } = useToast();

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
    if (isSuperAdmin) {
        setIsSuperAdmin(false);
    }
    if (user) {
        await auth.signOut();
        setUser(null);
    }
  };
  
  const handleSuperAdminLogin = async (credentials: {email: string, pass: string}) => {
    if (credentials.email === 'SuperAdmin' && credentials.pass === 'Hu1m4ngu1ll0') {
        setIsSuperAdmin(true); 
    }
  }

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </div>
    );
  }
  
  const isAdmin = (user && user.role === 'admin') || isSuperAdmin;


  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {isAdmin ? (
        <AdminDashboard user={user || {id: 'superadmin', name: 'SuperAdmin', email: '', role: 'admin'}} onLogout={handleLogout} />
      ) : (
        <LoginForm onSuperAdminLogin={handleSuperAdminLogin} />
      )}
    </div>
  );
}
