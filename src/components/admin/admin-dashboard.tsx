'use client';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import type { Appointment, Clinic, Colonia, LabAppointment, XRayAppointment, UltrasoundAppointment, VaccineAppointment, Specialty } from '@/lib/definitions';
import { deleteAppointment, deleteLabAppointment, deleteXRayAppointment, deleteUltrasoundAppointment, deleteVaccineAppointment, getSpecialties } from '@/lib/actions';
import { getAppointments, getLabAppointments, getXRayAppointments, getUltrasoundAppointments, getVaccineAppointments, getClinics, getColonias } from '@/lib/data';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppointmentList } from '../appointment-list';
import { LabAppointmentList } from '../laboratorio/lab-appointment-list';
import { XRayAppointmentList } from '../rayos-x/x-ray-appointment-list';
import { UltrasoundAppointmentList } from '../ultrasonidos/ultrasound-appointment-list';
import { VaccineAppointmentList } from '../vacunas/vaccine-appointment-list';
import {
  LogOut,
  Download,
  Loader2,
  Calendar as CalendarIcon,
  RefreshCw,
  Check,
  PlusCircle,
  DatabaseZap,
  ShieldCheck,
  Search,
  UserRound,
  Tags,
  Settings,
  ClipboardList,
  Pill,
  Package,
  FlaskConical,
  Stethoscope,
  Waves,
  ShieldPlus,
  BookText,
  CalendarSearch
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
import Link from 'next/link';
import { DateRange } from 'react-day-picker';
import { Calendar } from '../ui/calendar';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Label } from '../ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { downloadExcel } from '@/lib/report-helpers';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AnnouncementsManager } from './announcements-manager';
import { ClinicsManager } from './clinics-manager';
import { LabSettingsManager } from './lab-settings-manager';
import { XRaySettingsManager } from './x-ray-settings-manager';
import { UltrasoundSettingsManager } from './ultrasound-settings-manager';
import { VaccineSettingsManager } from './vaccine-settings-manager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleManager } from './module-manager';
import { BackupManager } from './backup-manager';
import { ActivityLogViewer } from './activity-log-viewer';
import { AdminPasswordManager } from './admin-password-manager';
import { HolidaysManager } from './holidays-manager';
import { SpecialActionDaysManager } from './special-action-days-manager';
import { ModuleSecurityManager } from './module-security-manager';
import { PharmacyManager } from './pharmacy-manager';
import { WarehouseManager } from './warehouse-manager';
import { DoctorsCatalog } from './doctors-catalog';
import { SpecialtiesManager } from './specialties-manager';
import { Cie10Manager } from './cie10-manager';
import { Input } from '../ui/input';

type AdminDashboardProps = {
  onLogout: () => void;
};

