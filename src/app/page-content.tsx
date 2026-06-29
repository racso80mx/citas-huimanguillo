
'use client';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Home, FlaskConical, Stethoscope, Waves, ShieldPlus, Archive, Pill, Search, Package } from 'lucide-react';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import type { ModuleSettings } from '@/lib/definitions';

export default function HomePageContent({ moduleSettings }: { moduleSettings: ModuleSettings }) {
  const allModules = [
    {
      title: 'Cita Médica General',
      description: 'Agenda una consulta en tu núcleo básico.',
      href: '/citas-medicas',
      icon: <Home className="h-10 w-10 text-primary" />,
      enabled: moduleSettings.citasMedicasEnabled,
    },
    {
      title: 'Laboratorio',
      description: 'Agenda una cita para tus estudios de laboratorio.',
      href: '/laboratorio',
      icon: <FlaskConical className="h-10 w-10 text-primary" />,
      enabled: moduleSettings.laboratorioEnabled,
    },
    {
      title: 'Rayos X',
      description: 'Agenda una cita para tus estudios de radiografía.',
      href: '/rayos-x',
      icon: <Stethoscope className="h-10 w-10 text-primary" />,
      enabled: moduleSettings.rayosXEnabled,
    },
    {
      title: 'Ultrasonidos',
      description: 'Agenda una cita para tus estudios de ultrasonido.',
      href: '/ultrasonidos',
      icon: <Waves className="h-10 w-10 text-primary" />,
      enabled: moduleSettings.ultrasoundEnabled,
    },
     {
      title: 'Vacunación',
      description: 'Agenda una cita para la aplicación de vacunas.',
      href: '/vacunas',
      icon: <ShieldPlus className="h-10 w-10 text-primary" />,
      enabled: moduleSettings.vacunasEnabled,
    },
    {
      title: 'Archivo (Gestión)',
      description: 'Gestión e edición del padrón de pacientes.',
      href: '/archivo',
      icon: <Archive className="h-10 w-10 text-primary" />,
      enabled: moduleSettings.archivoEnabled,
    },
    {
      title: 'Consulta de Recursos',
      description: 'Revisión de padrón e inventario (Solo Lectura).',
      href: '/archivo-consulta',
      icon: <Search className="h-10 w-10 text-primary" />,
      enabled: moduleSettings.archivoConsultaEnabled,
    },
    {
      title: 'Farmacia',
      description: 'Gestión de inventario de medicamentos.',
      href: '/farmacia',
      icon: <Pill className="h-10 w-10 text-primary" />,
      enabled: moduleSettings.farmaciaEnabled,
    },
    {
      title: 'Almacén',
      description: 'Gestión de inventario de insumos generales.',
      href: '/almacen',
      icon: <Package className="h-10 w-10 text-primary" />,
      enabled: moduleSettings.almacenEnabled,
    },
  ];

  const enabledModules = allModules.filter(mod => mod.enabled);

  return (
    <div className="w-full p-0 m-0">
      <div className="text-center mb-6 flex flex-col items-center pt-8">
        <div className="text-primary mb-4">
          <Image
            src={logoBase64}
            alt="Logo Hospital"
            width={270}
            height={270}
            className="rounded-xl shadow-lg"
            priority
          />
        </div>
        <h1 className="text-4xl font-bold font-headline text-foreground tracking-tighter uppercase px-4">
          Bienvenido al Portal Hospitalario
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl mx-auto font-medium px-4">
          Huimanguillo, Tabasco. Selecciona el servicio que necesitas.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 w-full border-t border-l">
        {enabledModules.map((mod) => (
          <Link href={mod.href} key={mod.href} className="w-full">
            <Card className="hover:bg-primary/5 transition-all duration-300 h-full flex flex-col items-center text-center p-8 bg-card border-r border-b rounded-none group shadow-none">
              <CardHeader className="p-0">
                <div className="mb-4 flex justify-center p-4 bg-primary/5 rounded-full group-hover:bg-primary/10 transition-colors">{mod.icon}</div>
                <CardTitle className="text-xl font-headline font-bold uppercase">{mod.title}</CardTitle>
                <CardDescription className="text-sm font-medium mt-1 leading-tight">{mod.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
         {enabledModules.length === 0 && (
            <div className="col-span-full text-center py-20 bg-muted/20 border-2 border-dashed mx-4 rounded-3xl mt-4">
                <p className="text-xl font-bold text-muted-foreground">No hay módulos de citas activos en este momento.</p>
                <p className="text-sm text-muted-foreground mt-1">Por favor, contacta al administrador del Hospital.</p>
            </div>
        )}
      </div>
    </div>
  );
}
