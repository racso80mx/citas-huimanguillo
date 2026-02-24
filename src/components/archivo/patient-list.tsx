
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { MoreHorizontal, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Patient, PatientStatus } from '@/lib/definitions';
import { PatientStatus as PatientStatusEnum } from '@/lib/definitions';

type PatientListProps = {
  patients: Patient[];
  onEdit: (patient: Patient) => void;
  onDelete: (patientId: string) => void;
  onStatusChange: (patientId: string, newStatus: PatientStatus) => void;
  isSubmitting: boolean;
};

export function PatientList({ patients, onEdit, onDelete, onStatusChange, isSubmitting }: PatientListProps) {
    
  if (patients.length === 0) {
      return <div className="text-center text-muted-foreground py-10">No se encontraron pacientes.</div>
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre Completo</TableHead>
            <TableHead>No. Expediente</TableHead>
            <TableHead>CURP</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Colonia</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => (
            <TableRow key={patient.id}>
              <TableCell className="font-medium">{`${patient.name || ''} ${patient.paternalLastName || ''} ${patient.maternalLastName || ''}`}</TableCell>
              <TableCell>{patient.expediente || 'N/A'}</TableCell>
              <TableCell>{patient.curp}</TableCell>
              <TableCell>{patient.phoneNumber}</TableCell>
              <TableCell>{patient.coloniaName || 'N/A'}</TableCell>
              <TableCell>
                <Badge variant={patient.status === PatientStatusEnum.Vigente ? 'default' : 'destructive'}>
                  {patient.status || PatientStatusEnum.Vigente}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Abrir menú</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(patient)} disabled={isSubmitting}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    
                     {patient.status === PatientStatusEnum.Vigente ? (
                        <DropdownMenuItem onClick={() => onStatusChange(patient.id, PatientStatusEnum.Baja)} disabled={isSubmitting}>
                           <ToggleLeft className="mr-2 h-4 w-4 text-red-500" />
                            <span>Dar de Baja</span>
                        </DropdownMenuItem>
                     ) : (
                        <DropdownMenuItem onClick={() => onStatusChange(patient.id, PatientStatusEnum.Vigente)} disabled={isSubmitting}>
                            <ToggleRight className="mr-2 h-4 w-4 text-green-500" />
                           <span>Reactivar (Vigente)</span>
                        </DropdownMenuItem>
                     )}
                     
                    <AlertDialog>
                       <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 focus:text-red-600" disabled={isSubmitting}>
                             <Trash2 className="mr-2 h-4 w-4" />
                             Eliminar Permanentemente
                          </DropdownMenuItem>
                       </AlertDialogTrigger>
                       <AlertDialogContent>
                          <AlertDialogHeader>
                             <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                             <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará permanentemente el registro del paciente y no se podrá recuperar.
                             </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                             <AlertDialogCancel>Cancelar</AlertDialogCancel>
                             <AlertDialogAction onClick={() => onDelete(patient.id)} className="bg-destructive hover:bg-destructive/90">
                                Sí, eliminar
                             </AlertDialogAction>
                          </AlertDialogFooter>
                       </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
