'use client';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import type { Appointment, Clinic, Colonia, LabAppointment, XRayAppointment, UltrasoundAppointment, VaccineAppointment } from '@/lib/definitions';
import { deleteAppointment, deleteLabAppointment, deleteXRayAppointment, deleteUltrasoundAppointment, deleteVaccineAppointment } from '@/lib/actions';
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
} from 'lucide-react';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
} from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Calendar } from '../ui/calendar';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { cn, downloadExcel } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AnnouncementsManager } from './announcements-manager';
import { ClinicsManager } from './clinics-manager';
import { ColoniasManager } from './colonias-manager';
import { LabSettingsManager } from './lab-settings-manager';
import { XRaySettingsManager } from './x-ray-settings-manager';
import { UltrasoundSettingsManager } from './ultrasound-settings-manager';
import { VaccineSettingsManager } from './vaccine-settings-manager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleManager } from './module-manager';
import { BackupManager } from './backup-manager';
import { UsersManager } from './users-manager';


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

  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("configuracion");
  const [activeFilter, setActiveFilter] = useState<FilterType>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isClient, setIsClient] = useState(false);
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
        ] = await Promise.all([
          getAppointments(),
          getLabAppointments(),
          getXRayAppointments(),
          getUltrasoundAppointments(),
          getVaccineAppointments(),
          getClinics(),
          getColonias(),
        ]);
        setAllAppointments(appointmentsData);
        setAllLabAppointments(labAppointmentsData);
        setAllXRayAppointments(xRayAppointmentsData);
        setAllUltrasoundAppointments(ultrasoundAppointmentsData);
        setAllVaccineAppointments(vaccineAppointmentsData);
        setClinics(clinicsData);
        setColonias(coloniasData);
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
          return appDate >= weekStart && appDate <= weekEnd;
        };
        break;
      case 'month':
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        filterFn = (app) => {
          const appDate = parseISO(app.date);
          return appDate >= monthStart && appDate <= monthEnd;
        };
        break;
      case 'range':
        if (dateRange?.from && dateRange?.to) {
          const rangeStart = startOfDay(dateRange.from);
          const rangeEnd = endOfDay(dateRange.to);
          filterFn = (app) => {
            const appDate = parseISO(app.date);
            return appDate >= rangeStart && appDate <= rangeEnd;
          };
        } else {
          return []; // No range selected, show nothing
        }
        break;
      case 'today':
      default:
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        filterFn = (app) => {
          const appDate = parseISO(app.date);
          return appDate >= todayStart && appDate <= todayEnd;
        };
        break;
    }
    return appointments.filter(filterFn);
  };
  
  const appointmentsToDisplay = useMemo(() => getFilteredData(allAppointments), [isClient, activeFilter, dateRange, allAppointments]);
  const labAppointmentsToDisplay = useMemo(() => getFilteredData(allLabAppointments), [isClient, activeFilter, dateRange, allLabAppointments]);
  const xRayAppointmentsToDisplay = useMemo(() => getFilteredData(allXRayAppointments), [isClient, activeFilter, dateRange, allXRayAppointments]);
  const ultrasoundAppointmentsToDisplay = useMemo(() => getFilteredData(allUltrasoundAppointments), [isClient, activeFilter, dateRange, allUltrasoundAppointments]);
  const vaccineAppointmentsToDisplay = useMemo(() => getFilteredData(allVaccineAppointments), [isClient, activeFilter, dateRange, allVaccineAppointments]);


  const handleSetDateRange = (range: DateRange | undefined) => {
    setDateRange(range);
    setActiveFilter('range');
  };

  const handleDownload = () => {
    let dataToDownload: any[] = [];
    let filename = '';

    if (activeTab === 'citas') {
        dataToDownload = appointmentsToDisplay;
        filename = 'citas_medicas';
    } else if (activeTab === 'laboratorio') {
        dataToDownload = labAppointmentsToDisplay;
        filename = 'citas_laboratorio';
    } else if (activeTab === 'rayos-x') {
        dataToDownload = xRayAppointmentsToDisplay;
        filename = 'citas_rayos_x';
    } else if (activeTab === 'ultrasonidos') {
        dataToDownload = ultrasoundAppointmentsToDisplay;
        filename = 'citas_ultrasonidos';
    } else if (activeTab === 'vacunas') {
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
        const patientColonia = colonias.find((c) => c.clinicId === app.clinicId);
        return {
        ...app,
        clinicName: clinic?.name || 'N/A',
        coloniaName: patientColonia?.name || 'N/A', 
        };
    });

    downloadExcel(enrichedAppointments, `${filename}_${activeFilter}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAppointment(id);
      toast({
        title: 'Cita Eliminada',
        description: 'La cita ha sido eliminada y el cupo liberado.',
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

  const handleLabDelete = async (id: string) => {
    try {
      await deleteLabAppointment(id);
      toast({
        title: 'Cita de Laboratorio Eliminada',
        description: 'La cita ha sido eliminada.',
      });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cita de laboratorio.',
        variant: 'destructive',
      });
    }
  };
  
  const handleXRayDelete = async (id: string) => {
    try {
      await deleteXRayAppointment(id);
      toast({
        title: 'Cita de Rayos X Eliminada',
        description: 'La cita ha sido eliminada.',
      });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cita de Rayos X.',
        variant: 'destructive',
      });
    }
  };
  
  const handleUltrasoundDelete = async (id: string) => {
    try {
      await deleteUltrasoundAppointment(id);
      toast({
        title: 'Cita de Ultrasonido Eliminada',
        description: 'La cita ha sido eliminada.',
      });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cita de Ultrasonido.',
        variant: 'destructive',
      });
    }
  };
  
  const handleVaccineDelete = async (id: string) => {
    try {
      await deleteVaccineAppointment(id);
      toast({
        title: 'Cita de Vacunación Eliminada',
        description: 'La cita ha sido eliminada.',
      });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cita de vacunación.',
        variant: 'destructive',
      });
    }
  };


  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-3xl font-bold font-headline">
              Panel de Administración
            </CardTitle>
            <CardDescription>
              Bienvenido, SuperAdmin. Gestiona las citas y configuraciones.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData} disabled={isPending}>
              <RefreshCw
                className={cn('mr-2 h-4 w-4', isPending && 'animate-spin')}
              />
              Recargar Datos
            </Button>
            <Button variant="outline" onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </CardHeader>
      </Card>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="configuracion">Configuración</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="citas">Citas Médicas</TabsTrigger>
          <TabsTrigger value="laboratorio">Laboratorio</TabsTrigger>
          <TabsTrigger value="rayos-x">Rayos X</TabsTrigger>
          <TabsTrigger value="ultrasonidos">Ultrasonidos</TabsTrigger>
          <TabsTrigger value="vacunas">Vacunas</TabsTrigger>
        </TabsList>

        <TabsContent value="configuracion" className="mt-6">
            <div className="space-y-8">
                <ModuleManager />
                <ColoniasManager />
                <AnnouncementsManager />
                <BackupManager onRestoreSuccess={fetchData} />
            </div>
        </TabsContent>
        
        <TabsContent value="usuarios" className="mt-6">
            <UsersManager />
        </TabsContent>

        <TabsContent value="citas" className="mt-6 space-y-8">
            <Card className="w-full shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold font-headline">Reporte de Citas Médicas</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 pt-4">
                    <Button variant={activeFilter === 'today' ? 'default' : 'outline'} onClick={() => setActiveFilter('today')}>Hoy</Button>
                    <Button variant={activeFilter === 'week' ? 'default' : 'outline'} onClick={() => setActiveFilter('week')}>Esta Semana</Button>
                    <Button variant={activeFilter === 'month' ? 'default' : 'outline'} onClick={() => setActiveFilter('month')}>Este Mes</Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button id="date" variant={activeFilter === 'range' ? 'default' : 'outline'} className={cn('w-[260px] justify-start text-left font-normal')}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}</>) : (format(dateRange.from, 'LLL dd, y'))) : (<span>Seleccionar rango</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={handleSetDateRange} numberOfMonths={2} />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleDownload} variant="secondary" className="ml-auto" disabled={isPending}><Download className="mr-2 h-4 w-4" />Descargar Excel</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isPending ? (
                      <div className="flex justify-center items-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-4 text-muted-foreground">Cargando citas...</span>
                      </div>
                  ) : (
                      <AppointmentList appointments={appointmentsToDisplay} onDelete={handleDelete} onEditSuccess={fetchData} isAdmin clinics={clinics} />
                  )}
                </CardContent>
            </Card>
            <ClinicsManager />
        </TabsContent>

        <TabsContent value="laboratorio" className="mt-6 space-y-8">
           <Card className="w-full shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold font-headline">Reporte de Citas de Laboratorio</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 pt-4">
                    <Button variant={activeFilter === 'today' ? 'default' : 'outline'} onClick={() => setActiveFilter('today')}>Hoy</Button>
                    <Button variant={activeFilter === 'week' ? 'default' : 'outline'} onClick={() => setActiveFilter('week')}>Esta Semana</Button>
                    <Button variant={activeFilter === 'month' ? 'default' : 'outline'} onClick={() => setActiveFilter('month')}>Este Mes</Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button id="date-lab" variant={activeFilter === 'range' ? 'default' : 'outline'} className={cn('w-[260px] justify-start text-left font-normal')}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}</>) : (format(dateRange.from, 'LLL dd, y'))) : (<span>Seleccionar rango</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={handleSetDateRange} numberOfMonths={2} />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleDownload} variant="secondary" className="ml-auto" disabled={isPending}><Download className="mr-2 h-4 w-4" />Descargar Excel</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isPending ? (
                    <div className="flex justify-center items-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-4 text-muted-foreground">Cargando citas...</span>
                    </div>
                  ) : (
                    <LabAppointmentList appointments={labAppointmentsToDisplay} onDelete={handleLabDelete} onEditSuccess={fetchData} isAdmin />
                  )}
                </CardContent>
            </Card>
            <LabSettingsManager />
        </TabsContent>

        <TabsContent value="rayos-x" className="mt-6 space-y-8">
           <Card className="w-full shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold font-headline">Reporte de Citas de Rayos X</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 pt-4">
                    <Button variant={activeFilter === 'today' ? 'default' : 'outline'} onClick={() => setActiveFilter('today')}>Hoy</Button>
                    <Button variant={activeFilter === 'week' ? 'default' : 'outline'} onClick={() => setActiveFilter('week')}>Esta Semana</Button>
                    <Button variant={activeFilter === 'month' ? 'default' : 'outline'} onClick={() => setActiveFilter('month')}>Este Mes</Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button id="date-xray" variant={activeFilter === 'range' ? 'default' : 'outline'} className={cn('w-[260px] justify-start text-left font-normal')}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}</>) : (format(dateRange.from, 'LLL dd, y'))) : (<span>Seleccionar rango</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={handleSetDateRange} numberOfMonths={2} />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleDownload} variant="secondary" className="ml-auto" disabled={isPending}><Download className="mr-2 h-4 w-4" />Descargar Excel</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isPending ? (
                    <div className="flex justify-center items-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-4 text-muted-foreground">Cargando citas...</span>
                    </div>
                  ) : (
                    <XRayAppointmentList appointments={xRayAppointmentsToDisplay} onDelete={handleXRayDelete} onEditSuccess={fetchData} isAdmin />
                  )}
                </CardContent>
            </Card>
            <XRaySettingsManager />
        </TabsContent>
        
        <TabsContent value="ultrasonidos" className="mt-6 space-y-8">
           <Card className="w-full shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold font-headline">Reporte de Citas de Ultrasonido</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 pt-4">
                    <Button variant={activeFilter === 'today' ? 'default' : 'outline'} onClick={() => setActiveFilter('today')}>Hoy</Button>
                    <Button variant={activeFilter === 'week' ? 'default' : 'outline'} onClick={() => setActiveFilter('week')}>Esta Semana</Button>
                    <Button variant={activeFilter === 'month' ? 'default' : 'outline'} onClick={() => setActiveFilter('month')}>Este Mes</Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button id="date-ultrasound" variant={activeFilter === 'range' ? 'default' : 'outline'} className={cn('w-[260px] justify-start text-left font-normal')}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}</>) : (format(dateRange.from, 'LLL dd, y'))) : (<span>Seleccionar rango</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={handleSetDateRange} numberOfMonths={2} />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleDownload} variant="secondary" className="ml-auto" disabled={isPending}><Download className="mr-2 h-4 w-4" />Descargar Excel</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isPending ? (
                    <div className="flex justify-center items-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-4 text-muted-foreground">Cargando citas...</span>
                    </div>
                  ) : (
                    <UltrasoundAppointmentList appointments={ultrasoundAppointmentsToDisplay} onDelete={handleUltrasoundDelete} onEditSuccess={fetchData} isAdmin />
                  )}
                </CardContent>
            </Card>
            <UltrasoundSettingsManager />
        </TabsContent>

        <TabsContent value="vacunas" className="mt-6 space-y-8">
           <Card className="w-full shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold font-headline">Reporte de Citas de Vacunación</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 pt-4">
                    <Button variant={activeFilter === 'today' ? 'default' : 'outline'} onClick={() => setActiveFilter('today')}>Hoy</Button>
                    <Button variant={activeFilter === 'week' ? 'default' : 'outline'} onClick={() => setActiveFilter('week')}>Esta Semana</Button>
                    <Button variant={activeFilter === 'month' ? 'default' : 'outline'} onClick={() => setActiveFilter('month')}>Este Mes</Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button id="date-vaccine" variant={activeFilter === 'range' ? 'default' : 'outline'} className={cn('w-[260px] justify-start text-left font-normal')}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, 'LLL dd, y')} - {format(dateRange.to, 'LLL dd, y')}</>) : (format(dateRange.from, 'LLL dd, y'))) : (<span>Seleccionar rango</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={handleSetDateRange} numberOfMonths={2} />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleDownload} variant="secondary" className="ml-auto" disabled={isPending}><Download className="mr-2 h-4 w-4" />Descargar Excel</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isPending ? (
                    <div className="flex justify-center items-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-4 text-muted-foreground">Cargando citas...</span>
                    </div>
                  ) : (
                    <VaccineAppointmentList appointments={vaccineAppointmentsToDisplay} onDelete={handleVaccineDelete} onEditSuccess={fetchData} isAdmin />
                  )}
                </CardContent>
            </Card>
            <VaccineSettingsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
