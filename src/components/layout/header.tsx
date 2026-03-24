'use client';

import Link from 'next/link';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import type { ModuleSettings } from '@/lib/definitions';

export function SiteHeader({ moduleSettings }: { moduleSettings: ModuleSettings }) {
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname === '/') return 'Inicio';
    if (pathname === '/citas-medicas') return 'Citas Médicas';
    if (pathname === '/laboratorio') return 'Laboratorio';
    if (pathname === '/rayos-x') return 'Rayos X';
    if (pathname === '/ultrasonidos') return 'Ultrasonidos';
    if (pathname === '/vacunas') return 'Vacunación';
    if (pathname === '/archivo') return 'Archivo';
    if (pathname === '/archivo-consulta') return 'Consulta de Padrón';
    if (pathname === '/farmacia') return 'Farmacia';
    if (pathname === '/bi') return 'Inteligencia de Negocios';
    if (pathname === '/reports') return 'Reportes';
    if (pathname === '/admin') return 'Administración';
    return '';
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2">
          <div className="text-primary hidden sm:block">
            <Image
              src={logoBase64}
              alt="Logo"
              width={32}
              height={32}
              className="rounded-md"
            />
          </div>
          <span className="font-bold font-headline text-lg hidden md:block">
            CitaMedicaFacil
          </span>
        </Link>
        <span className="text-muted-foreground text-sm font-medium ml-2 md:ml-4 border-l pl-4 hidden sm:block">
          {getPageTitle()}
        </span>
      </div>
      <div className="flex flex-1 items-center justify-end">
        {/* Espacio para elementos adicionales a la derecha si es necesario */}
      </div>
    </header>
  );
}
