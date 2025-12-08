import { BookingClient } from '@/components/booking-client';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="text-primary mb-4">
           <Image
            src={logoBase64}
            alt="Logo Hospital Huimanguillo"
            width={80}
            height={80}
            className="rounded-md"
          />
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold font-headline text-foreground">
          Agenda tu Cita Médica
        </h1>
        <p className="text-lg text-muted-foreground mt-2 max-w-2xl mx-auto">
          Un servicio simple y rápido para la comunidad de Huimanguillo.
          Selecciona un día, tu colonia, un horario y registra tus datos.
        </p>
      </div>

      <BookingClient />
    </div>
  );
}
