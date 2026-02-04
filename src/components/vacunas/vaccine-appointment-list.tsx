'use client';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import type { VaccineAppointment, Patient } from '@/lib/definitions';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Trash2, Pencil, Baby } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { EditPatientForm } from '../admin/edit-patient-form';


type VaccineAppointmentListProps = {
  appointments: VaccineAppointment[];
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  onEditSuccess?: () => void;
};

export function VaccineAppointmentList({ appointments, isAdmin = false, onDelete, onEditSuccess }: VaccineAppointmentListProps) {
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  if (!appointments || appointments.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No hay citas de vacunación para el filtro seleccionado.</p>
      </div>
    );
  }

  return (
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
            <TableHead>Vacuna</TableHead>
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
              <TableCell>{app.vaccineName}</TableCell>
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
    </div>
  );
}
