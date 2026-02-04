'use client';

import Link from 'next/link';
import { Home, LayoutGrid, BarChart3, FlaskConical, Stethoscope, Waves, ShieldPlus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import type { ModuleSettings } from '@/lib/definitions';

export function SiteHeader({ moduleSettings }: { moduleSettings: ModuleSettings }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
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
        <nav className="flex items-center gap-1 sm:gap-2">
          {moduleSettings.citasMedicasEnabled && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                'transition-colors',
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
              'transition-colors',
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
                'transition-colors',
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
                'transition-colors',
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
                'transition-colors',
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
           <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              'transition-colors',
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
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              'transition-colors',
              pathname === '/admin'
                ? 'text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Link href="/admin">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Administración
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
