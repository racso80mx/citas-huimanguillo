import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import type { Appointment } from '@/lib/definitions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type AppointmentListProps = {
  appointments: Appointment[];
};

export function AppointmentList({ appointments }: AppointmentListProps) {
  if (!appointments || appointments.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No hay citas agendadas por el momento.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableCaption>
          Un total de {appointments.length} citas agendadas.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Fecha</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead className="hidden md:table-cell">CURP</TableHead>
            <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
            <TableHead className="hidden lg:table-cell">Dirección</TableHead>
            <TableHead className="text-right">Consultorio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((app) => (
            <TableRow key={app.id}>
              <TableCell className="font-medium">
                {format(new Date(app.date), 'dd/MM/yyyy', { locale: es })}
              </TableCell>
              <TableCell>{`${app.nombre} ${app.apellidoPaterno} ${app.apellidoMaterno}`}</TableCell>
              <TableCell className="hidden md:table-cell">{app.curp}</TableCell>
              <TableCell className="hidden lg:table-cell">{app.telefono}</TableCell>
              <TableCell className="hidden lg:table-cell">{`${app.colonia}, ${app.municipio}, ${app.estadoNacimiento}`}</TableCell>
              <TableCell className="text-right">Núcleo Básico {app.consultorio}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
