
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
      description: 'Gestión y edición del padrón de pacientes.',
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
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="text-center mb-12 flex flex-col items-center">
        <div className="text-primary mb-8">
          <Image
            src={logoBase64}
            alt="Logo CitaMedicaFacil"
            width={270}
            height={270}
            className="rounded-xl shadow-2xl"
            priority
          />
        </div>
        <h1 className="text-5xl lg:text-6xl font-bold font-headline text-foreground">
          Bienvenido a CitaMedicaFacil
        </h1>
        <p className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
          Selecciona el servicio que necesitas y agenda tu cita de forma rápida y sencilla.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 max-w-7xl mx-auto">
        {enabledModules.map((mod) => (
          <Link href={mod.href} key={mod.href}>
            <Card className="hover:shadow-xl hover:border-primary/50 transition-all duration-300 h-full flex flex-col items-center text-center p-6 bg-card border-primary/10">
              <CardHeader>
                <div className="mb-4 flex justify-center p-4 bg-primary/5 rounded-full">{mod.icon}</div>
                <CardTitle className="text-2xl font-headline">{mod.title}</CardTitle>
                <CardDescription className="text-sm font-medium mt-2">{mod.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
         {enabledModules.length === 0 && (
            <div className="col-span-full text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
                <p className="text-xl font-bold text-muted-foreground">No hay módulos de citas activos en este momento.</p>
                <p className="text-sm text-muted-foreground mt-1">Por favor, contacta al administrador del Hospital.</p>
            </div>
        )}
      </div>
    </div>
  );
}