type FilterType = 'today' | 'week' | 'month' | 'range';

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [allLabAppointments, setAllLabAppointments] = useState<LabAppointment[]>([]);
  const [allXRayAppointments, setAllXRayAppointments] = useState<XRayAppointment[]>([]);
  const [allUltrasoundAppointments, setAllUltrasoundAppointments] = useState<UltrasoundAppointment[]>([]);
  const [allVaccineAppointments, setAllVaccineAppointments] = useState<VaccineAppointment[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [colonias, setColonias] = useState<Colonia[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);

  const [isPending, startTransition] = useTransition();
  const [mainTab, setMainTab] = useState("configuracion");
  const [activeFilter, setActiveFilter] = useState<FilterType>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedClinics, setSelectedClinics] = useState<string[]>([]);
  const [selectedClinicType, setSelectedClinicType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isClient, setIsClient] = useState(false);
  
  const [manualDayMonth, setManualDayMonth] = useState('');
  const [manualYear, setManualYear] = useState(new Date().getFullYear().toString());

  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchData = useCallback(() => {
    startTransition(async () => {
      try {
        const [
          appointmentsData,
          labAppointmentsData,
          xRayAppointmentsData,
          ultrasoundAppointmentsData,
          vaccineAppointmentsData,
          clinicsData,
          coloniasData,
          specialtiesData
        ] = await Promise.all([
          getAppointments(),
          getLabAppointments(),
          getXRayAppointments(),
          getUltrasoundAppointments(),
          getVaccineAppointments(),
          getClinics(),
          getColonias(),
          getSpecialties()
        ]);
        setAllAppointments(appointmentsData);
        setAllLabAppointments(labAppointmentsData);
        setAllXRayAppointments(xRayAppointmentsData);
        setAllUltrasoundAppointments(ultrasoundAppointmentsData);
        setAllVaccineAppointments(vaccineAppointmentsData);
        setClinics(clinicsData);
        setColonias(coloniasData);
        setSpecialties(specialtiesData);
      } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        toast({
          title: 'Error de Carga',
          description:
            'No se pudieron cargar todos los datos del panel. Por favor, recarga.',
          variant: 'destructive',
        });
      }
    });
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getFilteredData = (appointments: any[]) => {
    if (!isClient || !appointments || appointments.length === 0) {
      return [];
    }

    const now = new Date();
    let filterFn: (app: any) => boolean;

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
    return appointments.filter(filterFn);
  };

  const applySearch = (appointments: any[]) => {
      if (!searchTerm) return appointments;
      const term = searchTerm.toUpperCase();
      return appointments.filter(app => {
          const patientName = `${app.patient?.name || ''} ${app.patient?.paternalLastName || ''} ${app.patient?.maternalLastName || ''}`.toUpperCase();
          const curp = (app.patient?.curp || '').toUpperCase();
          const folio = (app.appointmentNumber || '').toUpperCase();
          return patientName.includes(term) || curp.includes(term) || folio.includes(term);
      });
  };
  
  const appointmentsToDisplay = useMemo(() => {
    const dateFilteredAppointments = getFilteredData(allAppointments);
    let filtered = dateFilteredAppointments;
    
    if (selectedClinicType !== 'all') {
        const clinicsOfType = clinics.filter(c => c.clinicType === selectedClinicType).map(c => c.id);
        filtered = filtered.filter(app => clinicsOfType.includes(app.clinicId));
    }

    if (selectedClinics.length > 0) {
        filtered = filtered.filter(app => selectedClinics.includes(app.clinicId));
    }
    return applySearch(filtered);
  }, [isClient, activeFilter, dateRange, allAppointments, selectedClinics, selectedClinicType, clinics, searchTerm]);

  const labAppointmentsToDisplay = useMemo(() => applySearch(getFilteredData(allLabAppointments)), [isClient, activeFilter, dateRange, allLabAppointments, searchTerm]);
  const xRayAppointmentsToDisplay = useMemo(() => applySearch(getFilteredData(allXRayAppointments)), [isClient, activeFilter, dateRange, allXRayAppointments, searchTerm]);
  const ultrasoundAppointmentsToDisplay = useMemo(() => applySearch(getFilteredData(allUltrasoundAppointments)), [isClient, activeFilter, dateRange, allUltrasoundAppointments, searchTerm]);
  const vaccineAppointmentsToDisplay = useMemo(() => applySearch(getFilteredData(allVaccineAppointments)), [isClient, activeFilter, dateRange, allVaccineAppointments, searchTerm]);
  
  const handleSetDateRangeState = (range: DateRange | undefined) => {
    if (dateRange?.from && range?.from && !range.to && dateRange.from.getTime() === range.from.getTime() && !dateRange.to) {
        setDateRange(undefined);
        return;
    }
    setDateRange(range);
    setActiveFilter('range');
  };

  const handleManualDateChangeState = (dm: string, y: string) => {
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

  const handleDownload = async (type: string) => {
    let dataToDownload: any[] = [];
    let filename = '';

    if (type === 'citas') {
        dataToDownload = appointmentsToDisplay;
        filename = 'citas_medicas';
    } else if (type === 'laboratorio') {
        dataToDownload = labAppointmentsToDisplay;
        filename = 'citas_laboratorio';
    } else if (type === 'rayos-x') {
        dataToDownload = xRayAppointmentsToDisplay;
        filename = 'citas_rayos_x';
    } else if (type === 'ultrasonidos') {
        dataToDownload = ultrasoundAppointmentsToDisplay;
        filename = 'citas_ultrasonidos';
    } else if (type === 'vacunas') {
        dataToDownload = vaccineAppointmentsToDisplay;
        filename = 'citas_vacunas';
    }


    if (dataToDownload.length === 0) {
      toast({
        title: 'No hay datos para descargar',
        description: 'No hay citas en el filtro actual para exportar.',
        variant: 'destructive',
      });
      return;
    }
    
    const enrichedAppointments = dataToDownload.map((app: any) => {
        const clinic = clinics.find((c) => c.id === app.clinicId);
        return {
        ...app,
        clinicName: clinic?.name || 'N/A',
        };
    });

    await downloadExcel(enrichedAppointments, `${filename}_${activeFilter}`);
  };

  const handleDeleteState = async (id: string, type: string) => {
    try {
      if (type === 'medical') await deleteAppointment(id);
      else if (type === 'lab') await deleteLabAppointment(id);
      else if (type === 'xray') await deleteXRayAppointment(id);
      else if (type === 'us') await deleteUltrasoundAppointment(id);
      else if (type === 'vaccine') await deleteVaccineAppointment(id);

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
  
  const handleClinicSelectState = (clinicId: string) => {
    setSelectedClinics(prev => 
        prev.includes(clinicId) 
            ? prev.filter(id => id !== clinicId)
            : [...prev, clinicId]
    );
  };


  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="text-3xl font-bold font-headline">
              Administración Central
            </CardTitle>
            <CardDescription>
              Gestión de catálogos, configuración del sistema y reportes de atención.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData} disabled={isPending}>
              <RefreshCw
                className={cn('mr-2 h-4 w-4', isPending && 'animate-spin')}
              />
              Sincronizar
            </Button>
            <Button variant="outline" onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Salir
            </Button>
          </div>
        </CardHeader>
      </Card>
      
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto mb-8 bg-muted/20 p-1">
          <TabsTrigger value="configuracion" className="py-3 font-bold flex items-center gap-2"><Settings className="h-4 w-4" /> 1. Configuración</TabsTrigger>
          <TabsTrigger value="catalogos" className="py-3 font-bold flex items-center gap-2"><UserRound className="h-4 w-4" /> 2. Catálogos</TabsTrigger>
          <TabsTrigger value="citas" className="py-3 font-bold flex items-center gap-2"><ClipboardList className="h-4 w-4" /> 3. Citas por Servicio</TabsTrigger>
        </TabsList>

        {/* 1. CONFIGURACION */}
        <TabsContent value="configuracion" className="mt-0 space-y-8 animate-in fade-in duration-300">
            <div className="grid lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <ModuleManager />
                    <ClinicsManager />
                    <HolidaysManager />
                </div>
                <div className="space-y-8">
                    <ModuleSecurityManager />
                    <AdminPasswordManager />
                    <SpecialActionDaysManager />
                    <AnnouncementsManager />
                </div>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-8">
                <BackupManager onRestoreSuccess={fetchData} />
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><DatabaseZap /> Mantenimiento de Datos</CardTitle>
                        <CardDescription>
                            Limpieza de duplicados y optimización del padrón.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/admin/duplicates" passHref>
                            <Button variant="outline" className="w-full h-12">
                                <DatabaseZap className="mr-2 h-4 w-4" /> Gestionar Pacientes Duplicados
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
            <ActivityLogViewer />
        </TabsContent>

        {/* 2. CATALOGOS */}
        <TabsContent value="catalogos" className="mt-0 animate-in fade-in duration-300">
            <Tabs defaultValue="medicos" className="w-full">
                <TabsList className="flex flex-wrap w-fit gap-2 bg-transparent mb-6 border-b rounded-none pb-px h-auto">
                    <TabsTrigger value="especialidades" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Especialidades</TabsTrigger>
                    <TabsTrigger value="medicos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Directorio Médico</TabsTrigger>
                    <TabsTrigger value="farmacia" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Farmacia</TabsTrigger>
                    <TabsTrigger value="almacen" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3">Almacén</TabsTrigger>
                    <TabsTrigger value="cie10" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3 flex items-center gap-2"><BookText className="h-4 w-4" /> Catálogos CIE-10</TabsTrigger>
                </TabsList>
                
                <TabsContent value="especialidades" className="mt-0">
                    <SpecialtiesManager />
                </TabsContent>
                
                <TabsContent value="medicos" className="mt-0">
                    <DoctorsCatalog />
                </TabsContent>
                
                <TabsContent value="farmacia" className="mt-0">
                    <PharmacyManager />
                </TabsContent>
                
                <TabsContent value="almacen" className="mt-0">
                    <WarehouseManager />
                </TabsContent>

                <TabsContent value="cie10" className="mt-0">
                    <Cie10Manager />
                </TabsContent>
            </Tabs>
        </TabsContent>
        
        {/* 3. CITAS POR SERVICIO */}
        <TabsContent value="citas" className="mt-0 animate-in fade-in duration-300">
            <Tabs defaultValue="citas-medicas" className="w-full">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 border-b pb-6">
                    <TabsList className="bg-muted/40 p-1 shrink-0">
                        <TabsTrigger value="citas-medicas" className="flex items-center gap-2"><ClipboardList className="h-3.5 w-3.5" /> General</TabsTrigger>
                        <TabsTrigger value="laboratorio" className="flex items-center gap-2"><FlaskConical className="h-3.5 w-3.5" /> Laboratorio</TabsTrigger>
                        <TabsTrigger value="rayos-x" className="flex items-center gap-2"><Stethoscope className="h-3.5 w-3.5" /> Rayos X</TabsTrigger>
                        <TabsTrigger value="ultrasonidos" className="flex items-center gap-2"><Waves className="h-3.5 w-3.5" /> Ultrasonidos</TabsTrigger>
                        <TabsTrigger value="vacunas" className="flex items-center gap-2"><ShieldPlus className="h-3.5 w-3.5" /> Vacunación</TabsTrigger>
                    </TabsList>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Button variant={activeFilter === 'today' ? 'default' : 'outline'} size="sm" onClick={() => { setActiveFilter('today'); setManualDayMonth(''); }}>Hoy</Button>
                            <Button variant={activeFilter === 'week' ? 'default' : 'outline'} size="sm" onClick={() => { setActiveFilter('week'); setManualDayMonth(''); }}>Semana</Button>
                            <Button variant={activeFilter === 'month' ? 'default' : 'outline'} size="sm" onClick={() => { setActiveFilter('month'); setManualDayMonth(''); }}>Mes</Button>
                        </div>
                        
                        <div className="flex items-center gap-2 bg-muted/40 p-2 rounded-xl border border-dashed border-primary/20">
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
                                        handleManualDateChangeState(val.substring(0, 5), manualYear);
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
                                    onChange={(e) => handleManualDateChangeState(manualDayMonth, e.target.value.substring(0, 4))}
                                    className="h-9 w-20 text-center font-bold border-primary/20 bg-background"
                                    maxLength={4}
                                />
                            </div>
                        </div>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="date" variant={activeFilter === 'range' ? 'default' : 'outline'} size="sm" className="h-9 min-w-[180px] justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                    {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, 'dd/MM')} - {format(dateRange.to, 'dd/MM')}</>) : (format(dateRange.from, 'dd/MM'))) : (<span>Selector de Rango</span>)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={handleSetDateRangeState} numberOfMonths={2} locale={es} />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <div className="relative w-full mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por Nombre, CURP o Folio de cita en cualquier servicio..." 
                        className="pl-9 h-11"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* CITAS MEDICAS */}
                <TabsContent value="citas-medicas" className="mt-0 space-y-6">
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4 border-b">
                            <div>
                                <CardTitle className="text-xl">Consultas Externas Generales</CardTitle>
                                <CardDescription>Filtrado dinámico por núcleo y especialidad.</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-9 border-dashed">
                                            <PlusCircle className="mr-2 h-4 w-4" /> Tipo de Consulta
                                            {selectedClinicType !== 'all' && <Badge variant="secondary" className="ml-2 px-1 font-normal">{selectedClinicType}</Badge>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[200px] p-0" align="start">
                                        <Command>
                                            <CommandList>
                                                <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem onSelect={() => { setSelectedClinicType('all'); setSelectedClinics([]); }}>
                                                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", selectedClinicType === 'all' ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                                            <Check className="h-4 w-4" />
                                                        </div>
                                                        <span>Todos</span>
                                                    </CommandItem>
                                                    {specialties.map(spec => (
                                                        <CommandItem key={spec.id} onSelect={() => { setSelectedClinicType(spec.name); setSelectedClinics([]); }}>
                                                            <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", selectedClinicType === spec.name ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                                                <Check className="h-4 w-4" />
                                                            </div>
                                                            <span>{spec.name}</span>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-9 border-dashed">
                                            <PlusCircle className="mr-2 h-4 w-4" /> Núcleo
                                            {selectedClinics.length > 0 && (
                                                <Badge variant="secondary" className="ml-2 rounded-sm px-1 font-normal">
                                                    {selectedClinics.length}
                                                </Badge>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[250px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Buscar núcleo..." />
                                            <CommandList>
                                                <CommandEmpty>No se encontraron núcleos.</CommandEmpty>
                                                <CommandGroup>
                                                    {clinics
                                                        .filter(c => selectedClinicType === 'all' || c.clinicType === selectedClinicType)
                                                        .sort((a,b) => a.name.localeCompare(b.name))
                                                        .map((clinic) => {
                                                            const isSelected = selectedClinics.includes(clinic.id)
                                                            return (
                                                                <CommandItem
                                                                    key={clinic.id}
                                                                    onSelect={() => handleClinicSelectState(clinic.id)}
                                                                >
                                                                    <div
                                                                        className={cn(
                                                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                            isSelected
                                                                                ? "bg-primary text-primary-foreground"
                                                                                : "opacity-50 [&_svg]:invisible"
                                                                        )}
                                                                    >
                                                                        <Check className="h-4 w-4" />
                                                                    </div>
                                                                    <span>{clinic.name}</span>
                                                                </CommandItem>
                                                            )
                                                        })}
                                                </CommandGroup>
                                                {selectedClinics.length > 0 && (
                                                    <>
                                                        <CommandSeparator />
                                                        <CommandGroup>
                                                            <CommandItem
                                                                onSelect={() => setSelectedClinics([])}
                                                                className="justify-center text-center"
                                                            >
                                                                Limpiar filtros
                                                            </CommandItem>
                                                        </CommandGroup>
                                                    </>
                                                )}
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                <Button onClick={() => handleDownload('citas')} variant="secondary" size="sm" className="h-9"><Download className="mr-2 h-4 w-4" />Excel</Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <AppointmentList appointments={appointmentsToDisplay} onDelete={(id) => handleDeleteState(id, 'medical')} onEditSuccess={fetchData} isAdmin clinics={clinics} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* LABORATORIO */}
                <TabsContent value="laboratorio" className="mt-0 space-y-8">
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between border-b">
                            <div><CardTitle className="text-xl">Citas de Laboratorio Clínico</CardTitle></div>
                            <Button onClick={() => handleDownload('laboratorio')} variant="secondary" size="sm"><Download className="mr-2 h-4 w-4" />Excel</Button>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <LabAppointmentList appointments={labAppointmentsToDisplay} onDelete={(id) => handleDeleteState(id, 'lab')} onEditSuccess={fetchData} isAdmin />
                        </CardContent>
                    </Card>
                    <LabSettingsManager />
                </TabsContent>

                {/* RAYOS X */}
                <TabsContent value="rayos-x" className="mt-0 space-y-8">
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between border-b">
                            <div><CardTitle className="text-xl">Citas de Radiología (Rayos X)</CardTitle></div>
                            <Button onClick={() => handleDownload('rayos-x')} variant="secondary" size="sm"><Download className="mr-2 h-4 w-4" />Excel</Button>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <XRayAppointmentList appointments={xRayAppointmentsToDisplay} onDelete={(id) => handleDeleteState(id, 'xray')} onEditSuccess={fetchData} isAdmin />
                        </CardContent>
                    </Card>
                    <XRaySettingsManager />
                </TabsContent>
                
                {/* ULTRASONIDOS */}
                <TabsContent value="ultrasonidos" className="mt-0 space-y-8">
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between border-b">
                            <div><CardTitle className="text-xl">Citas de Ultrasonografía</CardTitle></div>
                            <Button onClick={() => handleDownload('ultrasonidos')} variant="secondary" size="sm"><Download className="mr-2 h-4 w-4" />Excel</Button>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <UltrasoundAppointmentList appointments={ultrasoundAppointmentsToDisplay} onDelete={(id) => handleDeleteState(id, 'us')} onEditSuccess={fetchData} isAdmin />
                        </CardContent>
                    </Card>
                    <UltrasoundSettingsManager />
                </TabsContent>

                {/* VACUNAS */}
                <TabsContent value="vacunas" className="mt-0 space-y-8">
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between border-b">
                            <div><CardTitle className="text-xl">Citas de Vacunación Preventiva</CardTitle></div>
                            <Button onClick={() => handleDownload('vacunas')} variant="secondary" size="sm"><Download className="mr-2 h-4 w-4" />Excel</Button>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <VaccineAppointmentList appointments={vaccineAppointmentsToDisplay} onDelete={(id) => handleDeleteState(id, 'vaccine')} onEditSuccess={fetchData} isAdmin />
                        </CardContent>
                    </Card>
                    <VaccineSettingsManager />
                </TabsContent>
            </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}