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
import { Loader2, LogOut, Plus, Upload, Download, Search, FileDown, Calendar as CalendarIcon, Check, PlusCircle, User, UserCheck, UserX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getPatients as fetchPatients, deletePatient, updatePatientStatus, savePatient, getAppointments as dataGetAppointments, getClinics as dataGetClinics, updatePatient, deleteAppointment } from '@/lib/actions';
import type { Patient, PatientStatus, Appointment, Clinic, ClinicType, Colonia } from '@/lib/definitions';
import { PatientList } from './patient-list';
import { MassUploadDialog } from './mass-upload-dialog';
import { EditPatientDialog } from './edit-patient-dialog';
import { ScheduleAppointmentDialog } from './schedule-appointment-dialog';
import { v4 as uuidv4 } from 'uuid';
import { PatientStatus as PatientStatusEnum } from '@/lib/definitions';
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
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [schedulingPatient, setSchedulingPatient] = useState<Patient | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  
  // Appointment states
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [colonias, setColonias] = useState<Colonia[]>([]);
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
    if (!searchTerm) return allPatients;
    const lowercasedTerm = searchTerm.toLowerCase();
    const searchParts = lowercasedTerm.split(' ').filter(part => part);
    
    return allPatients.filter(patient => {
      const fullName = `${patient.name || ''} ${patient.paternalLastName || ''} ${patient.maternalLastName || ''}`.toLowerCase();
      const curp = (patient.curp || '').toLowerCase();

      return searchParts.every(part => fullName.includes(part) || curp.includes(part));
    });
  }, [allPatients, searchTerm]);

  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredPatients.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredPatients, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredPatients.length / rowsPerPage);

  const summaryCounts = useMemo(() => {
    return {
      total: allPatients.length,
      vigente: allPatients.filter(p => p.status === PatientStatusEnum.Vigente || !p.status).length,
      baja: allPatients.filter(p => p.status === PatientStatusEnum.Baja).length,
    }
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
            loadInitialData(); // Re-fetch all initial data
        } else {
            toast({ title: 'Error', description: 'No se pudo eliminar la cita.', variant: 'destructive' });
        }
    });
  };
  
  const handleStatusChange = (patientId: string, newStatus: PatientStatus) => {
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

  // Appointment Report Logic
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
      default: // 'today'
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

  const groupedClinics = useMemo(() => {
    if (!clinics) return {};
    const sortedClinics = [...clinics].sort((a, b) => a.name.localeCompare(b.name));
    return sortedClinics.reduce((acc, clinic) => {
      const type = clinic.clinicType || 'Consulta Externa';
      if (!acc[type]) acc[type] = [];
      acc[type].push(clinic);
      return acc;
    }, {} as Record<string, Clinic[]>);
  }, [clinics]);

  const handleSetDateRange = (range: DateRange | undefined) => { setDateRange(range); setActiveFilter('range'); };
  const handleClinicSelect = (clinicId: string) => { setSelectedClinics(prev => prev.includes(clinicId) ? prev.filter(id => id !== clinicId) : [...prev, clinicId]); };
  
  const handleAppointmentsExcelDownload = async () => {
    if (appointmentsToDisplay.length === 0) {
      toast({
        title: 'No hay datos',
        description: 'No hay citas para descargar en el filtro actual.',
        variant: 'destructive',
      });
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
        toast({ title: 'No hay datos para generar el PDF', variant: 'destructive' });
        return;
    }

    const sortedAppointments = [...appointments].sort((a, b) => {
        const timeA = a.time.replace(':', '').replace('Ficha ','');
        const timeB = b.time.replace(':', '').replace('Ficha ','');
        return timeA.localeCompare(timeB, undefined, { numeric: true });
    });

    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'portrait' }) as any;

    const primaryClinicId = selectedClinics.length > 0 ? selectedClinics[0] : (sortedAppointments.length > 0 ? sortedAppointments[0].clinicId : null);
    const clinicInfo = primaryClinicId ? clinics.find(c => c.id === primaryClinicId) : null;
    const reportDate = sortedAppointments.length > 0 ? parseISO(sortedAppointments[0].date) : new Date();

    // --- PDF Header ---
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("SECRETARÍA DE SALUD", doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text("Hospital General de Huimanguillo", doc.internal.pageSize.getWidth() / 2, 26, { align: 'center' });
    doc.setFontSize(10);
    doc.text("Vale Multiple de Expediente para la Consulta Externa", doc.internal.pageSize.getWidth() / 2, 32, { align: 'center' });

    let yPos = 45;
    doc.setFontSize(10);
    
    // Left side
    doc.setFont('helvetica', 'bold');
    doc.text(`Cedula:`, 14, yPos);
    doc.text(`Nombre del Médico:`, 14, yPos + 6);
    doc.text(`Especialidad:`, 14, yPos + 12);
    
    doc.setFont('helvetica', 'normal');
    doc.text(clinicInfo?.id.substring(0, 8) || 'N/A', 45, yPos, { maxWidth: 75 });
    doc.text(clinicInfo?.doctorName || 'N/A', 45, yPos + 6, { maxWidth: 75 });
    doc.text(clinicInfo?.clinicType || 'N/A', 45, yPos + 12, { maxWidth: 75 });
    
    // Right side
    const folioText = clinicInfo ? `${format(reportDate, 'dd/MM/yyyy')}-${clinicInfo.id.substring(0, 6)}` : format(reportDate, 'dd/MM/yyyy');
    doc.setFont('helvetica', 'bold');
    doc.text(`Folio:`, 120, yPos);
    doc.text(`Fecha:`, 120, yPos + 6);

    doc.setFont('helvetica', 'normal');
    doc.text(folioText, 140, yPos, { maxWidth: 60 });
    doc.text(format(reportDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es }), 140, yPos + 6, { maxWidth: 60 });


    // --- Table ---
    const tableStartY = yPos + 22;
    const tableColumns = ["No", "Hora", "Nombre del Paciente", "Expediente", "Ent.", "Dev.", "Nota"];
    const tableRows = sortedAppointments.map((app, index) => {
        const patientName = app.patient ? `${app.patient.name} ${app.patient.paternalLastName} ${app.patient.maternalLastName}` : 'N/A';
        const expediente = app.patient?.expediente || '';
        let timeDisplay = app.time;
        if (!app.time.includes('Ficha')) {
          try {
            timeDisplay = format(parseISO(`1970-01-01T${app.time}:00`), 'hh:mm a');
          } catch (e) {
            // keep original time if format fails
          }
        }
        
        return [
            index + 1,
            timeDisplay,
            patientName,
            expediente,
            '', // Ent.
            '', // Dev.
            ''  // Nota
        ];
    });

    doc.autoTable({
        head: [tableColumns],
        body: tableRows,
        startY: tableStartY,
        theme: 'grid',
        headStyles: {
            fillColor: [255, 255, 255], // white
            textColor: 0, // black
            fontStyle: 'bold',
            lineWidth: 0.1,
            lineColor: [0, 0, 0]
        },
        styles: {
            fontSize: 9,
            cellPadding: 2,
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' }, // No
            1: { cellWidth: 20 }, // Hora
            2: { cellWidth: 65 }, // Nombre
            3: { cellWidth: 20 }, // Expediente
            4: { cellWidth: 10 }, // Ent.
            5: { cellWidth: 10 }, // Dev.
            6: { cellWidth: 'auto' }, // Nota
        },
    });

    // --- Footer ---
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.text("RECIBIO:", 30, finalY);
    doc.line(30, finalY + 5, 90, finalY + 5);
    doc.text("Nombre y Firma", 45, finalY + 10);
    
    doc.text("RECIBIO:", 120, finalY);
    doc.line(120, finalY + 5, 180, finalY + 5);
    doc.text("Nombre y Firma", 135, finalY + 10);

    doc.save(`Vale_Expedientes_${format(reportDate, 'yyyy-MM-dd')}.pdf`);
  };

  // Common JSX
  const mainHeader = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-3xl font-bold font-headline">Archivo</CardTitle>
          <CardDescription>Gestión del padrón de pacientes y visualización de citas.</CardDescription>
        </div>
        <Button variant="outline" onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Salir del Archivo
        </Button>
      </CardHeader>
    </Card>
  );

  return (
    <div className="space-y-6">
      {mainHeader}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="patients">Padrón de Pacientes</TabsTrigger>
            <TabsTrigger value="appointments">Reporte de Citas</TabsTrigger>
        </TabsList>
        <TabsContent value="patients" className="space-y-4 mt-4">
           <div className="grid md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Pacientes</CardTitle>
                        <User className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summaryCounts.total}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pacientes Vigentes</CardTitle>
                        <UserCheck className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{summaryCounts.vigente}</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pacientes de Baja</CardTitle>
                        <UserX className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{summaryCounts.baja}</div>
                    </CardContent>
                </Card>
           </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-grow w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Buscar por nombre, apellidos o CURP..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-full"/></div>
                <div className="flex gap-2 w-full sm:w-auto"><Button onClick={handleAddNew} className="flex-grow"><Plus className="mr-2 h-4 w-4"/> Agregar</Button><Button onClick={() => setIsUploadOpen(true)} variant="secondary" className="flex-grow"><Upload className="mr-2 h-4 w-4"/> Carga Masiva</Button><Button onClick={handleDownloadExcel} variant="outline" className="flex-grow"><Download className="mr-2 h-4 w-4"/> Descargar</Button></div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="flex flex-col justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <span className='ml-2 mt-4 text-muted-foreground'>Cargando registros de pacientes...</span></div> : <PatientList patients={paginatedPatients} onEdit={handleEdit} onDelete={handleDelete} onStatusChange={handleStatusChange} onSchedule={handleSchedule} isSubmitting={isSubmitting}/>}
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Filas:</span><Select value={String(rowsPerPage)} onValueChange={(value) => { setRowsPerPage(Number(value)); setCurrentPage(1); }}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem><SelectItem value="200">200</SelectItem></SelectContent></Select></div>
                <div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages > 0 ? totalPages : 1}</span><Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1 || totalPages === 0}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0}>Siguiente</Button></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4 mt-4">
          <Card className="w-full shadow-lg">
            <CardHeader><CardTitle className="text-2xl font-bold font-headline">Reporte de Citas Médicas</CardTitle></CardHeader>
            <CardContent>
                <div className="flex flex-wrap items-center gap-2 pt-4">
                    <Button variant={activeFilter === 'today' ? 'default' : 'outline'} onClick={() => setActiveFilter('today')}>Hoy</Button>
                    <Button variant={activeFilter === 'week' ? 'default' : 'outline'} onClick={() => setActiveFilter('week')}>Esta Semana</Button>
                    <Button variant={activeFilter === 'month' ? 'default' : 'outline'} onClick={() => setActiveFilter('month')}>Este Mes</Button>
                    <Popover><PopoverTrigger asChild><Button id="date" variant={activeFilter === 'range' ? 'default' : 'outline'} className={cn('w-[260px] justify-start text-left font-normal')}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}</>) : (format(dateRange.from, 'LLL dd, y'))) : (<span>Seleccionar rango</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={handleSetDateRange} numberOfMonths={2} /></PopoverContent></Popover>
                    <Popover><PopoverTrigger asChild><Button variant="outline" className="h-10 border-dashed"><PlusCircle className="mr-2 h-4 w-4" />Núcleo Básico{selectedClinics.length > 0 && (<><Separator orientation="vertical" className="mx-2 h-4" /><Badge variant="secondary" className="rounded-sm px-1 font-normal">{selectedClinics.length}</Badge></>)}</Button></PopoverTrigger>
                        <PopoverContent className="w-[250px] p-0" align="start">
                          <Command><CommandInput placeholder="Buscar núcleo..." /><CommandList><CommandEmpty>No se encontraron resultados.</CommandEmpty>{Object.entries(groupedClinics).map(([type, clinicGroup]) => (<CommandGroup key={type} heading={type}>{(clinicGroup as Clinic[]).map(clinic => { const isSelected = selectedClinics.includes(clinic.id); return (<CommandItem key={clinic.id} onSelect={() => handleClinicSelect(clinic.id)}><div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}><Check className={cn("h-4 w-4")} /></div><span>{clinic.name}</span></CommandItem>);})}</CommandGroup>))} {selectedClinics.length > 0 && (<><CommandSeparator /><CommandGroup><CommandItem onSelect={() => setSelectedClinics([])} className="justify-center text-center">Limpiar filtro</CommandItem></CommandGroup></>)}</CommandList></Command>
                        </PopoverContent>
                    </Popover>
                    <div className="flex-grow" />
                    <Button onClick={() => handleGeneratePDF(appointmentsToDisplay)} variant="secondary" disabled={isLoading}><FileDown className="mr-2 h-4 w-4" />Descargar PDF</Button>
                    <Button onClick={handleAppointmentsExcelDownload} variant="outline" disabled={isLoading}><Download className="mr-2 h-4 w-4" />Descargar Excel</Button>
                </div>
                <div className="mt-6">
                    {isLoading ? (<div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-4 text-muted-foreground">Cargando citas...</span></div>) : 
                    (<AppointmentList 
                        appointments={appointmentsToDisplay} 
                        clinics={clinics}
                        isAdmin
                        onDelete={handleAppointmentDelete}
                        onEditSuccess={loadInitialData}
                     />)}
                </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <MassUploadDialog isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUploadSuccess={loadInitialData} />
      {isEditOpen && <EditPatientDialog isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} patient={editingPatient} onSave={handleSavePatient} isSaving={isSubmitting} />}
      {schedulingPatient && (
        <ScheduleAppointmentDialog
            patient={schedulingPatient}
            isOpen={!!schedulingPatient}
            onClose={() => setSchedulingPatient(null)}
            onBookingSuccess={() => {
                setSchedulingPatient(null);
                loadInitialData();
            }}
            clinics={clinics}
            colonias={colonias}
        />
      )}
    </div>
  );
}
