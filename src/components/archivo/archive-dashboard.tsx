'use client';

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, LogOut, Plus, Upload, Download, Search, Users, UserCheck, History, UserX, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPatients as fetchPatients, deletePatient, updatePatientStatus, savePatient } from '@/lib/actions';
import type { Patient, PatientStatus } from '@/lib/definitions';
import { PatientList } from './patient-list';
import { MassUploadDialog } from './mass-upload-dialog';
import { EditPatientDialog } from './edit-patient-dialog';
import { v4 as uuidv4 } from 'uuid';
import { PatientStatus as PatientStatusEnum } from '@/lib/definitions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { differenceInYears, parseISO } from 'date-fns';


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
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  
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
    const searchKeywords = searchTerm.toLowerCase().split(' ').filter(kw => kw);

    if (searchKeywords.length === 0) {
      setFilteredPatients(patients);
      setCurrentPage(1);
      return;
    }

    const filteredData = patients.filter(patient => {
      const searchableString = [
        patient.name,
        patient.paternalLastName,
        patient.maternalLastName,
        patient.curp
      ].filter(Boolean).join(' ').toLowerCase();

      return searchKeywords.every(keyword => searchableString.includes(keyword));
    });
    
    setFilteredPatients(filteredData);
    setCurrentPage(1); // Reset to first page on search
  }, [searchTerm, patients]);

  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredPatients.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredPatients, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredPatients.length / rowsPerPage);

  const summary = useMemo(() => {
    if (!patients || patients.length === 0) {
      return { total: 0, vigentes: 0, bajaTemporal: 0, bajaDefinitiva: 0 };
    }

    const now = new Date();
    let vigentes = 0;
    let bajaTemporal = 0;
    let bajaDefinitiva = 0;

    patients.forEach(patient => {
      if (!patient.lastAppointmentDate) {
        vigentes++;
        return;
      }

      const lastDate = parseISO(patient.lastAppointmentDate);
      const yearsSinceLastAppointment = differenceInYears(now, lastDate);

      if (yearsSinceLastAppointment < 5) {
        vigentes++;
      } else if (yearsSinceLastAppointment >= 5 && yearsSinceLastAppointment < 6) {
        bajaTemporal++;
      } else { // >= 6
        bajaDefinitiva++;
      }
    });

    return { total: patients.length, vigentes, bajaTemporal, bajaDefinitiva };
  }, [patients]);
  
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
    
    // These headers MUST match the keys in the worksheetData mapping below
    const excelHeaders = [
      'No.Expediente', 'Nombre', 'Apaterno', 'Amaterno', 'FNacimiento',
      'Edad', 'Sexo', 'Estado', 'Domicilio', 'Colonia', 'NombrePadre',
      'NombreMadre', 'EdadPadre', 'EdadMadre', 'FechaApertura',
      'Estatus', 'DerechoAbiencia', 'Telefono', 'CURP',
    ];

    // Map patient data to the desired Excel structure, ensuring all columns are present
    const worksheetData = patients.map(patient => ({
        'No.Expediente': patient.expediente ?? '',
        'Nombre': patient.name ?? '',
        'Apaterno': patient.paternalLastName ?? '',
        'Amaterno': patient.maternalLastName ?? '',
        'FNacimiento': patient.birthDate ?? '',
        'Edad': patient.age ?? '',
        'Sexo': patient.sex ?? '',
        'Estado': patient.birthState ?? '',
        'Domicilio': patient.address ?? '',
        'Colonia': patient.coloniaName ?? '',
        'NombrePadre': patient.fatherName ?? '',
        'NombreMadre': patient.motherName ?? '',
        'EdadPadre': patient.fatherAge ?? '',
        'EdadMadre': patient.motherAge ?? '',
        'FechaApertura': patient.registrationDate ?? '',
        'Estatus': patient.status ?? '',
        'DerechoAbiencia': patient.derechoAbiencia ?? '',
        'Telefono': patient.phoneNumber ?? '',
        'CURP': patient.curp ?? '',
    }));

    const worksheet = xlsx.utils.json_to_sheet(worksheetData, { header: excelHeaders });
    
    // Set column widths for better readability
    worksheet['!cols'] = [
        { wch: 15 }, // No.Expediente
        { wch: 20 }, // Nombre
        { wch: 15 }, // Apaterno
        { wch: 15 }, // Amaterno
        { wch: 12 }, // FNacimiento
        { wch: 8 },  // Edad
        { wch: 10 }, // Sexo
        { wch: 15 }, // Estado
        { wch: 30 }, // Domicilio
        { wch: 20 }, // Colonia
        { wch: 20 }, // NombrePadre
        { wch: 20 }, // NombreMadre
        { wch: 10 }, // EdadPadre
        { wch: 10 }, // EdadMadre
        { wch: 12 }, // FechaApertura
        { wch: 10 }, // Estatus
        { wch: 20 }, // DerechoAbiencia
        { wch: 15 }, // Telefono
        { wch: 20 }, // CURP
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Pacientes');
    xlsx.writeFile(workbook, 'archivo_pacientes_completo.xlsx');
  }

  return (
    <div className="space-y-6 container mx-auto">
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pacientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pacientes Vigentes</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.vigentes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Baja Temporal (+5 años)</CardTitle>
            <History className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.bajaTemporal}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Baja Definitiva (+6 años)</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.bajaDefinitiva}</div>
          </CardContent>
        </Card>
      </div>
      
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
                patients={paginatedPatients}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                isSubmitting={isSubmitting}
            />
          )}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filas por página:</span>
              <Select
                value={String(rowsPerPage)}
                onValueChange={(value) => {
                  setRowsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages > 0 ? totalPages : 1}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || totalPages === 0}
                >
                    Anterior
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                >
                    Siguiente
                </Button>
            </div>
          </div>
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
