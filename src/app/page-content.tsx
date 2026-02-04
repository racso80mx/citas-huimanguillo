'use client';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Home, FlaskConical, Stethoscope, Waves, ShieldPlus } from 'lucide-react';
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
  ];

  const enabledModules = allModules.filter(mod => mod.enabled);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="text-center mb-12 flex flex-col items-center">
        <div className="text-primary mb-4">
          <Image
            src={logoBase64}
            alt="Logo CitaMedicaFacil"
            width={90}
            height={90}
            className="rounded-md"
          />
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold font-headline text-foreground">
          Bienvenido a CitaMedicaFacil
        </h1>
        <p className="text-lg text-muted-foreground mt-2 max-w-2xl mx-auto">
          Selecciona el servicio que necesitas y agenda tu cita de forma rápida y sencilla.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
        {enabledModules.map((mod) => (
          <Link href={mod.href} key={mod.href}>
            <Card className="hover:shadow-xl hover:border-primary/50 transition-all duration-300 h-full flex flex-col items-center text-center p-6">
              <CardHeader>
                <div className="mb-4 flex justify-center">{mod.icon}</div>
                <CardTitle className="text-xl font-headline">{mod.title}</CardTitle>
                <CardDescription>{mod.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
         {enabledModules.length === 0 && (
            <div className="col-span-full text-center py-10">
                <p className="text-muted-foreground">No hay módulos de citas activos en este momento. Por favor, contacta al administrador.</p>
            </div>
        )}
      </div>
    </div>
  );
}
