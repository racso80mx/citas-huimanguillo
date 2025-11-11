import { AppointmentList } from '@/components/appointment-list';
import { getAppointments } from '@/lib/actions';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';

export default async function AdminPage() {
  const appointments = await getAppointments();

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <Card className="w-full max-w-6xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold font-headline">
            Reporte de Citas
          </CardTitle>
          <CardDescription>
            Visualización de todas las citas agendadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppointmentList appointments={appointments} />
        </CardContent>
      </Card>
    </div>
  );
}
