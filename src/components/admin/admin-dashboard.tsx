
'use client';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import type { Appointment, Clinic, Colonia, LabAppointment, XRayAppointment, UltrasoundAppointment, VaccineAppointment, Specialty, ServiceType } from '@/lib/definitions';
import { 
  getAppointments,
  getLabAppointments,
  getXRayAppointments,
  getUltrasoundAppointments,
  getVaccineAppointments,
  getClinics,
  getColonias,
  deleteAppointment, 
  deleteLabAppointment, 
  deleteXRayAppointment, 
  deleteUltrasoundAppointment, 
  deleteVaccineAppointment, 
  getSpecialties, 
  getServiceTypes, 
  updateServiceTypes
} from '@/lib/actions';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppointmentList } from '../appointment-list';
import { LabAppointmentList } from '../laboratorio/lab-appointment-list';
import { XRayAppointmentList } from '../rayos-x/x-ray-appointment-list';
import { UltrasoundAppointmentList } from '../ultrasonidos/ultrasound-appointment-list';
import { VaccineAppointmentList } from '../vacunas/vaccine-appointment-list';
import {
  LogOut,
  Loader2,
  RefreshCw,
  PlusCircle,
  Search,
  UserRound,
  Settings,
  ClipboardList,
  LayoutList,
  Plus,
  Trash2
} from 'lucide-react';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
  isWithinInterval
} from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { ClinicsManager } from './clinics-manager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleManager } from './module-manager';
import { ActivityLogViewer } from './activity-log-viewer';
import { HolidaysManager } from './holidays-manager';
import { SpecialActionDaysManager } from './special-action-days-manager';
import { ModuleSecurityManager } from './module-security-manager';
import { DoctorsCatalog } from './doctors-catalog';
import { SpecialtiesManager } from './specialties-manager';
import { Input } from '../ui/input';
import { v4 as uuidv4 } from 'uuid';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';

