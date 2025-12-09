'use client';
import { useState, useEffect } from 'react';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { LoginForm } from '@/components/admin/login-form';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { getUserByUID, User } from '@/lib/data';

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
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
    if (isSuperAdmin) {
        setIsSuperAdmin(false);
    }
    if (user) {
        await auth.signOut();
        setUser(null);
    }
  };
  
  const handleSuperAdminLogin = (credentials: {email: string, pass: string}) => {
    if (credentials.email === 'SuperAdmin' && credentials.pass === 'Hu1m4ngu1ll0') {
      setIsSuperAdmin(true);
      setUser({
        id: 'superadmin',
        email: 'superadmin@local.com',
        name: 'Super Administrador',
        role: 'admin',
      });
    }
  }

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </div>
    );
  }
  
  const isAdmin = user && user.role === 'admin';


  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {isAdmin ? (
        <AdminDashboard user={user} onLogout={handleLogout} />
      ) : (
        <LoginForm onSuperAdminLogin={handleSuperAdminLogin}/>
      )}
    </div>
  );
}
