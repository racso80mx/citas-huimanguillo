import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import type { Appointment, Clinic } from '@/lib/definitions';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from './ui/button';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';


type AppointmentListProps = {
  appointments: Appointment[];
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  clinics: Clinic[];
};

export function AppointmentList({ appointments, isAdmin = false, onDelete, clinics }: AppointmentListProps) {
  if (!appointments || appointments.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No hay citas agendadas para el filtro seleccionado.</p>
      </div>
    );
  }

  const getClinicName = (clinicId: string) => {
    return clinics.find(c => c.id === clinicId)?.name || clinicId;
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableCaption>
          Un total de {appointments.length} citas agendadas.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead className="w-[120px]">Fecha / Hora</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead>CURP</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Núcleo Básico</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
            {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((app) => (
            <TableRow key={app.id}>
              <TableCell className="font-mono">{app.appointmentNumber}</TableCell>
              <TableCell className="font-medium">
                {format(parseISO(app.date), 'dd/MM/yy', { locale: es })}
                <span className='block text-xs text-muted-foreground'>{app.time}</span>
              </TableCell>
              <TableCell>{`${app.patient.name} ${app.patient.paternalLastName}`}</TableCell>
              <TableCell>{app.patient.curp}</TableCell>
              <TableCell>{app.patient.phoneNumber}</TableCell>
              <TableCell>{getClinicName(app.clinicId)}</TableCell>
              <TableCell>{app.patientType}</TableCell>
              <TableCell>{app.status}</TableCell>
               {isAdmin && (
                <TableCell className="text-right">
                   <AlertDialog>
                    <AlertDialogTrigger asChild>
                       <Button variant="ghost" size="icon" disabled={!onDelete}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Se eliminará permanentemente la cita de
                          <span className='font-bold'>{` ${app.patient.name} ${app.patient.paternalLastName} `}</span>
                           ({app.appointmentNumber}) y el espacio quedará libre.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete?.(app.id)} className='bg-destructive hover:bg-destructive/90'>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
