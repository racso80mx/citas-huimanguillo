'use client';
import { useState, useEffect } from 'react';
import { BIDashboard } from '@/components/bi/dashboard';
import { BILoginForm } from '@/components/bi/bi-login-form';
import { getBIData } from '@/lib/actions';
import { Loader2 } from 'lucide-react';

export default function PageContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [biData, setBiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSuccess = async () => {
    setIsLoading(true);
    try {
        const data = await getBIData();
        setBiData(data);
        setIsAuthenticated(true);
    } catch (e) {
        console.error("Error fetching BI data", e);
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
    setBiData(null);
  }

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium">Analizando datos del hospital...</p>
        </div>
    );
  }

  return (
    <div className="py-8 md:py-12">
      {isAuthenticated && biData ? (
        <BIDashboard initialData={biData} onLogout={handleLogout} />
      ) : (
        <div className="container mx-auto px-4">
          <BILoginForm
            onLoginSuccess={handleLoginSuccess}
          />
        </div>
      )}
    </div>
  );
}
