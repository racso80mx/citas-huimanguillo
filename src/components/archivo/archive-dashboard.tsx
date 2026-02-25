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
import { Loader2, LogOut, Plus, Upload, Download, Search, FileDown, Calendar as CalendarIcon, Check, PlusCircle, User, UserCheck, UserX, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPatients as fetchPatients, deletePatient, updatePatientStatus, savePatient, getAppointments as dataGetAppointments, getClinics as dataGetClinics, updatePatient, deleteAppointment } from '@/lib/actions';
import type { Patient, Appointment, Clinic, Colonia } from '@/lib/definitions';
import { PatientStatus as PatientStatusEnum } from '@/lib/definitions';
import { PatientList } from './patient-list';
import { MassUploadDialog } from './mass-upload-dialog';
import { EditPatientDialog } from './edit-patient-dialog';
import { ScheduleAppointmentDialog } from './schedule-appointment-dialog';
import { v4 as uuidv4 } from 'uuid';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppointmentList } from '../appointment-list';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '../ui/command';
import { Badge } from '../ui/badge';
import { downloadExcel } from '@/lib/report-helpers';

type ArchiveDashboardProps = {
  onLogout: () => void;
};

type FilterType = 'today' | 'week' | 'month' | 'range';

export function ArchiveDashboard({ onLogout }: ArchiveDashboardProps) {
  const [activeTab, setActiveTab] = useState('patients');

  // Patient states
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Total' | PatientStatusEnum>(PatientStatusEnum.Vigente);
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [schedulingPatient, setSchedulingPatient] = useState<Patient | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  
  // Appointment states
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedClinics, setSelectedClinics] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Common states
  const [isLoading, startLoadingTransition] = useTransition();
  const [isSubmitting, startSubmitTransition] = useTransition();

  const { toast } = useToast();

  useEffect(() => {
      setIsClient(true);
  }, []);

  const loadInitialData = useCallback(() => {
    startLoadingTransition(async () => {
      try {
        const [patientsData, appointmentsData, clinicsData] = await Promise.all([
          fetchPatients(),
          dataGetAppointments(),
          dataGetClinics()
        ]);
        setAllPatients(patientsData);
        setAllAppointments(appointmentsData);
        setClinics(clinicsData);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar todos los datos iniciales.',
          variant: 'destructive',
        });
      }
    });
  }, [toast]);
  
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const filteredPatients = useMemo(() => {
    let result = [...allPatients];

    if (statusFilter !== 'Total') {
        result = result.filter(p => {
            if (statusFilter === PatientStatusEnum.Vigente) {
                return p.status !== PatientStatusEnum.Baja && p.status !== PatientStatusEnum.BajaDefinitiva;
            }
            return p.status === statusFilter;
        });
    }

    if (!searchTerm) return result;
    
    const lowercasedTerm = searchTerm.toLowerCase();
    const searchParts = lowercasedTerm.split(' ').filter(part => part);
    
    return result.filter(patient => {
      const fullName = `${patient.name || ''} ${patient.paternalLastName || ''} ${patient.maternalLastName || ''}`.toLowerCase();
      const curp = (patient.curp || '').toLowerCase();
      const expediente = (patient.expediente || '').toLowerCase();

      return searchParts.every(part => 
        fullName.includes(part) || 
        curp.includes(part) || 
        expediente.includes(part)
      );
    });
  }, [allPatients, searchTerm, statusFilter]);

  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredPatients.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredPatients, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredPatients.length / rowsPerPage);

  const summaryCounts = useMemo(() => {
    const total = allPatients.length;
    const bajaTemporal = allPatients.filter(p => p.status === PatientStatusEnum.Baja).length;
    const bajaDefinitiva = allPatients.filter(p => p.status === PatientStatusEnum.BajaDefinitiva).length;
    const vigente = total - bajaTemporal - bajaDefinitiva;

    return { total, vigente, bajaTemporal, bajaDefinitiva };
  }, [allPatients]);

  const handleAddNew = () => { setEditingPatient(null); setIsEditOpen(true); };
  const handleEdit = (patient: Patient) => { setEditingPatient(patient); setIsEditOpen(true); };
  const handleSchedule = (patient: Patient) => { setSchedulingPatient(patient); };
  
  const handleDelete = (patientId: string) => {
    startSubmitTransition(async () => {
      const result = await deletePatient(patientId);
      if(result.success) {
        toast({ title: "Paciente Eliminado"});
        loadInitialData();
      } else {
        toast({ title: "Error", description: result.message, variant: 'destructive'});
      }
    });
  }

  const handleAppointmentDelete = (appointmentId: string) => {
    startSubmitTransition(async () => {
        const result = await deleteAppointment(appointmentId);
        if (result.success) {
            toast({ title: 'Cita Eliminada', description: 'La cita ha sido eliminada del sistema.' });
            loadInitialData();
        } else {
            toast({ title: 'Error', description: 'No se pudo eliminar la cita.', variant: 'destructive' });
        }
    });
  };
  
  const handleStatusChange = (patientId: string, newStatus: PatientStatusEnum) => {
    startSubmitTransition(async () => {
      const result = await updatePatientStatus(patientId, newStatus);
       if(result.success) {
        toast({ title: "Estado Actualizado" });
        loadInitialData();
      } else {
        toast({ title: "Error", description: result.message, variant: 'destructive'});
      }
    });
  }
  
  const handleSavePatient = (patientData: Omit<Patient, 'id'>, id?: string) => {
    startSubmitTransition(async () => {
      const result = id 
        ? await updatePatient(id, patientData)
        : await savePatient(patientData, uuidv4());

       if(result.success) {
        toast({ title: "Paciente Guardado" });
        setIsEditOpen(false);
        setEditingPatient(null);
        loadInitialData();
      } else {
        toast({ title: "Error al Guardar", description: result.message, variant: 'destructive' });
      }
    });
  }

  const handleDownloadExcel = async () => {
    if (filteredPatients.length === 0) {
        toast({ title: "No hay datos", description: "No hay pacientes para descargar con el filtro actual.", variant: "destructive"});
        return;
    }
    const xlsx = await import('xlsx');
    const excelHeaders = [
      'No.Expediente', 'Nombre', 'Apaterno', 'Amaterno', 'FNacimiento', 'Edad', 'Sexo', 'Estado', 'Domicilio', 'Colonia', 'NombrePadre', 'NombreMadre', 'EdadPadre', 'EdadMadre', 'FechaApertura', 'Estatus', 'DerechoAbiencia', 'Telefono', 'CURP',
    ];
    const worksheetData = filteredPatients.map(patient => ({
        'No.Expediente': patient.expediente ?? '', 'Nombre': patient.name ?? '', 'Apaterno': patient.paternalLastName ?? '', 'Amaterno': patient.maternalLastName ?? '', 'FNacimiento': patient.birthDate ?? '', 'Edad': patient.age ?? '', 'Sexo': patient.sex ?? '', 'Estado': patient.birthState ?? '', 'Domicilio': patient.address ?? '', 'Colonia': patient.coloniaName ?? '', 'NombrePadre': patient.fatherName ?? '', 'NombreMadre': patient.motherName ?? '', 'EdadPadre': patient.fatherAge ?? '', 'EdadMadre': patient.motherAge ?? '', 'FechaApertura': patient.registrationDate ?? '', 'Estatus': patient.status ?? '', 'DerechoAbiencia': patient.derechoAbiencia ?? '', 'Telefono': patient.phoneNumber ?? '', 'CURP': patient.curp ?? '',
    }));
    const worksheet = xlsx.utils.json_to_sheet(worksheetData, { header: excelHeaders });
    worksheet['!cols'] = [
        { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 20 },
    ];
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Pacientes');
    xlsx.writeFile(workbook, `busqueda_pacientes.xlsx`);
  }

  const getFilteredAppointments = useCallback((appointmentsToFilter: any[]) => {
    if (!isClient || !appointmentsToFilter || appointmentsToFilter.length === 0) return [];
    let filterFn: (app: any) => boolean;
    const now = new Date();
    switch (activeFilter) {
      case 'week':
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }); const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        filterFn = (app) => isWithinInterval(parseISO(app.date), { start: weekStart, end: weekEnd });
        break;
      case 'month':
        const monthStart = startOfMonth(now); const monthEnd = endOfMonth(now);
        filterFn = (app) => isWithinInterval(parseISO(app.date), { start: monthStart, end: monthEnd });
        break;
      case 'range':
        if (dateRange?.from && dateRange?.to) {
          const rangeStart = startOfDay(dateRange.from); const rangeEnd = endOfDay(dateRange.to);
          filterFn = (app) => isWithinInterval(parseISO(app.date), { start: rangeStart, end: rangeEnd });
        } else return [];
        break;
      default:
        const todayStart = startOfDay(now); const todayEnd = endOfDay(now);
        filterFn = (app) => isWithinInterval(parseISO(app.date), { start: todayStart, end: todayEnd });
        break;
    }
    return appointmentsToFilter.filter(filterFn);
  }, [isClient, activeFilter, dateRange]);
  
  const appointmentsToDisplay = useMemo(() => {
    const dateFilteredAppointments = getFilteredAppointments(allAppointments);
    if (selectedClinics.length > 0) {
        return dateFilteredAppointments.filter(app => selectedClinics.includes(app.clinicId));
    }
    return dateFilteredAppointments;
  }, [allAppointments, selectedClinics, getFilteredAppointments]);

  const handleAppointmentsExcelDownload = async () => {
    if (appointmentsToDisplay.length === 0) {
      toast({ title: 'No hay datos', variant: 'destructive' });
      return;
    }
    const enrichedAppointments = appointmentsToDisplay.map((app) => ({
      ...app,
      clinicName: clinics.find(c => c.id === app.clinicId)?.name || 'N/A'
    }));
    await downloadExcel(enrichedAppointments, `reporte_citas_${activeFilter}`);
  };

  const handleGeneratePDF = async (appointments: Appointment[]) => {
    if (appointments.length === 0) {
        toast({ title: 'No hay datos', variant: 'destructive' });
        return;
    }
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'portrait' }) as any;
    const sortedApps = [...appointments].sort((a, b) => a.time.localeCompare(b.time));
    const reportDate = sortedApps.length > 0 ? parseISO(sortedApps[0].date) : new Date();

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("SECRETARÍA DE SALUD", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    doc.text("Hospital General de Huimanguillo", doc.internal.pageSize.getWidth() / 2, 26, { align: 'center' });
    doc.save(`Vale_Expedientes_${format(reportDate, 'yyyy-MM-dd')}.pdf`);
  };

  const mainHeader = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-3xl font-bold font-headline">Archivo</CardTitle>
          <CardDescription>Gestión del padrón de pacientes.</CardDescription>
        </div>
        <Button variant="outline" onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Salir
        </Button>
      </CardHeader>
    </Card>
  );

  return (
    <div className="space-y-6 container mx-auto px-4">
      {mainHeader}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="patients">Pacientes</TabsTrigger>
            <TabsTrigger value="appointments">Reporte de Citas</TabsTrigger>
        </TabsList>
        <TabsContent value="patients" className="space-y-4 mt-4">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button onClick={() => { setStatusFilter('Total'); setCurrentPage(1); }} className={cn("text-left transition-all", statusFilter === 'Total' ? "ring-2 ring-primary scale-105" : "")}>
                    <Card className={cn(statusFilter === 'Total' && "bg-primary/5")}><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium">Total</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-xl font-bold">{summaryCounts.total}</div></CardContent></Card>
                </button>
                <button onClick={() => { setStatusFilter(PatientStatusEnum.Vigente); setCurrentPage(1); }} className={cn("text-left transition-all", statusFilter === PatientStatusEnum.Vigente ? "ring-2 ring-primary scale-105" : "")}>
                    <Card className={cn(statusFilter === PatientStatusEnum.Vigente && "bg-primary/5")}><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium">Vigentes</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-xl font-bold text-green-600">{summaryCounts.vigente}</div></CardContent></Card>
                </button>
                <button onClick={() => { setStatusFilter(PatientStatusEnum.Baja); setCurrentPage(1); }} className={cn("text-left transition-all", statusFilter === PatientStatusEnum.Baja ? "ring-2 ring-primary scale-105" : "")}>
                    <Card className={cn(statusFilter === PatientStatusEnum.Baja && "bg-primary/5")}><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium">Baja Temporal</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-xl font-bold text-yellow-600">{summaryCounts.bajaTemporal}</div></CardContent></Card>
                </button>
                <button onClick={() => { setStatusFilter(PatientStatusEnum.BajaDefinitiva); setCurrentPage(1); }} className={cn("text-left transition-all", statusFilter === PatientStatusEnum.BajaDefinitiva ? "ring-2 ring-primary scale-105" : "")}>
                    <Card className={cn(statusFilter === PatientStatusEnum.BajaDefinitiva && "bg-primary/5")}><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium">Baja Definitiva</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-xl font-bold text-red-600">{summaryCounts.bajaDefinitiva}</div></CardContent></Card>
                </button>
           </div>
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-grow w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Buscar por nombre, expediente, CURP..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-10 w-full" />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button onClick={handleAddNew}><Plus className="h-4 w-4 mr-2"/>Agregar</Button>
                    <Button onClick={() => setIsUploadOpen(true)} variant="secondary"><Upload className="h-4 w-4 mr-2"/>Cargar</Button>
                    <Button onClick={handleDownloadExcel} variant="outline"><Download className="h-4 w-4 mr-2"/>Excel</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div> : <PatientList patients={paginatedPatients} onEdit={handleEdit} onDelete={handleDelete} onStatusChange={handleStatusChange} onSchedule={handleSchedule} isSubmitting={isSubmitting}/>}
              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
                <div className="flex items-center gap-2">
                    <Select value={String(rowsPerPage)} onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1); }}><SelectTrigger className="w-20"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select>
                    <span className="text-sm text-muted-foreground">por página</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm">Página {currentPage} de {totalPages || 1}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Anterior</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage >= totalPages}>Siguiente</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="appointments" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle>Reporte de Citas</CardTitle></CardHeader>
            <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant={activeFilter === 'today' ? 'default' : 'outline'} onClick={() => setActiveFilter('today')}>Hoy</Button>
                    <Button variant={activeFilter === 'week' ? 'default' : 'outline'} onClick={() => setActiveFilter('week')}>Semana</Button>
                    <Button variant={activeFilter === 'month' ? 'default' : 'outline'} onClick={() => setActiveFilter('month')}>Mes</Button>
                    <div className="flex-grow" />
                    <Button onClick={() => handleGeneratePDF(appointmentsToDisplay)} variant="secondary"><FileDown className="h-4 w-4 mr-2"/>PDF</Button>
                    <Button onClick={handleAppointmentsExcelDownload} variant="outline"><Download className="h-4 w-4 mr-2"/>Excel</Button>
                </div>
                <div className="mt-6">
                    {isLoading ? <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div> : <AppointmentList appointments={appointmentsToDisplay} clinics={clinics} isAdmin onDelete={handleAppointmentDelete} onEditSuccess={loadInitialData} />}
                </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <MassUploadDialog isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUploadSuccess={loadInitialData} />
      {isEditOpen && <EditPatientDialog isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} patient={editingPatient} onSave={handleSavePatient} isSaving={isSubmitting} />}
      {schedulingPatient && <ScheduleAppointmentDialog patient={schedulingPatient} isOpen={!!schedulingPatient} onClose={() => setSchedulingPatient(null)} onBookingSuccess={() => { setSchedulingPatient(null); loadInitialData(); }} clinics={clinics} colonias={[]} />}
    </div>
  );
}
