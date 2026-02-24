'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, LogOut, Plus, Upload, Download, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPatients as fetchPatients, deletePatient, updatePatientStatus, savePatient } from '@/lib/actions';
import type { Patient, PatientStatus } from '@/lib/definitions';
import { PatientList } from './patient-list';
import { MassUploadDialog } from './mass-upload-dialog';
import { EditPatientDialog } from './edit-patient-dialog';
import { v4 as uuidv4 } from 'uuid';
import { PatientStatus as PatientStatusEnum } from '@/lib/definitions';

type ArchiveDashboardProps = {
  onLogout: () => void;
};

export function ArchiveDashboard({ onLogout }: ArchiveDashboardProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  
  const [isSubmitting, startSubmitTransition] = useTransition();

  const { toast } = useToast();

  const loadPatients = useCallback(async () => {
    setIsLoading(true);
    try {
      const patientsData = await fetchPatients();
      setPatients(patientsData);
      setFilteredPatients(patientsData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los pacientes.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    const filteredData = patients.filter(item =>
        (item.name?.toLowerCase().includes(lowercasedFilter)) ||
        (item.paternalLastName?.toLowerCase().includes(lowercasedFilter)) ||
        (item.maternalLastName?.toLowerCase().includes(lowercasedFilter)) ||
        (item.curp?.toLowerCase().includes(lowercasedFilter))
    );
    setFilteredPatients(filteredData);
  }, [searchTerm, patients]);
  
  const handleAddNew = () => {
    setEditingPatient(null);
    setIsEditOpen(true);
  };
  
  const handleEdit = (patient: Patient) => {
    setEditingPatient(patient);
    setIsEditOpen(true);
  }
  
  const handleDelete = (patientId: string) => {
    startSubmitTransition(async () => {
      const result = await deletePatient(patientId);
      if(result.success) {
        toast({ title: "Paciente Eliminado", description: "El registro del paciente fue eliminado."});
        await loadPatients();
      } else {
        toast({ title: "Error", description: result.message, variant: 'destructive'});
      }
    });
  }
  
  const handleStatusChange = (patientId: string, newStatus: PatientStatus) => {
    startSubmitTransition(async () => {
      const result = await updatePatientStatus(patientId, newStatus);
       if(result.success) {
        toast({ title: "Estado Actualizado", description: `El estado del paciente ahora es ${newStatus}.`});
        await loadPatients();
      } else {
        toast({ title: "Error", description: result.message, variant: 'destructive'});
      }
    });
  }
  
  const handleSavePatient = (patient: Omit<Patient, 'id'>, id?: string) => {
    startSubmitTransition(async () => {
      const result = await savePatient(patient, id || uuidv4());
       if(result.success) {
        toast({ title: "Paciente Guardado", description: "Los datos se han guardado correctamente." });
        setIsEditOpen(false);
        setEditingPatient(null);
        await loadPatients();
      } else {
        toast({ title: "Error al Guardar", description: result.message, variant: 'destructive' });
      }
    });
  }

  const handleDownload = async () => {
    const xlsx = await import('xlsx');
    const worksheet = xlsx.utils.json_to_sheet(patients);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Pacientes');
    xlsx.writeFile(workbook, 'archivo_pacientes.xlsx');
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-3xl font-bold font-headline">Archivo de Pacientes</CardTitle>
            <CardDescription>Gestión del padrón completo de pacientes.</CardDescription>
          </div>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Salir del Archivo
          </Button>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-grow w-full">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
               <Input 
                placeholder="Buscar por nombre, apellidos o CURP..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
               />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={handleAddNew} className="flex-grow"><Plus className="mr-2 h-4 w-4"/> Agregar Paciente</Button>
              <Button onClick={() => setIsUploadOpen(true)} variant="secondary" className="flex-grow"><Upload className="mr-2 h-4 w-4"/> Carga Masiva</Button>
              <Button onClick={handleDownload} variant="outline" className="flex-grow"><Download className="mr-2 h-4 w-4"/> Descargar Todo</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <PatientList 
                patients={filteredPatients}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                isSubmitting={isSubmitting}
            />
          )}
        </CardContent>
      </Card>
      
      <MassUploadDialog 
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={loadPatients}
      />
      
      {isEditOpen && (
        <EditPatientDialog
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          patient={editingPatient}
          onSave={handleSavePatient}
          isSaving={isSubmitting}
        />
      )}
    </div>
  );
}
