'use client';
import { useState, useTransition } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import type { VaccineAppointment, Patient, AppointmentStatus } from '@/lib/definitions';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Trash2, Pencil, Baby, ShieldPlus, Loader2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { EditPatientForm } from '../admin/edit-patient-form';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { updateAppointmentStatus, rescheduleAppointment } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '../ui/calendar';


type VaccineAppointmentListProps = {
  appointments: VaccineAppointment[];
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  onEditSuccess?: () => void;
};

export function VaccineAppointmentList({ appointments, isAdmin = false, onDelete, onEditSuccess }: VaccineAppointmentListProps) {
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isUpdating, startUpdateTransition] = useTransition();
  const [reschedulingAppointment, setReschedulingAppointment] = useState<VaccineAppointment | null>(null);
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [isRescheduling, startRescheduleTransition] = useTransition();
  const { toast } = useToast();

  const handleStatusChange = (appointmentId: string, status: AppointmentStatus) => {
    startUpdateTransition(async () => {
      const result = await updateAppointmentStatus(appointmentId, status, 'vaccine');
      if (result.success) {
        toast({ title: 'Estado actualizado' });
        onEditSuccess?.();
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    });
  };

  const handleRescheduleConfirm = () => {
    if (!reschedulingAppointment || !newDate) return;

    startRescheduleTransition(async () => {
        const result = await rescheduleAppointment(reschedulingAppointment.id, newDate.toISOString(), 'vaccine');
        if (result.success) {
            toast({
                title: 'Cita Reagendada',
                description: result.message,
            });
            setReschedulingAppointment(null);
            setNewDate(undefined);
            onEditSuccess?.();
        } else {
            toast({
                title: 'Error al Reagendar',
                description: result.message,
                variant: 'destructive',
            });
        }
    });
  };

  if (!appointments || appointments.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No hay citas de vacunación para el filtro seleccionado.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="border rounded-lg">
      <Table>
        <TableCaption>
          Un total de {appointments.length} citas de vacunación agendadas.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead className="w-[120px]">Fecha / Hora</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead>CURP</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Vacunas</TableHead>
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
              <TableCell className="flex items-center">
                {app.patient ? `${app.patient.name} ${app.patient.paternalLastName}` : 'N/A'}
                {app.isNewborn && <Baby className="h-4 w-4 ml-2 text-blue-500" />}
              </TableCell>
              <TableCell>{app.patient?.curp || 'N/A'}</TableCell>
              <TableCell>{app.patient?.phoneNumber || 'N/A'}</TableCell>
              <TableCell>
                 <Tooltip>
                    <TooltipTrigger asChild>
                       <Button variant="ghost" size="icon">
                           <ShieldPlus className="h-4 w-4" />
                       </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className='font-bold mb-2'>Vacunas Solicitadas:</p>
                        <ul className='list-disc pl-4'>
                            {app.vaccines.map(vaccine => <li key={vaccine.id}>{vaccine.name}</li>)}
                        </ul>
                    </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                {onEditSuccess ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-28" disabled={isUpdating}>
                        {app.status || 'Agendada'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => handleStatusChange(app.id, 'Atendido')}>Atendido</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleStatusChange(app.id, 'No Atendido')}>No Atendido</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleStatusChange(app.id, 'No Asistió')}>No Asistió</DropdownMenuItem>
                      <DropdownMenuSeparator />
                       <DropdownMenuItem onSelect={() => {
                          setNewDate(new Date(app.date));
                          setReschedulingAppointment(app);
                      }}>Cambiar Fecha</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  app.status || 'Agendada'
                )}
              </TableCell>
               {isAdmin && app.patient && (
                <TableCell className="text-right">
                  <div className='flex justify-end items-center'>
                    <Button variant="ghost" size="icon" onClick={() => setEditingPatient(app.patient)}>
                        <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>
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
                            Esta acción no se puede deshacer. Se eliminará permanentemente la cita de vacunación de
                            <span className='font-bold'>{app.patient ? ` ${app.patient.name} ${app.patient.paternalLastName} ` : 'este paciente '}</span>
                            ({app.appointmentNumber}).
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
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
       {editingPatient && (
        <Dialog open={!!editingPatient} onOpenChange={(open) => !open && setEditingPatient(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Paciente</DialogTitle>
                    <DialogDescription>
                        Modifica los datos del paciente. Los cambios se reflejarán en todas sus citas.
                    </DialogDescription>
                </DialogHeader>
                <EditPatientForm 
                    patient={editingPatient} 
                    onFinished={() => { 
                        setEditingPatient(null); 
                        onEditSuccess?.(); 
                    }} 
                />
            </DialogContent>
        </Dialog>
      )}
      {reschedulingAppointment && (
        <Dialog open={!!reschedulingAppointment} onOpenChange={(open) => {
            if (!open) {
                setReschedulingAppointment(null);
                setNewDate(undefined);
            }
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reagendar Cita</DialogTitle>
                    <DialogDescription>
                        Selecciona una nueva fecha para la cita de <span className="font-bold">{reschedulingAppointment.patient.name}</span>.
                        El sistema asignará la misma hora o la más próxima disponible.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center py-4">
                    <Calendar
                        mode="single"
                        selected={newDate}
                        onSelect={setNewDate}
                        initialFocus
                        disabled={{ before: new Date() }}
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setReschedulingAppointment(null)}>Cancelar</Button>
                    <Button onClick={handleRescheduleConfirm} disabled={isRescheduling || !newDate}>
                        {isRescheduling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Nueva Fecha
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
    </TooltipProvider>
  );
}
