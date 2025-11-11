import { BookingClient } from '@/components/booking-client';
import { getAvailability } from '@/lib/actions';

export default async function HomePage() {
  const today = new Date();
  const availability = await getAvailability(
    today.getFullYear(),
    today.getMonth()
  );

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
      <BookingClient initialAvailability={availability} />
    </div>
  );
}
