
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
    if (pathname === '/archivo-consulta') return 'Consulta de Recursos';
    if (pathname === '/farmacia') return 'Farmacia';
    if (pathname === '/bi') return 'Inteligencia de Negocios';
    if (pathname === '/reports') return 'Reportes';
    if (pathname === '/admin') return 'Administración';
    return '';
  };

  return (
    <header className="sticky top-0 z-40 flex h-20 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <div className="flex items-center gap-4 flex-1">
        <Link 
          href="/"
          className="flex items-center gap-4 hover:opacity-80 transition-opacity focus:outline-none text-left"
        >
          <div className="text-primary">
            <Image
              src={logoBase64}
              alt="Logo"
              width={96}
              height={96}
              className="rounded-md"
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold font-headline text-2xl text-foreground">
              CitaMedicaFacil
            </span>
            <span className="text-sm text-muted-foreground font-medium">
              Huimanguillo, Tabasco
            </span>
          </div>
        </Link>

        <span className="text-muted-foreground text-lg font-medium ml-4 border-l pl-6 hidden md:block">
          {getPageTitle()}
        </span>
      </div>
    </header>
  );
}
