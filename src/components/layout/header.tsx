'use client';

import Link from 'next/link';
import { useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import type { ModuleSettings } from '@/lib/definitions';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SiteHeader({ moduleSettings }: { moduleSettings: ModuleSettings }) {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

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
      {/* Botón de Inicio (Home) */}
      <Button variant="ghost" size="icon" asChild className="-ml-1 h-9 w-9">
        <Link href="/">
          <Home className="h-5 w-5" />
          <span className="sr-only">Ir al Inicio</span>
        </Link>
      </Button>
      
      <Separator orientation="vertical" className="mr-2 h-4" />
      
      <div className="flex items-center gap-4 flex-1">
        {/* Logo y nombre que también alternan el menú */}
        <button 
          onClick={toggleSidebar}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none text-left"
        >
          <div className="text-primary">
            <Image
              src={logoBase64}
              alt="Logo"
              width={32}
              height={32}
              className="rounded-md"
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold font-headline text-lg text-foreground">
              CitaMedicaFacil
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              Huimanguillo, Tabasco
            </span>
          </div>
        </button>

        <span className="text-muted-foreground text-sm font-medium ml-2 border-l pl-4 hidden md:block">
          {getPageTitle()}
        </span>
      </div>
      
      <div className="flex items-center justify-end">
        {/* Botón dedicado para ocultar/mostrar el menú */}
        <SidebarTrigger className="h-9 w-9" />
      </div>
    </header>
  );
}
