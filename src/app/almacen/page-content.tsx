'use client';
import { useState } from 'react';
import { WarehouseLoginForm } from '@/components/almacen/login-form';
import { WarehouseDashboard } from '@/components/almacen/warehouse-dashboard';

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
            <WarehouseDashboard onLogout={handleLogout} />
        </div>
      ) : (
        <div className="container mx-auto px-4">
          <WarehouseLoginForm
            onLoginSuccess={handleLoginSuccess}
          />
        </div>
      )}
    </div>
  );
}
