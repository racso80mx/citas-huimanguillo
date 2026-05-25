'use client';
import React, { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import type { Appointment, Clinic, LabAppointment, XRayAppointment, UltrasoundAppointment, VaccineAppointment, Colonia, Patient, MedicalConsultation, Prescription } from '@/lib/definitions';
import {
  getAppointmentsForClinic,
  getLabAppointments,
  getXRayAppointments,
  getUltrasoundAppointments,
  getVaccineAppointments,
  deleteAppointment,
  deleteLabAppointment,
  deleteXRayAppointment,
  deleteUltrasoundAppointment,
  deleteVaccineAppointment,
  getClinics,
  getColonias,
  getAttendedPatientsForClinic,
  getConsultationsByPatientId,
  getPrescriptionsByPatientId
} from '@/lib/actions';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LogOut,
  Loader2,
  Calendar as CalendarIcon,
  Download,
  UserCheck,
  Clock,
  UserX,
  PlusCircle,
  RefreshCw,
  Pill,
  CalendarDays,
  CalendarPlus,
  Search,
  FileText,
  CalendarSearch,
  CheckCircle2,
  Users,
  History,
  Activity,
  ArrowRight,
  UserRound,
  Stethoscope
} from 'lucide-react';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
  isWithinInterval,
  isValid,
  parse
} from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Calendar } from '../ui/calendar';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AppointmentList } from '../appointment-list';
import { LabAppointmentList } from '../laboratorio/lab-appointment-list';
import { XRayAppointmentList } from '../rayos-x/x-ray-appointment-list';
import { UltrasoundAppointmentList } from '../ultrasonidos/ultrasound-appointment-list';
import { VaccineAppointmentList } from '../vacunas/vaccine-appointment-list';
import { LabSettingsManager } from '../admin/lab-settings-manager';
import { XRaySettingsManager } from '../admin/x-ray-settings-manager';
import { UltrasoundSettingsManager } from '../admin/ultrasound-settings-manager';
import { VaccineSettingsManager } from '../admin/vaccine-settings-manager';
import { MedicationInventoryDialog } from './medication-inventory-dialog';
import { AvailabilityViewerDialog } from './availability-viewer-dialog';
import { ScheduleAppointmentDialog } from '../archivo/schedule-appointment-dialog';
import { CreatePrescriptionDialog } from './create-prescription-dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { generatePrescriptionPDF } from '@/lib/report-helpers';

type ReportType = 'clinic' | 'x-ray' | 'ultrasound' | 'laboratorio' | 'vacunas';

type ReportsDashboardProps = {
  entity: any;
  onLogout: () => void;
  reportType: ReportType;
};

type FilterType = 'today' | 'week' | 'month' | 'range';

