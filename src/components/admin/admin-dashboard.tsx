'use client';
import { useState, useTransition, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LogOut,
  RefreshCw,
  Settings,
  UserRound,
  ClipboardList,
  LayoutList,
  Plus,
  Trash2,
  Loader2,
  Search,
  LayoutGrid
} from 'lucide-react';
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
import { getServiceTypes, updateServiceTypes, getAppointments, getLabAppointments, getXRayAppointments, getUltrasoundAppointments, getVaccineAppointments, getClinics, deleteAppointment, deleteLabAppointment, deleteXRayAppointment, deleteUltrasoundAppointment, deleteVaccineAppointment } from '@/lib/actions';
import React from 'react';
import { AppointmentList } from '../appointment-list';
import { LabAppointmentList } from '../laboratorio/lab-appointment-list';
import { XRayAppointmentList } from '../rayos-x/x-ray-appointment-list';
import { UltrasoundAppointmentList } from '../ultrasonidos/ultrasound-appointment-list';
import { VaccineAppointmentList } from '../vacunas/vaccine-appointment-list';

function ServiceTypesManager() {
  const [types, setTypes] = useState<any[]>([]);
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
  const handleUpdate = (id: string, field: string, val: any) => {
    setTypes(types.map(t => t.id === id ? { ...t, [field]: val } : t));
  };

  const handleSave = () => {
    startSaving(async () => {
      const res = await updateServiceTypes(types);
      if (res.success) toast({ title: 'Tipos de Consulta guardados' });
    });
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <Card className="shadow-lg border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><LayoutList /> Tipos de Consulta</CardTitle>
          <CardDescription>Define las categorías generales de atención.</CardDescription>
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
                <TableCell><Input value={t.name} onChange={e => handleUpdate(t.id, 'name', e.target.value.toUpperCase())} placeholder="Nombre..." /></TableCell>
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

function AppointmentsViewer() {
    const [searchTerm, setSearchTerm] = useState('');
    const [data, setData] = useState<any>({ apps: [], lab: [], xr: [], us: [], vac: [], clinics: [] });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [apps, lab, xr, us, vac, clinics] = await Promise.all([
                getAppointments(), getLabAppointments(), getXRayAppointments(), getUltrasoundAppointments(), getVaccineAppointments(), getClinics()
            ]);
            setData({ apps, lab, xr, us, vac, clinics });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handlePatientDelete = async (id: string, type: string) => {
        let res;
        if (type === 'medical') res = await deleteAppointment(id);
        if (type === 'lab') res = await deleteLabAppointment(id);
        if (type === 'xr') res = await deleteXRayAppointment(id);
        if (type === 'us') res = await deleteUltrasoundAppointment(id);
        if (type === 'vac') res = await deleteVaccineAppointment(id);
        if (res?.success) fetchData();
    };

    const filter = (list: any[]) => {
        if (!searchTerm) return list;
        const t = searchTerm.toUpperCase();
        return list.filter(a => {
            const name = `${a.patient?.name || ''} ${a.patient?.paternalLastName || ''} ${a.patient?.maternalLastName || ''}`.toUpperCase();
            return name.includes(t) || String(a.appointmentNumber).toUpperCase().includes(t) || String(a.patient?.curp || '').toUpperCase().includes(t);
        });
    };

    if (loading) return <div className="p-20 flex flex-col items-center gap-4"><Loader2 className="animate-spin h-10 w-10 text-primary" /><p className='text-xs font-bold uppercase animate-pulse'>Sincronizando Agenda...</p></div>;

    return (
        <div className="space-y-6">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por Nombre, CURP o Folio..." className="pl-9 h-11" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Tabs defaultValue="medical">
                <TabsList className="bg-muted/40 p-1 mb-4">
                  <TabsTrigger value="medical">General</TabsTrigger>
                  <TabsTrigger value="lab">Laboratorio</TabsTrigger>
                  <TabsTrigger value="xr">Rayos X</TabsTrigger>
                  <TabsTrigger value="us">Ultrasonidos</TabsTrigger>
                  <TabsTrigger value="vac">Vacunas</TabsTrigger>
                </TabsList>
                <TabsContent value="medical"><AppointmentList appointments={filter(data.apps)} clinics={data.clinics} isAdmin onDelete={(id) => handlePatientDelete(id, 'medical')} onEditSuccess={fetchData} /></TabsContent>
                <TabsContent value="lab"><LabAppointmentList appointments={filter(data.lab)} isAdmin onDelete={(id) => handlePatientDelete(id, 'lab')} onEditSuccess={fetchData} /></TabsContent>
                <TabsContent value="xr"><XRayAppointmentList appointments={filter(data.xr)} isAdmin onDelete={(id) => handlePatientDelete(id, 'xr')} onEditSuccess={fetchData} /></TabsContent>
                <TabsContent value="us"><UltrasoundAppointmentList appointments={filter(data.us)} isAdmin onDelete={(id) => handlePatientDelete(id, 'us')} onEditSuccess={fetchData} /></TabsContent>
                <TabsContent value="vac"><VaccineAppointmentList appointments={filter(data.vac)} isAdmin onDelete={(id) => handlePatientDelete(id, 'vac')} onEditSuccess={fetchData} /></TabsContent>
            </Tabs>
        </div>
    );
}

export function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [mainTab, setMainTab] = useState("configuracion");

  return (
    <div className="space-y-8">
      <Card className="shadow-lg border-primary/10">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="text-3xl font-bold font-headline">Panel Administrativo</CardTitle>
            <CardDescription>Control global del hospital y sus servicios.</CardDescription>
          </div>
          <Button variant="outline" onClick={onLogout}><LogOut className="mr-2 h-4 w-4" /> Salir</Button>
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

        <TabsContent value="catalogos" className="animate-in fade-in space-y-8">
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

        <TabsContent value="citas" className="animate-in fade-in">
            <AppointmentsViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
