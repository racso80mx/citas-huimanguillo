
'use client';
import React, { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import type { Appointment, Clinic, LabAppointment, XRayAppointment, UltrasoundAppointment, VaccineAppointment, Patient, MedicalConsultation, Prescription, Colonia } from '@/lib/definitions';
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
  getPrescriptionsByPatientId,
  getPatients,
  deletePrescription
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
  Search,
  FileText,
  CalendarSearch,
  CheckCircle2,
  Users,
  History,
  ArrowRight,
  UserRound,
  Stethoscope,
  X,
  Trash2,
  Pencil
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
import { MedicationInventoryDialog } from './medication-inventory-dialog';
import { AvailabilityViewerDialog } from './availability-viewer-dialog';
import { ScheduleAppointmentDialog } from '../archivo/schedule-appointment-dialog';
import { CreatePrescriptionDialog } from './create-prescription-dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { downloadExcel } from '@/lib/report-helpers';

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
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [isSearchingArchive, setIsSearchingArchive] = useState(false);

  const [isMedicationDialogOpen, setIsMedicationDialogOpen] = useState(false);
  const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false);
  const [selectedPatientForPrescription, setSelectedPatientForPrescription] = useState<Patient | null>(null);
  const [editingPrescription, setEditingPrescription] = useState<Prescription | null>(null);
  
  const [manualDayMonth, setManualDayMonth] = useState('');
  const [manualYear, setManualYear] = useState(new Date().getFullYear().toString());

  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchData = useCallback(() => {
    startDataTransition(async () => {
      try {
        let appointmentsData: any[] = [];
        const [clinicsData, coloniasData] = await Promise.all([
            getClinics(),
            getColonias()
        ]);
        setClinics(clinicsData);
        setColonias(coloniasData);

        if (reportType === 'clinic') {
            appointmentsData = await getAppointmentsForClinic(entity.id);
            const attendedData = await getAttendedPatientsForClinic(entity.id);
            setAttendedPatients(attendedData);
        } else if (reportType === 'laboratorio') {
            appointmentsData = await getLabAppointments();
        } else if (reportType === 'x-ray') {
            appointmentsData = await getXRayAppointments();
        } else if (reportType === 'ultrasound') {
            appointmentsData = await getUltrasoundAppointments();
        } else if (reportType === 'vacunas') {
            appointmentsData = await getVaccineAppointments();
        }
        
        setAppointments(appointmentsData || []);
      } catch (error) {
        console.error('Error fetching data for reports dashboard', error);
        toast({ title: 'Error al sincronizar datos', variant: 'destructive' });
      }
    });
  }, [entity.id, reportType, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSetDateRange = (range: DateRange | undefined) => {
    setDateRange(range);
    setActiveFilter('range');
  };

  const handleManualDateChange = (dm: string, y: string) => {
    setManualDayMonth(dm);
    setManualYear(y);
    if (dm.length === 5 && y.length === 4) {
      const parsedDate = parse(`${dm}/${y}`, 'dd/MM/yyyy', new Date());
      if (isValid(parsedDate)) {
        setActiveFilter('range');
        setDateRange({ from: parsedDate, to: parsedDate });
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (reportType === 'laboratorio') await deleteLabAppointment(id);
      else if (reportType === 'x-ray') await deleteXRayAppointment(id);
      else if (reportType === 'ultrasound') await deleteUltrasoundAppointment(id);
      else if (reportType === 'vacunas') await deleteVaccineAppointment(id);
      else await deleteAppointment(id);
      toast({ title: 'Cita Eliminada' });
      fetchData(); 
    } catch (error) {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    }
  };

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
          toast({ title: "Error al cargar historial", variant: "destructive" });
      } finally {
          setIsLoadingHistory(false);
      }
  };

  const handleGlobalSearch = async () => {
    if (!historySearchTerm.trim()) {
        fetchData(); 
        return;
    }
    setIsSearchingArchive(true);
    try {
        const term = historySearchTerm.toUpperCase().trim();
        const searchOptions: any = {};
        if (term.length === 18) searchOptions.searchCurp = term;
        else if (/^\d+$/.test(term)) searchOptions.searchExpediente = term;
        else searchOptions.searchName = term;
        const results = await getPatients(searchOptions);
        setAttendedPatients(results);
    } finally {
        setIsSearchingArchive(false);
    }
  };

  const appointmentsToDisplay = useMemo(() => {
    if (!isClient || !appointments || appointments.length === 0) return [];
    let filterFn: (app: any) => boolean;
    const now = new Date();
    switch (activeFilter) {
      case 'week':
        const wStart = startOfWeek(now, { weekStartsOn: 1 });
        const wEnd = endOfWeek(now, { weekStartsOn: 1 });
        filterFn = (app) => isWithinInterval(parseISO(app.date), { start: wStart, end: wEnd });
        break;
      case 'month':
        const mStart = startOfMonth(now);
        const mEnd = endOfMonth(now);
        filterFn = (app) => isWithinInterval(parseISO(app.date), { start: mStart, end: mEnd });
        break;
      case 'range':
        if (dateRange?.from) {
          const rStart = startOfDay(dateRange.from);
          const rEnd = endOfDay(dateRange.to || dateRange.from);
          filterFn = (app) => {
            const d = parseISO(app.date);
            return d >= rStart && d <= rEnd;
          };
        } else return () => true;
        break;
      case 'today':
      default:
        filterFn = (app) => isWithinInterval(parseISO(app.date), { start: startOfDay(now), end: endOfDay(now) });
        break;
    }
    let res = appointments.filter(filterFn);
    if (searchTerm) {
        const t = searchTerm.toUpperCase();
        res = res.filter(a => {
            const n = `${a.patient?.name || ''} ${a.patient?.paternalLastName || ''} ${a.patient?.maternalLastName || ''}`.toUpperCase();
            return n.includes(t) || (a.patient?.curp || '').toUpperCase().includes(t) || (a.appointmentNumber || '').toUpperCase().includes(t);
        });
    }
    return res.sort((a, b) => a.time.localeCompare(b.time));
  }, [isClient, appointments, activeFilter, dateRange, searchTerm]);

  const summaryCounts = useMemo(() => {
    if (!isClient) return { total: 0, attended: 0, pending: 0, notAttended: 0 };
    const now = new Date();
    const tStart = startOfDay(now);
    const tEnd = endOfDay(now);
    const todayApps = appointments.filter(a => isWithinInterval(parseISO(a.date), { start: tStart, end: tEnd }));
    return {
      total: todayApps.length,
      attended: todayApps.filter(a => a.status === 'Atendido').length,
      pending: todayApps.filter(a => a.status === 'Agendada' || !a.status).length,
      notAttended: todayApps.filter(a => a.status === 'No Asistió' || a.status === 'No Atendido').length,
    }
  }, [isClient, appointments]);

  const isClinicReport = reportType === 'clinic';

  const renderAppointmentListContent = () => {
      if (isDataLoading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
      
      switch(reportType) {
          case 'laboratorio': return <LabAppointmentList appointments={appointmentsToDisplay} isAdmin onDelete={handleDelete} onEditSuccess={fetchData} />;
          case 'x-ray': return <XRayAppointmentList appointments={appointmentsToDisplay} isAdmin onDelete={handleDelete} onEditSuccess={fetchData} />;
          case 'ultrasound': return <UltrasoundAppointmentList appointments={appointmentsToDisplay} isAdmin onDelete={handleDelete} onEditSuccess={fetchData} />;
          case 'vacunas': return <VaccineAppointmentList appointments={appointmentsToDisplay} isAdmin onDelete={handleDelete} onEditSuccess={fetchData} />;
          default: return <AppointmentList appointments={appointmentsToDisplay} clinics={clinics} isAdmin onDelete={handleDelete} onEditSuccess={fetchData} />;
      }
  };

  const handleDownload = () => {
    if (appointmentsToDisplay.length === 0) {
        toast({ title: 'No hay datos para exportar', variant: 'destructive' });
        return;
    }
    downloadExcel(appointmentsToDisplay, `reporte_${reportType}_${activeFilter}_${format(new Date(), 'dd-MM-yyyy')}`);
  }

  return (
    <div className="space-y-8 container mx-auto px-0 py-8">
      <Card className="shadow-lg border-primary/10 mx-4 sm:mx-0">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="text-3xl font-bold font-headline uppercase">Reportes: {entity.name}</CardTitle>
            <CardDescription>Bienvenido, {entity.doctorName}. Control operativo del servicio.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {isClinicReport && (
                <>
                    <Button variant="outline" className="text-green-700 border-green-200" onClick={() => setIsNewAppointmentOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Nueva Cita</Button>
                    <Button variant="outline" className="text-primary border-primary/40" onClick={() => setIsAvailabilityDialogOpen(true)}><CalendarDays className="mr-2 h-4 w-4" /> Disponibilidad</Button>
                    <Button variant="default" className="bg-primary hover:bg-primary/90" onClick={() => setIsMedicationDialogOpen(true)}><Pill className="mr-2 h-4 w-4" /> Farmacia</Button>
                </>
            )}
            <Button variant="outline" onClick={onLogout}><LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión</Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 sm:px-0">
        {[
            { label: 'Total Hoy', val: summaryCounts.total, icon: UserCheck, color: 'text-primary' },
            { label: 'Atendidos', val: summaryCounts.attended, icon: CheckCircle2, color: 'text-green-600' },
            { label: 'Pendientes', val: summaryCounts.pending, icon: Clock, color: 'text-yellow-600' },
            { label: 'Inasistencias', val: summaryCounts.notAttended, icon: UserX, color: 'text-red-600' }
        ].map(s => (
            <Card key={s.label} className="shadow-sm">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">{s.label}</span>
                        <s.icon className={cn("h-4 w-4", s.color)} />
                    </div>
                    <div className={cn("text-2xl font-black", s.color)}>{s.val}</div>
                </CardContent>
            </Card>
        ))}
      </div>

      <Card className="w-full shadow-lg border-none">
        <CardHeader className="bg-muted/10">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 bg-background p-1 border rounded-lg">
                <Button variant={activeFilter === 'today' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveFilter('today')}>Hoy</Button>
                <Button variant={activeFilter === 'week' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveFilter('week')}>Semana</Button>
                <Button variant={activeFilter === 'month' ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveFilter('month')}>Mes</Button>
            </div>
            <div className="flex items-center gap-2 bg-background p-2 rounded-xl border border-dashed border-primary/20">
                <div className="flex flex-col gap-1">
                    <Label className="text-[9px] font-black uppercase text-primary h-3">Día/Mes</Label>
                    <Input placeholder="11/07" value={manualDayMonth} onChange={e => {
                        let v = e.target.value.replace(/\D/g, '');
                        if (v.length > 2) v = v.substring(0,2) + '/' + v.substring(2,4);
                        handleManualDateChange(v.substring(0,5), manualYear);
                    }} className="h-8 w-20 text-center font-bold text-xs" maxLength={5} />
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-[9px] font-black uppercase text-primary h-3">Año</Label>
                    <Input type="number" value={manualYear} onChange={e => handleManualDateChange(manualDayMonth, e.target.value.substring(0,4))} className="h-8 w-16 text-center font-bold text-xs" />
                </div>
            </div>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10 min-w-[200px] border-primary/20"><CalendarIcon className="mr-2 h-4 w-4" /> {dateRange?.from ? (dateRange.to ? `${format(dateRange.from, 'dd/MM')} - ${format(dateRange.to, 'dd/MM')}` : format(dateRange.from, 'dd/MM')) : "Selector de Rango"}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="range" selected={dateRange} onSelect={handleSetDateRange} numberOfMonths={2} locale={es} /></PopoverContent>
            </Popover>
            <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por Nombre, Folio o CURP..." className="pl-9 h-11 border-primary/20" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={fetchData} className="h-11 w-11"><RefreshCw className={cn("h-4 w-4", isDataLoading && "animate-spin")} /></Button>
                <Button variant="outline" size="icon" onClick={handleDownload} className="h-11 w-11"><Download className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
            {isClinicReport ? (
                <Tabs defaultValue="listado" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-md h-auto p-1 bg-muted/20 mb-6">
                        <TabsTrigger value="listado" className="py-2.5 font-bold">Agenda del Consultorio</TabsTrigger>
                        <TabsTrigger value="pacientes" className="py-2.5 font-bold">Pacientes Atendidos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="listado">{renderAppointmentListContent()}</TabsContent>
                    <TabsContent value="pacientes">
                        <div className="grid lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-4">
                                <Card className="h-[500px] flex flex-col border-primary/10">
                                    <CardHeader className="bg-muted/10">
                                        <div className="flex gap-2">
                                            <Input placeholder="Buscar por nombre..." value={historySearchTerm} onChange={e => setHistorySearchTerm(e.target.value.toUpperCase())} className="uppercase h-10" onKeyDown={e => e.key === 'Enter' && handleGlobalSearch()} />
                                            <Button size="icon" onClick={handleGlobalSearch} disabled={isSearchingArchive}><Search className="h-4 w-4"/></Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0 flex-1 overflow-hidden">
                                        <ScrollArea className="h-full">
                                            {attendedPatients.map(p => (
                                                <button key={p.id} onClick={() => loadPatientDetail(p.id)} className={cn("w-full text-left p-4 border-b hover:bg-primary/5 transition-all", selectedPatientId === p.id && "bg-primary/10 border-l-4 border-primary shadow-inner")}>
                                                    <div>
                                                        <p className="font-bold text-sm uppercase text-foreground">{p.name} {p.paternalLastName}</p>
                                                        <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{p.curp}</p>
                                                    </div>
                                                </button>
                                            ))}
                                            {attendedPatients.length === 0 && !isSearchingArchive && (
                                                <div className="p-10 text-center text-muted-foreground italic text-xs">No hay pacientes atendidos recientemente.</div>
                                            )}
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            </div>
                            <div className="lg:col-span-8">
                                {selectedPatientId ? (
                                    <div className="space-y-4">
                                        {isLoadingHistory ? (
                                            <div className="flex flex-col items-center justify-center py-20 gap-4"><Loader2 className="animate-spin h-10 w-10 text-primary" /><p className="text-xs font-bold uppercase tracking-widest animate-pulse">Cargando Historial Clínico...</p></div>
                                        ) : (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                                {patientHistory.map(c => (
                                                    <Card key={c.id} className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                                                        <CardHeader className="py-3 bg-muted/5 flex flex-row items-center justify-between">
                                                            <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{format(parseISO(c.date), "dd 'de' MMMM, yyyy", { locale: es })}</CardTitle>
                                                            <Badge variant="outline" className="text-[9px] font-bold bg-background">{c.service}</Badge>
                                                        </CardHeader>
                                                        <CardContent className="pt-4">
                                                            <div className="space-y-3">
                                                                <div>
                                                                    <p className="text-[9px] font-black uppercase text-primary mb-1">Diagnóstico Principal:</p>
                                                                    <p className="text-sm font-bold uppercase">{c.diagnosis1}</p>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
                                                                    <div className="flex items-center gap-2"><UserRound className="h-3 w-3 text-muted-foreground" /><span className="text-[10px] font-medium uppercase text-muted-foreground">Médico: <span className="text-foreground font-bold">{c.doctorName}</span></span></div>
                                                                    {c.imc && <div className="flex items-center gap-2"><Activity className="h-3 w-3 text-muted-foreground" /><span className="text-[10px] font-medium uppercase text-muted-foreground">IMC: <span className="text-foreground font-bold">{c.imc}</span></span></div>}
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                                {patientHistory.length === 0 && <div className="p-20 text-center opacity-40 italic flex flex-col items-center gap-3"><History className="h-12 w-12" /><p>No hay notas médicas registradas para este paciente.</p></div>}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-[500px] flex flex-col items-center justify-center opacity-20 border-2 border-dashed rounded-3xl bg-muted/5">
                                        <Users className="h-20 w-20 mb-4" />
                                        <p className="font-black uppercase tracking-widest text-lg">Selecciona un paciente del listado</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            ) : (
                <div className="animate-in fade-in duration-500">
                    {renderAppointmentListContent()}
                </div>
            )}
        </CardContent>
      </Card>

      <MedicationInventoryDialog isOpen={isMedicationDialogOpen} onClose={() => setIsMedicationDialogOpen(false)} />
      <AvailabilityViewerDialog isOpen={isAvailabilityDialogOpen} onClose={() => setIsAvailabilityDialogOpen(false)} reportType={reportType} entity={entity} />
      {isNewAppointmentOpen && <ScheduleAppointmentDialog isOpen={isNewAppointmentOpen} onClose={() => setIsNewAppointmentOpen(false)} patient={{} as any} clinics={isClinicReport ? [entity] : clinics} colonias={colonias} onBookingSuccess={fetchData} isDoctorBypass={true} />}
      {isPrescriptionOpen && <CreatePrescriptionDialog isOpen={isPrescriptionOpen} onClose={() => setIsPrescriptionOpen(false)} clinic={entity} initialPatient={selectedPatientForPrescription} initialPrescription={editingPrescription} onPrescriptionCreated={fetchData} />}
    </div>
  );
}

function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function endOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59); }
