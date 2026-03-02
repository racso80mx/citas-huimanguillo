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
import { 
  Loader2, 
  LogOut, 
  Search, 
  Users, 
  UserCheck, 
  Clock, 
  UserX,
  PlusCircle,
  Check,
  RefreshCw,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  getPatients, 
  getPatientCounts, 
  deletePatient, 
  updatePatientStatus, 
  savePatient, 
  getAppointments, 
  getClinics, 
  updatePatient, 
  deleteAppointment 
} from '@/lib/actions';
import type { Patient, Appointment, Clinic, ArchiveCounts } from '@/lib/definitions';
import { PatientStatus as PatientStatusEnum } from '@/lib/definitions';
import { PatientList } from './patient-list';
import { MassUploadDialog } from './mass-upload-dialog';
import { EditPatientDialog } from './edit-patient-dialog';
import { ScheduleAppointmentDialog } from './schedule-appointment-dialog';
import { AppointmentList } from '../appointment-list';
import { v4 as uuidv4 } from 'uuid';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ArchiveDashboardProps = {
  onLogout: () => void;
};

export function ArchiveDashboard({ onLogout }: ArchiveDashboardProps) {
  const [activeTab, setActiveTab] = useState('patients');

  // Patient states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [counts, setCounts] = useState<ArchiveCounts>({ total: 0, vigente: 0, bajaTemporal: 0, bajaDefinitiva: 0 });
  
  // Search fields
  const [searchName, setSearchName] = useState('');
  const [searchCurp, setSearchCurp] = useState('');
  const [searchExpediente, setSearchExpediente] = useState('');
  
  const [statusFilter, setStatusFilter] = useState<'Total' | PatientStatusEnum>(PatientStatusEnum.Vigente);
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [schedulingPatient, setSchedulingPatient] = useState<Patient | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  
  // Appointment states
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinics, setSelectedClinics] = useState<string[]>([]);

  // Common states
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSubmitting, startSubmitTransition] = useTransition();

  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsDataLoading(true);
    
    try {
      // Usamos parámetros optimizados para evitar errores de índices en búsquedas por nombre/curp
      const searchOptions = { 
          status: statusFilter, 
          searchName: searchName.trim() || undefined,
          searchCurp: searchCurp.trim() || undefined,
          searchExpediente: searchExpediente.trim() || undefined,
          limitNum: (searchName || searchCurp || searchExpediente) ? 100 : 5000 
      };

      const [patientsData, countsData, clinicsData, appointmentsData] = await Promise.all([
        getPatients(searchOptions),
        getPatientCounts(),
        getClinics(),
        getAppointments()
      ]);
      
      setPatients(patientsData || []);
      setCounts(countsData);
      setClinics(clinicsData || []);
      setAllAppointments(appointmentsData || []);
      setCurrentPage(1); 
    } catch (error: any) {
      console.error("Dashboard error:", error);
      toast({
        title: 'Error de Consulta',
        description: 'No se pudieron recuperar los registros. Por favor, intenta con una búsqueda más específica.',
        variant: 'destructive',
      });
    } finally {
      setIsDataLoading(false);
    }
  }, [statusFilter, searchName, searchCurp, searchExpediente, toast]);
  
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]); 

  const handleClearSearch = () => {
      setSearchName('');
      setSearchCurp('');
      setSearchExpediente('');
      // El useEffect anterior se encargará de recargar al resetear si fuera necesario,
      // pero aquí forzamos la carga del filtro base.
      loadData();
  };

  const paginatedPatients = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return patients.slice(startIndex, startIndex + rowsPerPage);
  }, [patients, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(patients.length / rowsPerPage);

  const handleAddNew = () => { setEditingPatient(null); setIsEditOpen(true); };
  const handleEdit = (patient: Patient) => { setEditingPatient(patient); setIsEditOpen(true); };
  const handleSchedule = (patient: Patient) => { setSchedulingPatient(patient); };
  
  const handleDelete = (patientId: string) => {
    startSubmitTransition(async () => {
      const result = await deletePatient(patientId);
      if(result.success) {
        toast({ title: "Paciente Eliminado"});
        loadData();
      }
    });
  }

  const handleAppointmentDelete = (appointmentId: string) => {
    startSubmitTransition(async () => {
        const result = await deleteAppointment(appointmentId);
        if (result.success) {
            toast({ title: 'Cita Eliminada' });
            loadData();
        }
    });
  };
  
  const handleStatusChange = (patientId: string, newStatus: PatientStatusEnum) => {
    startSubmitTransition(async () => {
      const result = await updatePatientStatus(patientId, newStatus);
       if(result.success) {
        toast({ title: "Estado Actualizado" });
        loadData();
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
        loadData();
      }
    });
  }

  const handleDownloadExcel = async () => {
    if (patients.length === 0) {
        toast({ title: "No hay datos", variant: "destructive"});
        return;
    }
    const xlsx = await import('xlsx');
    const worksheetData = patients.map(p => ({
        'No.Expediente': p.expediente ?? '', 
        'Nombre': p.name ?? '', 
        'Apaterno': p.paternalLastName ?? '', 
        'Amaterno': p.maternalLastName ?? '', 
        'FNacimiento': p.birthDate ?? '', 
        'Edad': p.age ?? '', 
        'Sexo': p.sex ?? '', 
        'Domicilio': p.address ?? '', 
        'Estatus': p.status ?? 'Vigente', 
        'Telefono': p.phoneNumber ?? '', 
        'CURP': p.curp ?? '',
    }));
    const ws = xlsx.utils.json_to_sheet(worksheetData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Pacientes');
    xlsx.writeFile(wb, `padron_pacientes_${statusFilter}.xlsx`);
  }

  const handleClinicSelect = (clinicId: string) => {
    setSelectedClinics(prev => 
        prev.includes(clinicId) 
            ? prev.filter(id => id !== clinicId)
            : [...prev, clinicId]
    );
  };

  const appointmentsToDisplay = useMemo(() => {
    let filtered = [...allAppointments];
    if (selectedClinics.length > 0) {
        filtered = filtered.filter(app => selectedClinics.includes(app.clinicId));
    }
    return filtered;
  }, [allAppointments, selectedClinics]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Card className="border-none shadow-none bg-transparent mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-headline">Control de Archivo</h1>
            <p className="text-muted-foreground">Gestión integral del padrón de pacientes y citas.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={loadData} disabled={isDataLoading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isDataLoading && "animate-spin")} />
              Actualizar Datos
            </Button>
            <Button variant="outline" onClick={onLogout} className="flex-1 sm:flex-none">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Pacientes Vigentes', count: counts.vigente, status: PatientStatusEnum.Vigente, icon: UserCheck, color: 'text-green-600' },
          { label: 'Baja Temporal', count: counts.bajaTemporal, status: PatientStatusEnum.Baja, icon: Clock, color: 'text-yellow-600' },
          { label: 'Baja Definitiva', count: counts.bajaDefinitiva, status: PatientStatusEnum.BajaDefinitiva, icon: UserX, color: 'text-red-600' },
          { label: 'Total de Pacientes', count: counts.total, status: 'Total' as const, icon: Users, color: 'text-primary' }
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => { setStatusFilter(item.status); }}
            className={cn(
              "group relative flex flex-col items-start p-4 rounded-xl border transition-all duration-200 text-left outline-none",
              statusFilter === item.status 
                ? "bg-card border-primary ring-2 ring-primary/20 shadow-lg scale-[1.02]" 
                : "bg-muted/30 border-transparent hover:bg-muted/50 hover:border-muted-foreground/20"
            )}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <item.icon className={cn("h-5 w-5", item.color)} />
              {statusFilter === item.status && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</span>
            <span className={cn("text-2xl font-bold", item.color)}>{item.count.toLocaleString()}</span>
          </button>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="patients">Padrón de Pacientes</TabsTrigger>
          <TabsTrigger value="appointments">Reporte de Citas</TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="space-y-4 pt-4">
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex flex-col space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Nombre del Paciente..." 
                            value={searchName} 
                            onChange={e => setSearchName(e.target.value.toUpperCase())} 
                            onKeyDown={e => e.key === 'Enter' && loadData()}
                            className="pl-9 h-11"
                        />
                    </div>
                    <Input 
                        placeholder="CURP (Exacto)..." 
                        value={searchCurp} 
                        onChange={e => setSearchCurp(e.target.value.toUpperCase())} 
                        onKeyDown={e => e.key === 'Enter' && loadData()}
                        className="h-11"
                        maxLength={18}
                    />
                    <Input 
                        placeholder="No. Expediente (Exacto)..." 
                        value={searchExpediente} 
                        onChange={e => setSearchExpediente(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && loadData()}
                        className="h-11"
                    />
                    <div className="flex gap-2">
                        <Button onClick={loadData} className="h-11 flex-1 font-bold" disabled={isDataLoading}>
                            {isDataLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                            BUSCAR
                        </Button>
                        <Button variant="outline" onClick={handleClearSearch} className="h-11" title="Limpiar Búsqueda">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t mt-2">
                  <Button onClick={handleAddNew} size="sm" className="bg-primary hover:bg-primary/90">
                    <PlusCircle className="h-4 w-4 mr-2" /> Nuevo Paciente
                  </Button>
                  <Button onClick={() => setIsUploadOpen(true)} variant="secondary" size="sm">
                    <Upload className="h-4 w-4 mr-2" /> Cargar Excel
                  </Button>
                  <Button onClick={handleDownloadExcel} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" /> Exportar Padrón
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="relative min-h-[400px]">
              {isDataLoading && (
                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-lg">
                    <div className="bg-card border shadow-2xl p-8 rounded-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                        <Loader2 className="h-16 w-12 animate-spin text-primary" />
                        <div className="text-center">
                            <p className="text-xl font-black text-primary animate-pulse tracking-widest uppercase">
                                Procesando Consulta
                            </p>
                            <p className="text-sm text-muted-foreground mt-1 font-medium">Buscando en los registros del hospital...</p>
                        </div>
                    </div>
                </div>
              )}

              {patients.length === 0 && !isDataLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-4 opacity-60">
                  <Users className="h-16 w-16 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-bold">No se encontraron registros</p>
                    <p className="text-sm text-muted-foreground">Intenta con otros criterios de búsqueda o verifica el estatus seleccionado.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <PatientList 
                    patients={paginatedPatients} 
                    onEdit={handleEdit} 
                    onDelete={handleDelete} 
                    onStatusChange={handleStatusChange} 
                    onSchedule={handleSchedule} 
                    isSubmitting={isSubmitting}
                  />
                  
                  <div className="flex flex-col sm:flex-row items-center justify-between border-t pt-4 gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">Registros por página</span>
                      <Select value={String(rowsPerPage)} onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="200">200</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground whitespace-nowrap font-bold">Total: {patients.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Anterior</Button>
                      <div className="bg-muted px-3 py-1 rounded-md text-sm font-medium">Página {currentPage} de {totalPages || 1}</div>
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage >= totalPages || totalPages === 0}>Siguiente</Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="pt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <CardTitle>Historial Reciente de Citas</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="h-10 border-dashed">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Filtrar por Núcleo
                            {selectedClinics.length > 0 && (
                                <>
                                    <Separator orientation="vertical" className="mx-2 h-4" />
                                    <Badge
                                        variant="secondary"
                                        className="rounded-sm px-1 font-normal"
                                    >
                                        {selectedClinics.length}
                                    </Badge>
                                </>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="end">
                        <Command>
                            <CommandInput placeholder="Buscar núcleo..." />
                            <CommandList>
                                <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                                <CommandGroup>
                                    {clinics.sort((a,b) => a.name.localeCompare(b.name)).map(clinic => {
                                        const isSelected = selectedClinics.includes(clinic.id);
                                        return (
                                            <CommandItem
                                                key={clinic.id}
                                                onSelect={() => handleClinicSelect(clinic.id)}
                                            >
                                                <div
                                                    className={cn(
                                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                        isSelected
                                                            ? "bg-primary text-primary-foreground"
                                                            : "opacity-50 [&_svg]:invisible"
                                                    )}
                                                >
                                                    <Check className={cn("h-4 w-4")} />
                                                </div>
                                                <span>{clinic.name}</span>
                                            </CommandItem>
                                        );
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
                                                Limpiar filtro
                                            </CommandItem>
                                        </CommandGroup>
                                    </>
                                )}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" onClick={loadData} disabled={isDataLoading}>
                    <RefreshCw className={cn("h-4 w-4", isDataLoading && "animate-spin")} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative min-h-[300px]">
              {isDataLoading && allAppointments.length === 0 ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {isDataLoading && allAppointments.length > 0 && (
                    <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px] flex items-center justify-center rounded-lg">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                  )}
                  <AppointmentList 
                    appointments={appointmentsToDisplay} 
                    clinics={clinics} 
                    isAdmin 
                    onDelete={handleAppointmentDelete} 
                    onEditSuccess={loadData} 
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MassUploadDialog isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUploadSuccess={loadData} />
      {isEditOpen && <EditPatientDialog isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} patient={editingPatient} onSave={handleSavePatient} isSaving={isSubmitting} />}
      {schedulingPatient && <ScheduleAppointmentDialog patient={schedulingPatient} isOpen={!!schedulingPatient} onClose={() => setSchedulingPatient(null)} onBookingSuccess={() => { setSchedulingPatient(null); loadData(); }} clinics={clinics} colonias={[]} />}
    </div>
  );
}
