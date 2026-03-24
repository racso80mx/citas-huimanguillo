'use client';

import Link from 'next/link';
import { Home, LayoutGrid, BarChart3, FlaskConical, Stethoscope, Waves, ShieldPlus, Archive, Pill, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import type { ModuleSettings } from '@/lib/definitions';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function SiteHeader({ moduleSettings }: { moduleSettings: ModuleSettings }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
           <div className="text-primary">
            <Image
                src={logoBase64}
                alt="Logo CitaMedicaFacil"
                width={40}
                height={40}
                className="rounded-md"
            />
          </div>
          <span className="font-bold font-headline sm:inline-block">
            CitaMedicaFacil
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
          {moduleSettings.citasMedicasEnabled && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                'transition-colors shrink-0',
                pathname === '/citas-medicas'
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Link href="/citas-medicas">
                <Home className="h-4 w-4 mr-2" />
                Cita Médica
              </Link>
            </Button>
          )}
          {moduleSettings.laboratorioEnabled && (
           <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              'transition-colors shrink-0',
              pathname === '/laboratorio'
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Link href="/laboratorio">
              <FlaskConical className="h-4 w-4 mr-2" />
              Laboratorio
            </Link>
          </Button>
          )}
          {moduleSettings.rayosXEnabled && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                'transition-colors shrink-0',
                pathname === '/rayos-x'
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Link href="/rayos-x">
                <Stethoscope className="h-4 w-4 mr-2" />
                Rayos X
              </Link>
            </Button>
          )}
          {moduleSettings.ultrasoundEnabled && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                'transition-colors shrink-0',
                pathname === '/ultrasonidos'
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Link href="/ultrasonidos">
                <Waves className="h-4 w-4 mr-2" />
                Ultrasonidos
              </Link>
            </Button>
          )}
           {moduleSettings.vacunasEnabled && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                'transition-colors shrink-0',
                pathname === '/vacunas'
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Link href="/vacunas">
                <ShieldPlus className="h-4 w-4 mr-2" />
                Vacunas
              </Link>
            </Button>
          )}
          {moduleSettings.archivoEnabled && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                'transition-colors shrink-0',
                pathname === '/archivo'
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Link href="/archivo">
                <Archive className="h-4 w-4 mr-2" />
                Archivo
              </Link>
            </Button>
          )}
          {moduleSettings.archivoConsultaEnabled && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                'transition-colors shrink-0',
                pathname === '/archivo-consulta'
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Link href="/archivo-consulta">
                <Search className="h-4 w-4 mr-2" />
                Consulta Padrón
              </Link>
            </Button>
          )}
          {moduleSettings.farmaciaEnabled && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                'transition-colors shrink-0',
                pathname === '/farmacia'
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Link href="/farmacia">
                <Pill className="h-4 w-4 mr-2" />
                Farmacia
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              'transition-colors shrink-0',
              pathname === '/bi'
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Link href="/bi">
              <BarChart3 className="h-4 w-4 mr-2" />
              BI
            </Link>
          </Button>
           <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              'transition-colors shrink-0',
              pathname === '/reports'
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Link href="/reports">
              <BarChart3 className="h-4 w-4 mr-2" />
              Reportes
            </Link>
          </Button>
        </nav>
        <div className="flex flex-1 items-center justify-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className={cn(
                    'transition-colors h-9 w-9',
                    pathname === '/admin'
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Link href="/admin">
                    <LayoutGrid className="h-5 w-5" />
                    <span className="sr-only">Administración</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Administración</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </header>
  );
}
