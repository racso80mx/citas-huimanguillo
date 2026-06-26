
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import type { ModuleSettings } from '@/lib/definitions';
import { cn } from '@/lib/utils';

export function SiteHeader({ moduleSettings }: { moduleSettings: ModuleSettings }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getPageTitle = () => {
    if (!mounted) return '';
    if (pathname === '/') return 'Inicio';
    if (pathname === '/citas-medicas') return 'Citas Médicas';
    if (pathname === '/laboratorio') return 'Laboratorio';
    if (pathname === '/rayos-x') return 'Rayos X';
    if (pathname === '/ultrasonidos') return 'Ultrasonidos';
    if (pathname === '/vacunas') return 'Vacunación';
    if (pathname === '/archivo') return 'Archivo';
    if (pathname === '/archivo-consulta') return 'Consulta de Recursos';
    if (pathname === '/farmacia') return 'Farmacia';
    if (pathname === '/bi') return 'Inteligencia de Negocios';
    if (pathname === '/reports') return 'Reportes';
    if (pathname === '/admin') return 'Administración';
    return '';
  };

  return (
    <header className="sticky top-0 z-40 flex h-56 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div className="flex items-center gap-4 flex-1">
        <Link 
          href="/"
          className="flex items-center gap-4 hover:opacity-80 transition-opacity focus:outline-none text-left"
        >
          <div className="text-primary flex-shrink-0">
            <Image
              src={logoBase64}
              alt="Logo"
              width={192}
              height={192}
              className="rounded-md object-contain"
              priority
            />
          </div>
        </Link>

        {mounted && (
          <span className="text-muted-foreground text-xl font-medium ml-6 border-l-2 pl-8 hidden lg:block">
            {getPageTitle()}
          </span>
        )}
      </div>
    </header>
  );
}
