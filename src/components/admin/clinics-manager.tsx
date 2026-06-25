'use client';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
    updateClinics, getClinics, 
    updateColonias, getColonias, 
    getSpecialties, getServiceTypes
} from '@/lib/actions';
import { 
    Loader2, 
    PlusCircle, 
    Hospital, 
    Save, 
    Eye, 
    EyeOff, 
    Calendar as CalendarIcon, 
    X, 
    Pencil, 
    RefreshCw, 
    Clock
} from 'lucide-react';
import type { Clinic, Colonia, Specialty, ServiceType } from '@/lib/definitions';
import { BookingMode } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { timeSlots30Min } from '@/lib/time-slots';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';

function ClinicEditDialog({ clinic, allColonias, specialties, serviceTypes, onSave, onCancel }: { 
    clinic: Clinic, 
    allColonias: Colonia[], 
    specialties: Specialty[], 
    serviceTypes: ServiceType[],
    onSave: (clinic: Clinic, colonias: Colonia[]) => void, 
    onCancel: () => void 
}) {
    const [editedClinic, setEditedClinic] = useState<Clinic>(clinic);
    const [showPassword, setShowPassword] = useState(false);
    const [clinicColonias, setClinicColonias] = useState<Colonia[]>(() => allColonias.filter(c => c.clinicId === clinic.id));
    
    const [newScheduleDate, setNewScheduleDate] = useState<Date | undefined>();
    const [newScheduleTime, setNewScheduleTime] = useState<string>('13:00');

    useEffect(() => {
        setEditedClinic(clinic);
        setClinicColonias(allColonias.filter(c => c.clinicId === clinic.id));
    }, [clinic, allColonias]);

    const handleFieldChange = (field: keyof Omit<Clinic, 'id'>, value: any) => {
        setEditedClinic(prev => ({...prev, [field]: value}));
    }

    const handleAddCustomSchedule = () => {
        if (!newScheduleDate || !newScheduleTime) return;
        const dateStr = format(newScheduleDate, 'yyyy-MM-dd');
        const currentSchedules = editedClinic.customSchedules || [];
        const filtered = currentSchedules.filter(s => s.date !== dateStr);
        handleFieldChange('customSchedules', [...filtered, { date: dateStr, endTime: newScheduleTime }].sort((a,b) => a.date.localeCompare(b.date)));
        setNewScheduleDate(undefined);
    };

    const handleRemoveCustomSchedule = (dateStr: string) => {
        const newSchedules = editedClinic.customSchedules?.filter(s => s.date !== dateStr);
        handleFieldChange('customSchedules', newSchedules);
    };

    const handleDateSelection = (dates: Date[] | undefined) => {
        const newDateStrings = Array.from(new Set(dates?.map(d => d.toISOString().split('T')[0]) || []));
        handleFieldChange('unavailableDates', newDateStrings);
    };

    return (
        <DialogContent className="sm:max-w-[70%]">
            <DialogHeader>
                <DialogTitle>Editar Configuración: {clinic.name || "Nueva Unidad"}</DialogTitle>
                <DialogDescription>Modifica los horarios y capacidad de atención.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[75vh] overflow-y-auto p-4 space-y-8">
                 <div className='grid sm:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                        <Label>Nombre de la Unidad / Consultorio</Label>
                        <Input value={editedClinic.name} onChange={(e) => handleFieldChange('name', e.target.value.toUpperCase())} placeholder="Ej. CONSULTORIO 1" />
                    </div>
                    <div className='space-y-2'>
                        <Label>Médico Responsable</Label>
                        <Input value={editedClinic.doctorName} onChange={(e) => handleFieldChange('doctorName', e.target.value.toUpperCase())} placeholder="Ej. DR. JUAN PEREZ" />
                    </div>
                </div>

                <div className='grid sm:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                        <Label>Tipo de Consulta (Categoría General)</Label>
                        <Select value={editedClinic.serviceTypeId} onValueChange={(v) => handleFieldChange('serviceTypeId', v)}>
                            <SelectTrigger><SelectValue placeholder="Selecciona el tipo..." /></SelectTrigger>
                            <SelectContent>
                                {serviceTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className='space-y-2'>
                        <Label>Especialidad Médica (Solo si aplica)</Label>
                        <Select value={editedClinic.specialtyId || 'none'} onValueChange={(v) => handleFieldChange('specialtyId', v === 'none' ? undefined : v)}>
                            <SelectTrigger><SelectValue placeholder="Selecciona la especialidad..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sin Especialidad / General</SelectItem>
                                {specialties.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                    <div className='space-y-2'>
                        <Label>Modo de Agendar</Label>
                        <Select value={editedClinic.bookingMode} onValueChange={(v: BookingMode) => handleFieldChange('bookingMode', v)}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={BookingMode.Time}>Por Horario</SelectItem>
                                <SelectItem value={BookingMode.Token}>Por Ficha</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className='space-y-2'>
                        <Label>Citas por día</Label>
                        <Input type="number" value={editedClinic.dailySlots} onChange={(e) => handleFieldChange('dailySlots', parseInt(e.target.value,10) || 0)} />
                    </div>
                    <div className='space-y-2'>
                        <Label>Duración (min)</Label>
                        <Input type="number" value={editedClinic.consultationDuration || ''} onChange={(e) => handleFieldChange('consultationDuration', parseInt(e.target.value,10) || 0)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Contraseña de Reportes</Label>
                        <div className="relative">
                            <Input type={showPassword ? 'text' : 'password'} value={editedClinic.password} onChange={(e) => handleFieldChange('password', e.target.value)} />
                            <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-8 bg-muted/20 p-6 rounded-xl border border-dashed border-primary/20">
                    <div className='space-y-4'>
                        <Label className="text-base font-bold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Salidas Tempranas</Label>
                        <div className="grid grid-cols-3 gap-2 items-end">
                            <Popover>
                                <PopoverTrigger asChild><Button variant="outline" className="w-full h-9 text-xs">{newScheduleDate ? format(newScheduleDate, 'dd/MM') : 'Fecha'}</Button></PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newScheduleDate} onSelect={setNewScheduleDate} locale={es} disabled={{ before: new Date() }} /></PopoverContent>
                            </Popover>
                            <Select value={newScheduleTime} onValueChange={setNewScheduleTime}><SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{timeSlots30Min.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
                            <Button size="sm" onClick={handleAddCustomSchedule} className="h-9" disabled={!newScheduleDate}><PlusCircle className="h-4 w-4" /></Button>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1 mt-4">
                            {editedClinic.customSchedules?.map(s => (
                                <div key={s.date} className="flex items-center justify-between p-2 bg-background border rounded text-xs">
                                    <span className="font-bold">{format(new Date(s.date + 'T12:00:00'), 'dd/MM/yy')}</span>
                                    <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-black">Cierre: {s.endTime}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveCustomSchedule(s.date)}><X className="h-3 w-3" /></Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className='space-y-4'>
                        <Label className="text-base font-bold flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-primary" /> Días Inhábiles</Label>
                        <Popover>
                            <PopoverTrigger asChild><Button variant="outline" className='w-full h-11'>{editedClinic.unavailableDates?.length || 0} días seleccionados</Button></PopoverTrigger>
                            <PopoverContent className='w-auto p-0' align="end"><Calendar mode="multiple" selected={editedClinic.unavailableDates?.map(d => new Date(d + 'T12:00:00'))} onSelect={handleDateSelection} locale={es} disabled={{ before: new Date() }} /></PopoverContent>
                        </Popover>
                    </div>
                </div>
            </div>
            <DialogFooter className="p-6 border-t bg-muted/5">
                <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button onClick={() => onSave(editedClinic, clinicColonias)} className="font-bold">Guardar Todo</Button>
            </DialogFooter>
        </DialogContent>
    );
}

export function ClinicsManager() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [colonias, setColonias] = useState<Colonia[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [clinicsData, coloniasData, specialtiesData, servicesData] = await Promise.all([
          getClinics(), getColonias(), getSpecialties(), getServiceTypes()
      ]);
      setClinics(clinicsData);
      setColonias(coloniasData);
      setSpecialties(specialtiesData);
      setServiceTypes(servicesData);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEditClick = (clinic: Clinic) => { setSelectedClinic(clinic); setIsDialogOpen(true); }
  const handleAddNewClick = () => {
      if (serviceTypes.length === 0) {
          toast({ title: "Atención", description: "Configura los Tipos de Consulta primero.", variant: "destructive" });
          return;
      }
      const newClinic: Clinic = { 
        id: uuidv4(), name: '', doctorName: '', professionalLicense: '', password: '123', dailySlots: 15, waitlistSlots: 0, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, daysOfAction: [], unavailableDates: [], customSchedules: [], serviceTypeId: serviceTypes[0].id, bookingMode: BookingMode.Time, consultationDuration: 30,
    };
    setSelectedClinic(newClinic);
    setIsDialogOpen(true);
  }
  
  const handleDialogSave = (updatedClinic: Clinic, updatedClinicColonias: Colonia[]) => {
    const clinicExists = clinics.some(c => c.id === updatedClinic.id);
    if (clinicExists) { setClinics(clinics.map(c => c.id === updatedClinic.id ? updatedClinic : c)); }
    else { setClinics(prev => [...prev, updatedClinic].sort((a, b) => a.name.localeCompare(b.name))); }
    setIsDialogOpen(false);
    setSelectedClinic(null);
  }

  const handleSave = () => {
    startSavingTransition(async () => {
      await updateClinics(clinics);
      toast({ title: 'Configuración Guardada' });
      await fetchData();
    });
  };

  if (isLoading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="w-full">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
              <div>
                  <CardTitle className="flex items-center gap-2"><Hospital /> Estructura de Atención</CardTitle>
                  <CardDescription>Configura los consultorios y sus categorías.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
                <Button onClick={handleAddNewClick}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Consultorio</Button>
              </div>
          </CardHeader>
          <CardContent>
              <Input placeholder="Buscar consultorio o médico..." className="h-10 w-full sm:w-72 mb-4" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Consultorio</TableHead>
                          <TableHead>Responsable</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {clinics.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.doctorName.toLowerCase().includes(searchTerm.toLowerCase())).map(clinic => {
                          const sType = serviceTypes.find(t => t.id === clinic.serviceTypeId) || 
                                       serviceTypes.find(t => t.name.toUpperCase() === String(clinic.serviceTypeId || '').toUpperCase());
                          
                          return (
                            <TableRow key={clinic.id}>
                                <TableCell className="font-bold text-xs">{clinic.name}</TableCell>
                                <TableCell className="text-xs uppercase">{clinic.doctorName}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-[9px] font-black uppercase">{sType?.name || 'N/A'}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(clinic)}><Pencil className="h-4 w-4" /></Button>
                                </TableCell>
                            </TableRow>
                          );
                      })}
                  </TableBody>
              </Table>
          </CardContent>
          <CardFooter><Button onClick={handleSave} disabled={isSaving} className="w-full h-12">Guardar Estructura</Button></CardFooter>
          </Card>
          {selectedClinic && <ClinicEditDialog clinic={selectedClinic} allColonias={colonias} specialties={specialties} serviceTypes={serviceTypes} onSave={handleDialogSave} onCancel={() => setIsDialogOpen(false)} />}
      </Dialog>
    </div>
  );
}
