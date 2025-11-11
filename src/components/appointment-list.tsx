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
};

export function AppointmentList({ appointments, isAdmin = false, onDelete }: AppointmentListProps) {
  if (!appointments || appointments.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No hay citas agendadas para el filtro seleccionado.</p>
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
            <TableHead>CURP</TableHead>
            <TableHead className="hidden md:table-cell">Sexo</TableHead>
            <TableHead className="hidden md:table-cell">Edad</TableHead>
            <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
            <TableHead className="hidden lg:table-cell">Dirección</TableHead>
            <TableHead>Consultorio</TableHead>
            {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((app) => (
            <TableRow key={app.id}>
              <TableCell className="font-medium">
                {format(parseISO(app.date), 'dd/MM/yyyy', { locale: es })}
              </TableCell>
              <TableCell>{`${app.nombre} ${app.apellidoPaterno} ${app.apellidoMaterno}`}</TableCell>
              <TableCell>{app.curp}</TableCell>
              <TableCell className="hidden md:table-cell">{app.sexo}</TableCell>
              <TableCell className="hidden md:table-cell">{app.edad}</TableCell>
              <TableCell className="hidden lg:table-cell">{app.telefono}</TableCell>
              <TableCell className="hidden lg:table-cell">{`${app.colonia}, ${app.municipio}`}</TableCell>
              <TableCell>Núcleo Básico {app.consultorio}</TableCell>
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
                          <span className='font-bold'>{` ${app.nombre} ${app.apellidoPaterno} `}</span>
                           y el espacio quedará libre.
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
