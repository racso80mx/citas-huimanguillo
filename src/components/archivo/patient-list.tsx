'use client';

import { useState, useMemo } from 'react';
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
import { MoreHorizontal, Pencil, Trash2, ToggleLeft, ToggleRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { Patient, PatientStatus } from '@/lib/definitions';
import { PatientStatus as PatientStatusEnum } from '@/lib/definitions';

type PatientListProps = {
  patients: Patient[];
  onEdit: (patient: Patient) => void;
  onDelete: (patientId: string) => void;
  onStatusChange: (patientId: string, newStatus: PatientStatus) => void;
  isSubmitting: boolean;
};

type SortableKeys = 'name' | 'expediente' | 'curp' | 'coloniaName' | 'status';

export function PatientList({ patients, onEdit, onDelete, onStatusChange, isSubmitting }: PatientListProps) {
    
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>(null);

  const sortedPatients = useMemo(() => {
    let sortableItems = [...patients];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: string | number = '';
        let bValue: string | number = '';

        if (sortConfig.key === 'name') {
            aValue = `${a.paternalLastName || ''} ${a.maternalLastName || ''} ${a.name || ''}`.trim();
            bValue = `${b.paternalLastName || ''} ${b.maternalLastName || ''} ${b.name || ''}`.trim();
        } else {
            aValue = (a as any)[sortConfig.key] || '';
            bValue = (b as any)[sortConfig.key] || '';
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [patients, sortConfig]);

  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortableKeys) => {
    if (!sortConfig || sortConfig.key !== key) {
        return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortConfig.direction === 'ascending' ? (
        <ArrowUp className="ml-2 h-4 w-4 text-primary" />
    ) : (
        <ArrowDown className="ml-2 h-4 w-4 text-primary" />
    );
  };
    
  if (patients.length === 0) {
      return <div className="text-center text-muted-foreground py-10">No se encontraron pacientes.</div>
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button variant="ghost" onClick={() => requestSort('name')}>Nombre Completo {getSortIcon('name')}</Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => requestSort('expediente')}>No. Expediente {getSortIcon('expediente')}</Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => requestSort('curp')}>CURP {getSortIcon('curp')}</Button>
            </TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => requestSort('coloniaName')}>Colonia {getSortIcon('coloniaName')}</Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => requestSort('status')}>Estado {getSortIcon('status')}</Button>
            </TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPatients.map((patient) => (
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
