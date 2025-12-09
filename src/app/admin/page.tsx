'use client';
import { useState, useEffect } from 'react';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { LoginForm } from '@/components/admin/login-form';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { getUserByUID, User } from '@/lib/data';
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
        try {
            // Attempt to sign in with a pre-configured admin account to get permissions.
            // Replace with your actual admin credentials stored securely.
            // This is a simplified approach for this context.
            // A more secure approach would use a custom token system.
            await signInWithEmailAndPassword(auth, 'admin@citamedica.com', 'AdminPass123!');
            setIsSuperAdmin(true); // Keep this to differentiate the login method if needed
        } catch (error) {
            console.error("SuperAdmin shadow login failed:", error);
            toast({
                title: "Error de inicio de sesión de administrador",
                description: "No se pudieron obtener los permisos de administrador. Verifica la cuenta de administrador preconfigurada.",
                variant: "destructive",
            });
        }
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
        <LoginForm onSuperAdminLogin={handleSuperAdminLogin} isReportsPage={false} />
      )}
    </div>
  );
}
