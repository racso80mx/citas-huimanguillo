'use client';
import { useState } from 'react';
import { PharmacyLoginForm } from '@/components/farmacia/login-form';
import { PharmacyDashboard } from '@/components/farmacia/pharmacy-dashboard';

export default function PageContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
  }

  return (
    <div className="py-8 md:py-12">
      {isAuthenticated ? (
        <div className="container mx-auto px-4">
            <PharmacyDashboard onLogout={handleLogout} />
        </div>
      ) : (
        <div className="container mx-auto px-4">
          <PharmacyLoginForm
            onLoginSuccess={handleLoginSuccess}
          />
        </div>
      )}
    </div>
  );
}
