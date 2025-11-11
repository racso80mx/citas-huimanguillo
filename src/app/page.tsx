import { BookingClient } from '@/components/booking-client';
import { getAvailability, getAnnouncements } from '@/lib/actions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Bell } from 'lucide-react';

export default async function HomePage() {
  const today = new Date();
  // Fetch initial data on the server
  const initialAvailability = await getAvailability(
    today.getFullYear(),
    today.getMonth()
  );
  const initialAnnouncements = await getAnnouncements();

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="text-center mb-8">
        <h1 className="text-4xl lg:text-5xl font-bold font-headline text-foreground">
          Agenda tu Cita Médica
        </h1>
        <p className="text-lg text-muted-foreground mt-2 max-w-2xl mx-auto">
          Un servicio simple y rápido para la comunidad de Huimanguillo,
          Tabasco. Selecciona un día y registra tus datos.
        </p>
      </div>

      <BookingClient
        initialAvailability={initialAvailability}
        initialAnnouncements={initialAnnouncements}
      />
    </div>
  );
}
