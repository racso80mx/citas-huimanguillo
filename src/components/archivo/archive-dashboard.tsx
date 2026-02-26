
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
  Plus, 
  Upload, 
  Download, 
  Search, 
  Users, 
  UserCheck, 
  Clock, 
  UserX,
  PlusCircle,
  Check,
  RefreshCw
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
import { parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppointmentList } from '../appointment-list';
import { cn } from '@/lib/utils';

type ArchiveDashboardProps = {
  onLogout: () => void;
};

export function ArchiveDashboard({ onLogout }: ArchiveDashboardProps) {
  const [activeTab, setActiveTab] = useState('patients');

  // Patient states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [counts, setCounts] = useState<ArchiveCounts>({ total: 0, vigente: 0, bajaTemporal: 0, bajaDefinitiva: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
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
  const [appointmentFilter, setAppointmentFilter] = useState<'today' | 'week' | 'month' | 'range'>('today');

  // Common states
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSubmitting, startSubmitTransition] = useTransition();

  const { toast } = useToast();

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadPatientsData = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const [patientsData, countsData, clinicsData, appointmentsData] = await Promise.all([
        getPatients({ status: statusFilter, search: debouncedSearchTerm, limitNum: 5000 }),
        getPatientCounts(),
        getClinics(),
        getAppointments()
      ]);
      
      setPatients(patientsData || []);
      setCounts(countsData);
      setClinics(clinicsData || []);
      setAllAppointments(appointmentsData || []);
    } catch (error: any) {
      console.error("Dashboard load error:", error);
      toast({
        title: 'Error de Carga',
        description: 'No se pudieron recuperar los registros. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsDataLoading(false);
    }
  }, [statusFilter, debouncedSearchTerm, toast]);
  
  useEffect(() => {
    loadPatientsData();
  }, [loadPatientsData]);

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
        loadPatientsData();
      } else {
        toast({ title: "Error", description: result.message, variant: 'destructive'});
      }
    });
  }

  const handleAppointmentDelete = (appointmentId: string) => {
    startSubmitTransition(async () => {
        const result = await deleteAppointment(appointmentId);
        if (result.success) {
            toast({ title: 'Cita Eliminada' });
            loadPatientsData();
        }
    });
  };
  
  const handleStatusChange = (patientId: string, newStatus: PatientStatusEnum) => {
    startSubmitTransition(async () => {
      const result = await updatePatientStatus(patientId, newStatus);
       if(result.success) {
        toast({ title: "Estado Actualizado" });
        loadPatientsData();
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
        loadPatientsData();
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

  const mainHeader = (
    <Card className="border-none shadow-none bg-transparent">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Control de Archivo</h1>
          <p className="text-muted-foreground">Gestión integral del padrón de pacientes y citas.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={loadPatientsData} disabled={isDataLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isDataLoading && "animate-spin")} />
            Recargar
          </Button>
          <Button variant="outline" onClick={onLogout} className="flex-1 sm:flex-none">
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      {mainHeader}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pacientes Vigentes', count: counts.vigente, status: PatientStatusEnum.Vigente, icon: UserCheck, color: 'text-green-600' },
          { label: 'Baja Temporal', count: counts.bajaTemporal, status: PatientStatusEnum.Baja, icon: Clock, color: 'text-yellow-600' },
          { label: 'Baja Definitiva', count: counts.bajaDefinitiva, status: PatientStatusEnum.BajaDefinitiva, icon: UserX, color: 'text-red-600' },
          { label: 'Total de Pacientes', count: counts.total, status: 'Total' as const, icon: Users, color: 'text-primary' }
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => { setStatusFilter(item.status); setCurrentPage(1); }}
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
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  {isDataLoading && searchTerm !== debouncedSearchTerm ? (
                    <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  )}
                  <Input 
                    placeholder="Buscar por Nombre, CURP o No. de Expediente..." 
                    value={searchTerm} 
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                    className="pl-10 h-11"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                  <Button onClick={handleAddNew} className="h-11 flex-1 lg:flex-none">
                    <Plus className="h-4 w-4 mr-2" /> Agregar
                  </Button>
                  <Button onClick={() => setIsUploadOpen(true)} variant="secondary" className="h-11 flex-1 lg:flex-none">
                    <Upload className="h-4 w-4 mr-2" /> Cargar
                  </Button>
                  <Button onClick={handleDownloadExcel} variant="outline" className="h-11 flex-1 lg:flex-none">
                    <Download className="h-4 w-4 mr-2" /> Exportar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isDataLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground font-medium animate-pulse">Sincronizando con la base de datos...</p>
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
                      <span className="text-sm text-muted-foreground whitespace-nowrap">Mostrar</span>
                      <Select value={String(rowsPerPage)} onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="200">200</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">de {patients.length} registros</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Anterior</Button>
                      <div className="bg-muted px-3 py-1 rounded-md text-sm font-medium">Página {currentPage} de {totalPages || 1}</div>
                      <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage >= totalPages}>Siguiente</Button>
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
                  <Button variant="outline" onClick={loadPatientsData} disabled={isDataLoading}>
                    <RefreshCw className={cn("h-4 w-4", isDataLoading && "animate-spin")} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isDataLoading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <AppointmentList 
                  appointments={appointmentsToDisplay} 
                  clinics={clinics} 
                  isAdmin 
                  onDelete={handleAppointmentDelete} 
                  onEditSuccess={loadPatientsData} 
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <MassUploadDialog isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUploadSuccess={loadPatientsData} />
      {isEditOpen && <EditPatientDialog isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} patient={editingPatient} onSave={handleSavePatient} isSaving={isSubmitting} />}
      {schedulingPatient && <ScheduleAppointmentDialog patient={schedulingPatient} isOpen={!!schedulingPatient} onClose={() => setSchedulingPatient(null)} onBookingSuccess={() => { setSchedulingPatient(null); loadPatientsData(); }} clinics={clinics} colonias={[]} />}
    </div>
  );
}