function ServiceTypesManager() {
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, startSaving] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    getServiceTypes().then(data => {
      setTypes(data);
      setLoading(false);
    });
  }, []);

  const handleAdd = () => setTypes([...types, { id: uuidv4(), name: '', available: true }]);
  const handleRemove = (id: string) => setTypes(types.filter(t => t.id !== id));
  const handleUpdate = (id: string, field: keyof ServiceType, val: any) => {
    setTypes(types.map(t => t.id === id ? { ...t, [field]: val } : t));
  };

  const handleSave = () => {
    startSaving(async () => {
      const res = await updateServiceTypes(types);
      if (res.success) toast({ title: 'Tipos de Consulta guardados' });
    });
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;

  return (
    <Card className="shadow-lg border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><LayoutList /> Tipos de Consulta</CardTitle>
          <CardDescription>Define las categorías generales de atención (Externa, Psicología, etc.)</CardDescription>
        </div>
        <Button onClick={handleAdd} variant="outline"><Plus className="mr-2 h-4 w-4" /> Agregar Tipo</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              <TableHead className="w-[100px]">Estado</TableHead>
              <TableHead className="w-[80px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map(t => (
              <TableRow key={t.id}>
                <TableCell><Input value={t.name} onChange={e => handleUpdate(t.id, 'name', e.target.value.toUpperCase())} placeholder="Nombre del tipo..." /></TableCell>
                <TableCell><Switch checked={t.available} onCheckedChange={v => handleUpdate(t.id, 'available', v)} /></TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemove(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter><Button onClick={handleSave} disabled={saving} className="w-full h-12">Guardar Catálogo</Button></CardFooter>
    </Card>
  );
}

export function AdminDashboard({ onLogout }: { onLogout: () => void }) {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isClient, setIsClient] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => { setIsClient(true); }, []);

  const fetchData = useCallback(() => {
    startTransition(async () => {
      try {
        const [ apps, labApps, xrApps, usApps, vacApps, clins, cols, specs ] = await Promise.all([
          getAppointments(), getLabAppointments(), getXRayAppointments(), getUltrasoundAppointments(), getVaccineAppointments(), getClinics(), getColonias(), getSpecialties()
        ]);
        setAllAppointments(apps);
        setAllLabAppointments(labApps);
        setAllXRayAppointments(xrApps);
        setAllUltrasoundAppointments(usApps);
        setAllVaccineAppointments(vacApps);
        setClinics(clins);
        setColonias(cols);
        setSpecialties(specs);
      } catch (error) {
        console.error(error);
      }
    });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getFilteredData = (appointments: any[]) => {
    if (!isClient || !appointments || appointments.length === 0) return [];
    const now = new Date();
    let filterFn: (app: any) => boolean;
    switch (activeFilter) {
      case 'week':
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        filterFn = (app) => isWithinInterval(parseISO(app.date), { start: weekStart, end: weekEnd });
        break;
      case 'month':
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        filterFn = (app) => isWithinInterval(parseISO(app.date), { start: monthStart, end: monthEnd });
        break;
      case 'range':
        if (dateRange?.from) {
          const rangeStart = startOfDay(dateRange.from);
          const rangeEnd = endOfDay(dateRange.to || dateRange.from);
          filterFn = (app) => { const d = parseISO(app.date); return d >= rangeStart && d <= rangeEnd; };
        } else return [];
        break;
      case 'today':
      default:
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        filterFn = (app) => isWithinInterval(parseISO(app.date), { start: todayStart, end: todayEnd });
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

  const appointmentsToDisplay = useMemo(() => applySearch(getFilteredData(allAppointments)), [isClient, activeFilter, dateRange, allAppointments, searchTerm]);
  const labAppointmentsToDisplay = useMemo(() => applySearch(getFilteredData(allLabAppointments)), [isClient, activeFilter, dateRange, allLabAppointments, searchTerm]);
  const xRayAppointmentsToDisplay = useMemo(() => applySearch(getFilteredData(allXRayAppointments)), [isClient, activeFilter, dateRange, allXRayAppointments, searchTerm]);
  const ultrasoundAppointmentsToDisplay = useMemo(() => applySearch(getFilteredData(allUltrasoundAppointments)), [isClient, activeFilter, dateRange, allUltrasoundAppointments, searchTerm]);
  const vaccineAppointmentsToDisplay = useMemo(() => applySearch(getFilteredData(allVaccineAppointments)), [isClient, activeFilter, dateRange, allVaccineAppointments, searchTerm]);

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="text-3xl font-bold font-headline">Administración Central</CardTitle>
            <CardDescription>Gestión de catálogos y configuración.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData} disabled={isPending}><RefreshCw className={cn('mr-2 h-4 w-4', isPending && 'animate-spin')} /> Sincronizar</Button>
            <Button variant="outline" onClick={onLogout}><LogOut className="mr-2 h-4 w-4" /> Salir</Button>
          </div>
        </CardHeader>
      </Card>
      
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto mb-8 bg-muted/20 p-1">
          <TabsTrigger value="configuracion" className="py-3 font-bold flex items-center gap-2"><Settings className="h-4 w-4" /> 1. Configuración</TabsTrigger>
          <TabsTrigger value="catalogos" className="py-3 font-bold flex items-center gap-2"><UserRound className="h-4 w-4" /> 2. Catálogos</TabsTrigger>
          <TabsTrigger value="citas" className="py-3 font-bold flex items-center gap-2"><ClipboardList className="h-4 w-4" /> 3. Citas por Servicio</TabsTrigger>
        </TabsList>

        <TabsContent value="configuracion" className="space-y-8 animate-in fade-in">
            <div className="grid lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <ModuleManager />
                    <ClinicsManager />
                </div>
                <div className="space-y-8">
                    <ModuleSecurityManager />
                    <HolidaysManager />
                    <SpecialActionDaysManager />
                </div>
            </div>
            <ActivityLogViewer />
        </TabsContent>

        <TabsContent value="catalogos" className="animate-in fade-in">
            <Tabs defaultValue="service-types" className="w-full">
                <TabsList className="flex flex-wrap w-fit gap-2 bg-transparent mb-6 border-b rounded-none pb-px h-auto">
                    <TabsTrigger value="service-types" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-6 py-3">Tipos de Consulta</TabsTrigger>
                    <TabsTrigger value="specialties" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-6 py-3">Especialidades Médicas</TabsTrigger>
                    <TabsTrigger value="medicos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-6 py-3">Directorio Médico</TabsTrigger>
                </TabsList>
                <TabsContent value="service-types"><ServiceTypesManager /></TabsContent>
                <TabsContent value="specialties"><SpecialtiesManager /></TabsContent>
                <TabsContent value="medicos"><DoctorsCatalog /></TabsContent>
            </Tabs>
        </TabsContent>

        <TabsContent value="citas" className="space-y-6">
            <div className="relative w-full mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por Nombre, CURP o Folio..." className="pl-9 h-11" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Tabs defaultValue="citas-medicas">
                <TabsList className="bg-muted/40 p-1 mb-4">
                  <TabsTrigger value="citas-medicas">General</TabsTrigger>
                  <TabsTrigger value="laboratorio">Laboratorio</TabsTrigger>
                  <TabsTrigger value="rayosx">Rayos X</TabsTrigger>
                  <TabsTrigger value="ultrasound">Ultrasonidos</TabsTrigger>
                  <TabsTrigger value="vaccine">Vacunas</TabsTrigger>
                </TabsList>
                <TabsContent value="citas-medicas"><AppointmentList appointments={appointmentsToDisplay} clinics={clinics} isAdmin onEditSuccess={fetchData} /></TabsContent>
                <TabsContent value="laboratorio"><LabAppointmentList appointments={labAppointmentsToDisplay} isAdmin onEditSuccess={fetchData} /></TabsContent>
                <TabsContent value="rayosx"><XRayAppointmentList appointments={xRayAppointmentsToDisplay} isAdmin onEditSuccess={fetchData} /></TabsContent>
                <TabsContent value="ultrasound"><UltrasoundAppointmentList appointments={ultrasoundAppointmentsToDisplay} isAdmin onEditSuccess={fetchData} /></TabsContent>
                <TabsContent value="vaccine"><VaccineAppointmentList appointments={vaccineAppointmentsToDisplay} isAdmin onEditSuccess={fetchData} /></TabsContent>
            </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type FilterType = 'today' | 'week' | 'month' | 'range';