export function ReportsDashboard({ entity, onLogout, reportType }: ReportsDashboardProps) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [colonias, setColonias] = useState<Colonia[]>([]);
  const [attendedPatients, setAttendedPatients] = useState<Patient[]>([]);
  const [isDataLoading, startDataTransition] = useTransition();
  const [activeFilter, setActiveFilter] = useState<FilterType>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [isClient, setIsClient] = useState(false);
  
  // History states
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientHistory, setPatientHistory] = useState<MedicalConsultation[]>([]);
  const [patientPrescriptions, setPatientPrescriptions] = useState<Prescription[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historySearchTerm, setHistoryHistorySearchTerm] = useState('');

  const [isMedicationDialogOpen, setIsMedicationDialogOpen] = useState(false);
  const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false);
  const [selectedPatientForPrescription, setSelectedPatientForPrescription] = useState<Patient | null>(null);
  
  const [manualDayMonth, setManualDayMonth] = useState('');
  const [manualYear, setManualYear] = useState(new Date().getFullYear().toString());

  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchData = useCallback(() => {
    startDataTransition(async () => {
      try {
        let appointmentsData;
        const [clinicsData, coloniasData, attendedData] = await Promise.all([
            getClinics(),
            getColonias(),
            reportType === 'clinic' ? getAttendedPatientsForClinic(entity.id) : Promise.resolve([])
        ]);
        setClinics(clinicsData);
        setColonias(coloniasData);
        setAttendedPatients(attendedData);

        if (reportType === 'clinic') {
            appointmentsData = await getAppointmentsForClinic(entity.id);
        } else if (reportType === 'x-ray') {
            appointmentsData = await getXRayAppointments();
        } else if (reportType === 'ultrasound') {
            appointmentsData = await getUltrasoundAppointments();
        } else if (reportType === 'laboratorio') {
            appointmentsData = await getLabAppointments();
        } else if (reportType === 'vacunas') {
            appointmentsData = await getVaccineAppointments();
        }
        setAppointments(appointmentsData || []);
      } catch (error) {
        console.error('Error fetching data for reports dashboard', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos de las citas.',
          variant: 'destructive',
        });
      }
    });
  }, [entity.id, reportType, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadPatientDetail = async (patientId: string) => {
      setSelectedPatientId(patientId);
      setIsLoadingHistory(true);
      try {
          const [consultations, prescriptions] = await Promise.all([
              getConsultationsByPatientId(patientId),
              getPrescriptionsByPatientId(patientId)
          ]);
          setPatientHistory(consultations);
          setPatientPrescriptions(prescriptions);
      } catch (e) {
          toast({ title: "Error", description: "No se pudo cargar el historial del paciente.", variant: "destructive" });
      } finally {
          setIsLoadingHistory(false);
      }
  };

  const appointmentsToDisplay = useMemo(() => {
    if (!isClient || !appointments || appointments.length === 0) {
      return [];
    }

    let filterFn: (app: any) => boolean;
    const now = new Date();

    switch (activeFilter) {
      case 'week':
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        filterFn = (app) => {
          const appDate = parseISO(app.date);
          return isWithinInterval(appDate, { start: weekStart, end: weekEnd });
        };
        break;
      case 'month':
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        filterFn = (app) => {
          const appDate = parseISO(app.date);
          return isWithinInterval(appDate, { start: monthStart, end: monthEnd });
        };
        break;
      case 'range':
        if (dateRange?.from) {
          const rangeStart = startOfDay(dateRange.from);
          const rangeEnd = endOfDay(dateRange.to || dateRange.from);
          filterFn = (app) => {
            const appDate = parseISO(app.date);
            return appDate >= rangeStart && appDate <= rangeEnd;
          };
        } else {
          return [];
        }
        break;
      case 'today':
      default:
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        filterFn = (app) => {
          const appDate = parseISO(app.date);
          return isWithinInterval(appDate, { start: todayStart, end: todayEnd });
        };
        break;
    }
    
    let filtered = appointments.filter(filterFn);

    if (searchTerm) {
        const term = searchTerm.toUpperCase();
        filtered = filtered.filter(app => {
            const patientName = `${app.patient?.name || ''} ${app.patient?.paternalLastName || ''} ${app.patient?.maternalLastName || ''}`.toUpperCase();
            const curp = (app.patient?.curp || '').toUpperCase();
            const folio = (app.appointmentNumber || '').toUpperCase();
            return patientName.includes(term) || curp.includes(term) || folio.includes(term);
        });
    }

    return filtered.sort((a, b) => a.time.localeCompare(b.time));
  }, [isClient, appointments, activeFilter, dateRange, searchTerm]);

  const filteredAttendedPatients = useMemo(() => {
      if (!historySearchTerm) return attendedPatients;
      const term = historySearchTerm.toUpperCase();
      return attendedPatients.filter(p => 
          p.name.includes(term) || 
          p.paternalLastName.includes(term) || 
          p.maternalLastName.includes(term) || 
          p.curp.includes(term) ||
          (p.expediente && p.expediente.includes(term))
      );
  }, [attendedPatients, historySearchTerm]);

  const handleDelete = async (id: string) => {
    try {
      if (reportType === 'clinic') await deleteAppointment(id);
      if (reportType === 'laboratorio') await deleteLabAppointment(id);
      if (reportType === 'x-ray') await deleteXRayAppointment(id);
      if (reportType === 'ultrasound') await deleteUltrasoundAppointment(id);
      if (reportType === 'vacunas') await deleteVaccineAppointment(id);

      toast({
        title: 'Cita Eliminada',
        description: 'La cita ha sido eliminada correctamente.',
      });
      fetchData(); 
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cita.',
        variant: 'destructive',
      });
    }
  };


  const handleSetDateRange = (range: DateRange | undefined) => {
    setDateRange(range);
    setActiveFilter('range');
  };

  const handleManualDateChange = (dm: string, y: string) => {
    setManualDayMonth(dm);
    setManualYear(y);

    if (dm.length === 5 && y.length === 4) {
      const dateStr = `${dm}/${y}`;
      const parsedDate = parse(dateStr, 'dd/MM/yyyy', new Date());
      
      if (isValid(parsedDate)) {
        setActiveFilter('range');
        setDateRange({ from: parsedDate, to: parsedDate });
      }
    }
  };

  const handleDownload = async () => {
    if (appointmentsToDisplay.length === 0) {
      toast({
        title: 'No hay datos',
        description: 'No hay citas para descargar en el filtro actual.',
        variant: 'destructive',
      });
      return;
    }
    let filename = '';
    if (reportType === 'clinic') filename = `reporte_${entity.name}_${activeFilter}`;
    if (reportType === 'x-ray') filename = `reporte_rayos_x_${activeFilter}`;
    if (reportType === 'ultrasound') filename = `reporte_ultrasonidos_${activeFilter}`;
    if (reportType === 'laboratorio') filename = `reporte_laboratorio_${activeFilter}`;
    if (reportType === 'vacunas') filename = `reporte_vacunas_${activeFilter}`;

    const enrichedData = appointmentsToDisplay.map(app => {
      const clinic = clinics.find(c => c.id === app.clinicId);
      return {
        ...app,
        clinicName: clinic?.name || 'N/A'
      };
    });

    const xlsx = await import('xlsx');
    
    const worksheetData = enrichedData.map(
        (item: any) => {
            const baseData: any = {
                'Folio': item.appointmentNumber,
                'Fecha': format(parseISO(item.date), 'dd/MM/yyyy'),
                'Hora': item.time,
                'Estado': item.status,
                'Paciente': item.patient ? `${item.patient.name} ${item.patient.paternalLastName} ${item.patient.maternalLastName}`: 'N/A',
                'CURP': item.patient?.curp || 'N/A',
                'Teléfono': item.patient?.phoneNumber || 'N/A',
            };

            if (reportType === 'laboratorio') {
                const labItem = item as LabAppointment;
                baseData['Estudios'] = labItem.studies.map(s => `${s.code ? `${s.code} - ` : ''}${s.name}`).join(', ');
            } else if (reportType === 'x-ray') {
                 const xrayItem = item as XRayAppointment;
                 baseData['Estudio'] = xrayItem.studyName;
            } else if (reportType === 'ultrasound') {
                 const ultrasoundItem = item as UltrasoundAppointment;
                 baseData['Estudio'] = ultrasoundItem.studyName;
            } else if (reportType === 'vacunas') {
                const vaccineItem = item as VaccineAppointment;
                baseData['Municipio'] = vaccineItem.coloniaName || 'N/A';
                baseData['Vacunas'] = vaccineItem.vaccines.map(v => v.name).join(', ');
                baseData['Recién Nacido'] = vaccineItem.patientType === 'Recién Nacido' ? 'Sí' : 'No';
            } else { // clinic
                const regularItem = item as Appointment;
                if (regularItem.time.includes('Ficha')) {
                    baseData['Ficha'] = regularItem.time.split(' ')[1];
                }
                baseData['Núcleo'] = (item as any).clinicName;
                baseData['Municipio'] = regularItem.coloniaName || 'N/A';
                baseData['Tipo Paciente'] = regularItem.patientType;
            }
            return baseData;
        }
    );

  const worksheet = xlsx.utils.json_to_sheet(worksheetData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Citas');

  if (worksheetData.length > 0) {
    const cols = Object.keys(worksheetData[0]);
    const colWidths = cols.map(col => ({
        wch: Math.max(...worksheetData.map(row => (row[col as keyof typeof row] ?? '').toString().length), col.length) + 1
    }));
    worksheet['!cols'] = colWidths;
  }

  xlsx.writeFile(workbook, `${filename}.xlsx`);
  };

  const summaryCounts = useMemo(() => {
    if (!isClient) {
        return { total: 0, attended: 0, pending: 0, notAttended: 0 };
    }
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const todaysAppointments = appointments.filter(app => isWithinInterval(parseISO(app.date), { start: todayStart, end: todayEnd }));

    return {
      total: todaysAppointments.length,
      attended: todaysAppointments.filter(app => app.status === 'Atendido').length,
      pending: todaysAppointments.filter(app => app.status === 'Agendada' || !app.status).length,
      notAttended: todaysAppointments.filter(app => app.status === 'No Asistió' || app.status === 'No Atendido').length,
    }
  }, [isClient, appointments]);

  const handleOpenPrescription = (patient: Patient) => {
    setSelectedPatientForPrescription(patient);
    setIsPrescriptionOpen(true);
  }

  const renderAppointmentList = () => {
    const props = {
      isAdmin: true,
      onEditSuccess: fetchData,
      onDelete: reportType === 'clinic' ? undefined : handleDelete,
      onPrescribe: reportType === 'clinic' ? handleOpenPrescription : undefined,
    };
    switch(reportType) {
        case 'clinic':
            return <AppointmentList appointments={appointmentsToDisplay as Appointment[]} clinics={clinics} {...props} />;
        case 'laboratorio':
            return <LabAppointmentList appointments={appointmentsToDisplay as LabAppointment[]} {...props} />;
        case 'x-ray':
            return <XRayAppointmentList appointments={appointmentsToDisplay as XRayAppointment[]} {...props} />;
        case 'ultrasound':
            return <UltrasoundAppointmentList appointments={appointmentsToDisplay as UltrasoundAppointment[]} {...props} />;
        case 'vacunas':
            return <VaccineAppointmentList appointments={appointmentsToDisplay as VaccineAppointment[]} {...props} />;
        default:
            return <p>Tipo de reporte no reconocido.</p>
    }
  }

  const renderSettingsManager = () => {
    switch(reportType) {
        case 'laboratorio':
            return <LabSettingsManager />;
        case 'x-ray':
            return <XRaySettingsManager />;
        case 'ultrasound':
            return <UltrasoundSettingsManager />;
        case 'vacunas':
            return <VaccineSettingsManager />;
        default:
            return null;
    }
  }


  return (
    <div className="space-y-8 px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div className="min-w-[300px]">
            <CardTitle className="text-3xl font-bold font-headline">
              Reportes de Citas: {entity.name}
            </CardTitle>
            <CardDescription>
              Bienvenido, {entity.doctorName}. Visualiza y gestiona las
              citas.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {reportType === 'clinic' && (
                <Button variant="outline" className="text-green-700 border-green-200 hover:bg-green-50" onClick={() => setIsNewAppointmentOpen(true)}>
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    Nueva Cita (Médico)
                </Button>
            )}
            <Button variant="outline" className="text-primary border-primary/40 hover:bg-primary/5" onClick={() => setIsAvailabilityDialogOpen(true)}>
                <CalendarDays className="mr-2 h-4 w-4" />
                Consultar Disponibilidad
            </Button>
            <Button variant="default" className="bg-primary hover:bg-primary/90" onClick={() => setIsMedicationDialogOpen(true)}>
                <Pill className="mr-2 h-4 w-4" />
                Consultar Farmacia
            </Button>
            <Button variant="outline" onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Citas Totales (Hoy)</CardTitle>
            <UserCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryCounts.total}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atendidos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summaryCounts.attended}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {summaryCounts.pending}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Asistieron / No Atendidos</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {summaryCounts.notAttended}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="listado" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md h-auto p-1 bg-muted/20 mb-6">
            <TabsTrigger value="listado" className="py-2.5 font-bold data-[state=active]:bg-background">Agenda del Consultorio</TabsTrigger>
            <TabsTrigger value="pacientes" className="py-2.5 font-bold data-[state=active]:bg-background">Pacientes Atendidos (Historial)</TabsTrigger>
          </TabsList>

          <TabsContent value="listado" className="mt-0">
            <Card className="w-full shadow-lg">
                <CardHeader>
                <div className="flex flex-wrap items-center gap-4 pt-4">
                    <div className="flex items-center gap-2">
                        <Button
                        variant={activeFilter === 'today' ? 'default' : 'outline'}
                        onClick={() => { setActiveFilter('today'); setManualDayMonth(''); }}
                        >
                        Hoy
                        </Button>
                        <Button
                        variant={activeFilter === 'week' ? 'default' : 'outline'}
                        onClick={() => { setActiveFilter('week'); setManualDayMonth(''); }}
                        >
                        Semana
                        </Button>
                        <Button
                        variant={activeFilter === 'month' ? 'default' : 'outline'}
                        onClick={() => { setActiveFilter('month'); setManualDayMonth(''); }}
                        >
                        Mes
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 bg-muted/20 p-2 rounded-xl border border-dashed">
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] font-black uppercase flex items-center gap-1 text-primary h-4">
                                <CalendarSearch className="h-3 w-3" /> Saltar a Día / Mes
                            </Label>
                            <Input 
                                placeholder="11/07" 
                                value={manualDayMonth}
                                onChange={(e) => {
                                    let val = e.target.value.replace(/\D/g, '');
                                    if (val.length > 2) {
                                        val = val.substring(0, 2) + '/' + val.substring(2, 4);
                                    }
                                    handleManualDateChange(val.substring(0, 5), manualYear);
                                }}
                                className="h-9 w-24 text-center font-bold border-primary/20 bg-background"
                                maxLength={5}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] font-black uppercase flex items-center text-primary h-4">Año</Label>
                            <Input 
                                type="number"
                                value={manualYear}
                                onChange={(e) => handleManualDateChange(manualDayMonth, e.target.value.substring(0, 4))}
                                className="h-9 w-20 text-center font-bold border-primary/20 bg-background"
                                maxLength={4}
                            />
                        </div>
                    </div>

                    <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        id="date"
                        variant={activeFilter === 'range' ? 'default' : 'outline'}
                        className={cn('w-[240px] justify-start text-left font-normal h-11')}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                            dateRange.to ? (
                            <>
                                {format(dateRange.from, 'dd/MM/yy')} -{' '}
                                {format(dateRange.to, 'dd/MM/yy')}
                            </>
                            ) : (
                            format(dateRange.from, 'dd/MM/yy')
                            )
                        ) : (
                            <span>Selector de Rango</span>
                        )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={handleSetDateRange}
                        numberOfMonths={2}
                        locale={es}
                        />
                    </PopoverContent>
                    </Popover>

                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar Paciente o Folio..." 
                            className="pl-9 h-11"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 ml-auto">
                        <Button
                            variant="outline"
                            onClick={fetchData}
                            disabled={isDataLoading}
                            className="h-11"
                            >
                            <RefreshCw className={cn("h-4 w-4", isDataLoading && "animate-spin")} />
                        </Button>
                        <Button
                            onClick={handleDownload}
                            variant="secondary"
                            className="h-11"
                            >
                            <Download className="mr-2 h-4 w-4" />
                            Descargar Excel
                        </Button>
                    </div>
                </div>
                </CardHeader>
                <CardContent>
                {isDataLoading ? (
                    <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-4 text-muted-foreground">
                        Sincronizando con base de datos...
                    </span>
                    </div>
                ) : (
                    <>
                    {appointmentsToDisplay.length > 0 ? (
                        renderAppointmentList()
                    ) : (
                        <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-bold">No se encontraron citas</p>
                        <p className="text-sm">Ajusta los filtros o busca otro periodo para visualizar datos.</p>
                        </div>
                    )}
                    </>
                )}
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pacientes" className="mt-0">
              <div className="grid lg:grid-cols-12 gap-8">
                  {/* Pacientes List */}
                  <div className="lg:col-span-4 space-y-4">
                      <Card className="shadow-lg h-[calc(100vh-350px)] flex flex-col">
                          <CardHeader className="bg-muted/10 pb-4">
                              <CardTitle className="text-lg flex items-center gap-2">
                                  <Users className="h-5 w-5 text-primary" /> Pacientes Registrados
                              </CardTitle>
                              <CardDescription>Selecciona un paciente para ver su historial.</CardDescription>
                              <div className="relative mt-2">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input 
                                      placeholder="Buscar por nombre o CURP..." 
                                      className="pl-9 h-10"
                                      value={historySearchTerm}
                                      onChange={e => setHistoryHistorySearchTerm(e.target.value)}
                                  />
                              </div>
                          </CardHeader>
                          <CardContent className="p-0 flex-1 overflow-hidden">
                              <ScrollArea className="h-full">
                                  {isDataLoading ? (
                                      <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                                  ) : filteredAttendedPatients.length > 0 ? (
                                      <div className="divide-y">
                                          {filteredAttendedPatients.map(p => (
                                              <button 
                                                  key={p.id}
                                                  onClick={() => loadPatientDetail(p.id)}
                                                  className={cn(
                                                      "w-full text-left p-4 transition-all hover:bg-primary/5 group",
                                                      selectedPatientId === p.id ? "bg-primary/10 border-l-4 border-primary" : "border-l-4 border-transparent"
                                                  )}
                                              >
                                                  <div className="flex justify-between items-start">
                                                      <div>
                                                          <p className="font-bold text-sm uppercase leading-tight group-hover:text-primary">{p.name} {p.paternalLastName}</p>
                                                          <p className="text-[10px] font-mono text-muted-foreground mt-1">{p.curp}</p>
                                                      </div>
                                                      <ArrowRight className={cn("h-4 w-4 text-muted-foreground transition-transform", selectedPatientId === p.id && "translate-x-1 text-primary")} />
                                                  </div>
                                              </button>
                                          ))}
                                      </div>
                                  ) : (
                                      <div className="p-10 text-center text-muted-foreground italic text-xs">No hay pacientes que coincidan con la búsqueda.</div>
                                  )}
                              </ScrollArea>
                          </CardContent>
                      </Card>
                  </div>

                  {/* Detalle Histórico */}
                  <div className="lg:col-span-8">
                      {selectedPatientId ? (
                          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                              {isLoadingHistory ? (
                                  <Card className="h-[500px] flex items-center justify-center">
                                      <div className="text-center space-y-4">
                                          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                                          <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Recuperando Expediente Digital...</p>
                                      </div>
                                  </Card>
                              ) : (
                                  <>
                                      <Tabs defaultValue="consultas" className="w-full">
                                          <TabsList className="bg-muted/10 border p-1 rounded-xl h-auto mb-6">
                                              <TabsTrigger value="consultas" className="flex items-center gap-2 py-2 px-6 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg font-bold">
                                                  <Stethoscope className="h-4 w-4" /> Historial de Consultas
                                              </TabsTrigger>
                                              <TabsTrigger value="recetas" className="flex items-center gap-2 py-2 px-6 data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg font-bold">
                                                  <FileText className="h-4 w-4" /> Recetas Emitidas
                                              </TabsTrigger>
                                          </TabsList>

                                          <TabsContent value="consultas" className="mt-0 space-y-6">
                                              {patientHistory.length > 0 ? patientHistory.map(consult => (
                                                  <Card key={consult.id} className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow group">
                                                      <CardHeader className="bg-muted/5 py-4">
                                                          <div className="flex items-center justify-between">
                                                              <div className="flex items-center gap-4">
                                                                  <div className="bg-primary/5 p-2.5 rounded-full"><History className="h-5 w-5 text-primary/60" /></div>
                                                                  <div>
                                                                      <CardTitle className="text-sm font-black uppercase text-muted-foreground">
                                                                          {format(parseISO(consult.date), "dd 'de' MMMM, yyyy", { locale: es })}
                                                                      </CardTitle>
                                                                      <CardDescription className="text-xs font-bold text-primary/70 mt-0.5">SERVICIO: {consult.service}</CardDescription>
                                                                  </div>
                                                              </div>
                                                              <Badge variant="outline" className="font-mono text-[10px] bg-background">IMC: {consult.imc || 'N/A'}</Badge>
                                                          </div>
                                                      </CardHeader>
                                                      <CardContent className="pt-6 space-y-4">
                                                          <div className="grid sm:grid-cols-2 gap-6">
                                                              <div className="space-y-2">
                                                                  <p className="text-[10px] font-black uppercase opacity-40 flex items-center gap-1"><Search className="h-3 w-3"/> Diagnóstico Principal:</p>
                                                                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                                                                      <div className="flex items-center gap-2 mb-1">
                                                                          <Badge className="font-mono text-[9px] h-4">{consult.diagnosis1Code}</Badge>
                                                                          <span className="text-[9px] font-bold text-muted-foreground uppercase">{consult.diagnosis1Type}</span>
                                                                      </div>
                                                                      <p className="text-xs font-bold uppercase leading-tight">{consult.diagnosis1}</p>
                                                                  </div>
                                                              </div>
                                                              <div className="space-y-2">
                                                                  <p className="text-[10px] font-black uppercase opacity-40 flex items-center gap-1"><UserRound className="h-3 w-3"/> Atendido por:</p>
                                                                  <p className="text-xs font-bold uppercase p-3 border rounded-lg bg-background">Dr. {consult.doctorName}</p>
                                                              </div>
                                                          </div>
                                                          
                                                          {consult.diagnosis2 && (
                                                              <div className="p-2 px-3 border rounded-lg bg-muted/20 flex items-center gap-3">
                                                                  <Badge variant="outline" className="font-mono text-[9px] bg-background">{consult.diagnosis2Code}</Badge>
                                                                  <span className="text-[11px] font-medium uppercase text-muted-foreground">{consult.diagnosis2}</span>
                                                              </div>
                                                          )}

                                                          <div className="flex justify-end gap-2 pt-2">
                                                              {consult.recipeFolio && <Badge className="bg-blue-50 text-blue-700 border-blue-200">Receta: {consult.recipeFolio}</Badge>}
                                                          </div>
                                                      </CardContent>
                                                  </Card>
                                              )) : (
                                                  <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed opacity-50">
                                                      <History className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                                      <p className="font-bold">Sin consultas previas en este núcleo</p>
                                                      <p className="text-xs">Este paciente no tiene notas médicas registradas todavía.</p>
                                                  </div>
                                              )}
                                          </TabsContent>

                                          <TabsContent value="recetas" className="mt-0">
                                              {patientPrescriptions.length > 0 ? (
                                                  <div className="grid gap-4">
                                                      {patientPrescriptions.map(presc => (
                                                          <Card key={presc.id} className="hover:border-primary/30 transition-all shadow-sm">
                                                              <CardContent className="p-4">
                                                                  <div className="flex items-center justify-between">
                                                                      <div className="flex items-center gap-4">
                                                                          <div className="bg-blue-50 p-2.5 rounded-lg"><FileText className="h-5 w-5 text-blue-600" /></div>
                                                                          <div>
                                                                              <div className="flex items-center gap-2">
                                                                                  <span className="font-black text-xs text-blue-700">{presc.folio}</span>
                                                                                  <Badge variant={presc.status === 'surtida' ? 'secondary' : 'outline'} className="text-[9px] uppercase font-bold h-4">
                                                                                      {presc.status}
                                                                                  </Badge>
                                                                              </div>
                                                                              <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                                                                                  {format(parseISO(presc.date), "dd/MM/yyyy HH:mm")} hrs
                                                                              </p>
                                                                          </div>
                                                                      </div>
                                                                      <div className="flex items-center gap-2">
                                                                           <div className="text-right hidden sm:block mr-4">
                                                                              <p className="text-[10px] font-bold uppercase text-muted-foreground">Insumos</p>
                                                                              <p className="text-xs font-black">{presc.items.length}</p>
                                                                          </div>
                                                                          <Button 
                                                                              variant="outline" 
                                                                              size="sm" 
                                                                              className="h-9 font-bold text-[10px] uppercase border-blue-200 hover:bg-blue-50"
                                                                              onClick={() => generatePrescriptionPDF(presc)}
                                                                          >
                                                                              <Download className="h-3 w-3 mr-2" /> PDF
                                                                          </Button>
                                                                      </div>
                                                                  </div>
                                                              </CardContent>
                                                          </Card>
                                                      ))}
                                                  </div>
                                              ) : (
                                                  <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed opacity-50">
                                                      <Pill className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                                      <p className="font-bold">Sin recetario histórico</p>
                                                      <p className="text-xs">No se han emitido recetas digitales para este paciente.</p>
                                                  </div>
                                              )}
                                          </TabsContent>
                                      </Tabs>
                                  </>
                              )}
                          </div>
                      ) : (
                          <div className="h-[500px] flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-3xl opacity-30">
                              <Users className="h-20 w-16 mb-6" />
                              <h2 className="text-2xl font-black uppercase tracking-widest">Expediente Digital</h2>
                              <p className="max-w-xs mt-2 font-medium">Selecciona un paciente del listado izquierdo para visualizar su trayectoria clínica y recetas emitidas.</p>
                          </div>
                      )}
                  </div>
              </div>
          </TabsContent>
      </Tabs>

      <div className="w-full mt-8">
        {renderSettingsManager()}
      </div>

      <MedicationInventoryDialog 
        isOpen={isMedicationDialogOpen} 
        onClose={() => setIsMedicationDialogOpen(false)} 
      />

      <AvailabilityViewerDialog
        isOpen={isAvailabilityDialogOpen}
        onClose={() => setIsAvailabilityDialogOpen(false)}
        reportType={reportType}
        entity={entity}
      />

      {isNewAppointmentOpen && (
          <ScheduleAppointmentDialog 
            isOpen={isNewAppointmentOpen} 
            onClose={() => setIsNewAppointmentOpen(false)} 
            patient={{} as any}
            clinics={reportType === 'clinic' ? [entity] : clinics}
            colonias={colonias}
            onBookingSuccess={() => {
                setIsNewAppointmentOpen(false);
                fetchData();
            }}
            isDoctorBypass={true}
          />
      )}

      {isPrescriptionOpen && (
          <CreatePrescriptionDialog 
            isOpen={isPrescriptionOpen} 
            onClose={() => {
              setIsPrescriptionOpen(false);
              setSelectedPatientForPrescription(null);
            }} 
            clinic={entity}
            initialPatient={selectedPatientForPrescription}
          />
      )}
    </div>
  );
}
