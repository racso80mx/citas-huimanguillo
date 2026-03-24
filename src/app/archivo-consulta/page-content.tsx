'use client';
import { useState } from 'react';
import { ArchiveDashboard } from '@/components/archivo/archive-dashboard';
import { ModuleLoginForm } from '@/components/shared/module-login-form';
import { getModuleSettings } from '@/lib/actions';

export default function PageContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleVerify = async (password: string) => {
    const settings = await getModuleSettings();
    const success = settings.archivoConsultaPassword === password;
    return { 
        success, 
        message: !success ? 'La contraseña de consulta es incorrecta.' : undefined 
    };
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
  }

  return (
    <div className="py-8 md:py-12">
      {isAuthenticated ? (
        <ArchiveDashboard onLogout={handleLogout} isReadOnly={true} />
      ) : (
        <div className="container mx-auto px-4">
          <ModuleLoginForm
            title="Consulta de Padrón"
            description="Acceso de solo lectura al archivo de pacientes. Ingresa la contraseña autorizada."
            onVerify={handleVerify}
            onSuccess={handleLoginSuccess}
          />
        </div>
      )}
    </div>
  );
}
