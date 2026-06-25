
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
    getColonias, 
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
    Clock,
    CheckCircle2,
    CalendarDays,
    Search
} from 'lucide-react';
import type { Clinic, Colonia, Specialty, ServiceType } from '@/lib/definitions';
import { BookingMode } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar } from '../ui/calendar';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { timeSlots30Min } from '@/lib/time-slots';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
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
import { Checkbox } from '../ui/checkbox';

const DAYS_OF_WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

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

    const toggleDay = (day: string) => {
        const current = editedClinic.daysOfAction || [];
        const updated = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
        handleFieldChange('daysOfAction', updated);
    };

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
        const newDateStrings = Array.from(new Set(dates?.map(d => format(d, 'yyyy-MM-dd')) || []));
        handleFieldChange('unavailableDates', newDateStrings);
    };

    const handleRemoveUnavailableDate = (dateStr: string) => {
        const newDates = editedClinic.unavailableDates?.filter(d => d !== dateStr) || [];
        handleFieldChange('unavailableDates', newDates);
    };

    const formatBadgeDate = (d: string) => {
        try {
            if (!d) return "---";
            const dateObj = new Date(d + 'T12:00:00');
            if (!isValid(dateObj)) return d;
            return format(dateObj, 'dd/MM/yy', { locale: es });
        } catch (e) {
            return d;
        }
    };

    const dynamicBreakSlots = useMemo(() => {
        if (!editedClinic.startTime || !editedClinic.endTime) return [];
        const slots: string[] = [];
        try {
            const startParts = editedClinic.startTime.split(':').map(Number);
            const endParts = editedClinic.endTime.split(':').map(Number);
            let current = new Date(1970, 0, 1, startParts[0], startParts[1]);
            const end = new Date(1970, 0, 1, endParts[0], endParts[1]);
            while (current < end) {
                slots.push(current.toTimeString().substring(0, 5));
                current = new Date(current.getTime() + (editedClinic.consultationDuration || 30) * 60000);
            }
        } catch (e) {}
        return slots;
    }, [editedClinic.startTime, editedClinic.endTime, editedClinic.consultationDuration]);

    return (
        <DialogContent className="sm:max-w-[90vw] h-[95vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2 shrink-0 border-b">
                <div className="flex items-center justify-between">
                    <div>
                        <DialogTitle className="text-2xl font-black uppercase">Configuración de Unidad</DialogTitle>
                        <DialogDescription className="font-bold text-primary">{editedClinic.name || "Nueva Unidad Médica"}</DialogDescription>
                    </div>
                </div>
            </DialogHeader>
            <ScrollArea className="flex-1">
                 <div className="p-8 space-y-10 pb-20">
                    <div className='grid sm:grid-cols-2 gap-8'>
                        <div className='space-y-2'>
                            <Label className="font-black text-xs uppercase opacity-60">Nombre de la Unidad / Consultorio</Label>
                            <Input value={editedClinic.name} onChange={(e) => handleFieldChange('name', e.target.value.toUpperCase())} placeholder="Ej. CONSULTORIO 1" className="h-12 text-lg font-bold" />
                        </div>
                        <div className='space-y-2'>
                            <Label className="font-black text-xs uppercase opacity-60">Médico Responsable</Label>
                            <Input value={editedClinic.doctorName} onChange={(e) => handleFieldChange('doctorName', e.target.value.toUpperCase())} placeholder="Ej. DR. JUAN PEREZ" className="h-12 text-lg font-bold" />
                        </div>
                    </div>

                    <div className='grid sm:grid-cols-2 gap-8'>
                        <div className='space-y-2'>
                            <Label className="font-black text-xs uppercase opacity-60">Categoría de Atención</Label>
                            <Select value={editedClinic.serviceTypeId} onValueChange={(v) => handleFieldChange('serviceTypeId', v)}>
                                <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Selecciona el tipo..." /></SelectTrigger>
                                <SelectContent>
                                    {serviceTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='space-y-2'>
                            <Label className="font-black text-xs uppercase opacity-60">Especialidad (Opcional)</Label>
                            <Select value={editedClinic.specialtyId || 'none'} onValueChange={(v) => handleFieldChange('specialtyId', v === 'none' ? undefined : v)}>
                                <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="General / Familiar" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Medicina General / Familiar</SelectItem>
                                    {specialties.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-sm font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" /> Días de Acción (Laborales)
                        </Label>
                        <div className="flex flex-wrap gap-3 p-6 bg-muted/20 border-2 border-dashed rounded-3xl">
                            {DAYS_OF_WEEK.map(day => (
                                <div key={day} className="flex items-center space-x-3 bg-background p-3 px-4 rounded-xl border-2 shadow-sm transition-all hover:border-primary/40">
                                    <Checkbox id={`day-${day}`} checked={editedClinic.daysOfAction?.includes(day)} onCheckedChange={() => toggleDay(day)} />
                                    <Label htmlFor={`day-${day}`} className="text-xs font-black cursor-pointer uppercase">{day}</Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 bg-primary/5 p-6 rounded-3xl border border-primary/10'>
                        <div className='space-y-2'>
                            <Label className="text-[10px] font-black uppercase text-primary">Modo</Label>
                            <Select value={editedClinic.bookingMode} onValueChange={(v: BookingMode) => handleFieldChange('bookingMode', v)}>
                                <SelectTrigger className="h-11 font-bold border-primary/20"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={BookingMode.Time}>Por Horario</SelectItem>
                                    <SelectItem value={BookingMode.Token}>Por Ficha</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='space-y-2'>
                            <Label className="text-[10px] font-black uppercase text-primary">Cupo Diario</Label>
                            <Input type="number" value={editedClinic.dailySlots} onChange={(e) => handleFieldChange('dailySlots', parseInt(e.target.value,10) || 0)} className="h-11 font-black text-center border-primary/20" />
                        </div>
                        <div className='space-y-2'>
                            <Label className="text-[10px] font-black uppercase text-primary">Duración (m)</Label>
                            <Input type="number" value={editedClinic.consultationDuration || ''} onChange={(e) => handleFieldChange('consultationDuration', parseInt(e.target.value,10) || 0)} className="h-11 font-black text-center border-primary/20" />
                        </div>
                        <div className='space-y-2'>
                            <Label className="text-[10px] font-black uppercase text-primary">Entrada</Label>
                            <Select value={editedClinic.startTime} onValueChange={(v) => handleFieldChange('startTime', v)}>
                                <SelectTrigger className="h-11 font-bold border-primary/20"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {timeSlots30Min.map(t => <SelectItem key={t.value} value={t.value}>{t.label} hrs</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='space-y-2'>
                            <Label className="text-[10px] font-black uppercase text-primary">Salida</Label>
                            <Select value={editedClinic.endTime} onValueChange={(v) => handleFieldChange('endTime', v)}>
                                <SelectTrigger className="h-11 font-bold border-primary/20"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {timeSlots30Min.map(t => <SelectItem key={t.value} value={t.value}>{t.label} hrs</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='space-y-2'>
                            <Label className="text-[10px] font-black uppercase text-accent-foreground">Hora Descanso</Label>
                            <Select value={editedClinic.breakTime || ''} onValueChange={(v) => handleFieldChange('breakTime', v === 'none' ? '' : v)}>
                                <SelectTrigger className="h-11 border-accent/40 bg-accent/10 font-bold"><SelectValue placeholder="SIN DESCANSO" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin Descanso</SelectItem>
                                    {dynamicBreakSlots.map(t => <SelectItem key={t} value={t}>{t} hrs</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-primary">Clave Reporte</Label>
                            <div className="relative">
                                <Input type={showPassword ? 'text' : 'password'} value={editedClinic.password} onChange={(e) => handleFieldChange('password', e.target.value)} className="h-11 border-primary/20" />
                                <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-10">
                        <div className='space-y-6'>
                            <div className="flex items-center justify-between border-b-2 border-primary/10 pb-2">
                                <h4 className="text-sm font-black uppercase text-primary tracking-wider flex items-center gap-2">
                                    <Clock className="h-5 w-5" /> Salidas Tempranas (Cierres por Fecha)
                                </h4>
                                <Badge className="bg-primary text-white h-5">{editedClinic.customSchedules?.length || 0}</Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase opacity-50">Día del Cierre</Label>
                                    <Popover>
                                        <PopoverTrigger asChild><Button variant="outline" className="w-full h-11 text-xs font-bold">{newScheduleDate ? format(newScheduleDate, 'dd/MM/yyyy') : 'Elegir Fecha'}</Button></PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newScheduleDate} onSelect={setNewScheduleDate} locale={es} disabled={{ before: new Date() }} /></PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold uppercase opacity-50">Hora de Fin</Label>
                                    <Select value={newScheduleTime} onValueChange={setNewScheduleTime}>
                                        <SelectTrigger className="h-11 font-black"><SelectValue /></SelectTrigger>
                                        <SelectContent>{timeSlots30Min.map(t => <SelectItem key={t.value} value={t.value}>{t.label} hrs</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleAddCustomSchedule} className="h-11 font-bold" disabled={!newScheduleDate}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> AGREGAR CIERRE
                                </Button>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                                {editedClinic.customSchedules?.length ? editedClinic.customSchedules.map(s => (
                                    <div key={s.date} className="flex items-center justify-between p-4 bg-background border-2 rounded-2xl shadow-sm hover:border-primary/20 transition-all">
                                        <div className="flex items-center gap-3">
                                            <CalendarIcon className="h-4 w-4 text-primary" />
                                            <span className="font-black text-sm uppercase">{formatBadgeDate(s.date)}</span>
                                        </div>
                                        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200 font-black h-7 px-4">CIERRE: {s.endTime} HRS</Badge>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveCustomSchedule(s.date)}><X className="h-5 w-5" /></Button>
                                    </div>
                                )) : <div className="text-center py-10 border-2 border-dashed rounded-3xl opacity-30 italic text-xs">No hay cierres anticipados programados.</div>}
                            </div>
                        </div>

                        <div className='space-y-6'>
                            <div className="flex items-center justify-between border-b-2 border-primary/10 pb-2">
                                <h4 className="text-sm font-black uppercase text-primary tracking-wider flex items-center gap-2">
                                    <CalendarDays className="h-5 w-5" /> Vacaciones y Bloqueos de Día Completo
                                </h4>
                                <Badge className="bg-destructive text-white h-5">{editedClinic.unavailableDates?.length || 0}</Badge>
                            </div>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className='w-full h-12 font-black bg-destructive/5 border-destructive/20 text-destructive hover:bg-destructive/10'>
                                        <CalendarIcon className="mr-2 h-5 w-5" /> SELECCIONAR DÍAS DE VACACIONES
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className='w-auto p-0' align="end">
                                    <Calendar 
                                        mode="multiple" 
                                        selected={editedClinic.unavailableDates?.map(d => new Date(d + 'T12:00:00')).filter(d => isValid(d))} 
                                        onSelect={handleDateSelection} 
                                        locale={es} 
                                        disabled={{ before: new Date() }} 
                                    />
                                </PopoverContent>
                            </Popover>
                            <ScrollArea className="h-[300px] border-2 border-dashed rounded-3xl bg-muted/5 p-4 shadow-inner">
                                <div className="grid grid-cols-1 gap-2">
                                    {editedClinic.unavailableDates?.length ? editedClinic.unavailableDates.filter(d => !!d).sort().map(d => (
                                        <div key={d} className="flex items-center justify-between p-3 bg-background border rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                                            <div className="flex items-center gap-3">
                                                <Badge className="bg-destructive/10 text-destructive border-destructive/20 font-black">BLOQUEADO</Badge>
                                                <span className="text-sm font-bold uppercase">{formatBadgeDate(d)}</span>
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveUnavailableDate(d)}
                                                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-destructive/10 text-destructive transition-colors"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )) : (
                                        <div className="text-center py-20 opacity-30 flex flex-col items-center gap-3">
                                            <CalendarDays className="h-10 w-10" />
                                            <p className="text-xs font-bold uppercase">No hay días bloqueados registrados</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter className="p-6 border-t bg-muted/10 shrink-0">
                <DialogClose asChild><Button variant="outline" className="h-12 px-8">Cancelar</Button></DialogClose>
                <Button onClick={() => onSave(editedClinic, clinicColonias)} className="h-12 px-10 font-black bg-primary hover:bg-primary/90 shadow-xl transition-all">
                    GUARDAR CONFIGURACIÓN DE UNIDAD
                </Button>
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
        id: uuidv4(), name: '', doctorName: '', professionalLicense: '', password: '123', dailySlots: 15, waitlistSlots: 0, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, daysOfAction: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"], unavailableDates: [], customSchedules: [], serviceTypeId: serviceTypes[0].id, bookingMode: BookingMode.Time, consultationDuration: 30,
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
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4 border-b pb-6">
              <div>
                  <CardTitle className="text-2xl font-black uppercase flex items-center gap-2"><Hospital className="h-7 w-7 text-primary" /> Estructura de Atención</CardTitle>
                  <CardDescription>Configura los consultorios, sus categorías y días laborales.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchData} className="h-11"><RefreshCw className="h-4 w-4" /></Button>
                <Button onClick={handleAddNewClick} className="h-11 font-bold"><PlusCircle className="mr-2 h-4 w-4" /> Agregar Unidad</Button>
              </div>
          </CardHeader>
          <CardContent className="pt-6">
              <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar consultorio o médico..." className="h-11 w-full sm:w-96 pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="border rounded-2xl overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="font-black uppercase text-[10px]">Unidad / Núcleo</TableHead>
                            <TableHead className="font-black uppercase text-[10px]">Responsable</TableHead>
                            <TableHead className="font-black uppercase text-[10px]">Categoría</TableHead>
                            <TableHead className="font-black uppercase text-[10px] text-center">Horario</TableHead>
                            <TableHead className="text-right pr-6 font-black uppercase text-[10px]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {clinics.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.doctorName.toLowerCase().includes(searchTerm.toLowerCase())).map(clinic => {
                            const sType = serviceTypes.find(t => t.id === clinic.serviceTypeId) || 
                                        serviceTypes.find(t => t.name.toUpperCase() === String(clinic.serviceTypeId || '').toUpperCase());
                            
                            return (
                                <TableRow key={clinic.id} className="hover:bg-muted/30">
                                    <TableCell className="font-black text-sm text-primary uppercase">{clinic.name}</TableCell>
                                    <TableCell className="text-xs uppercase font-medium">{clinic.doctorName}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter bg-background">{sType?.name || 'N/A'}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-[10px] font-bold">
                                        {clinic.startTime} - {clinic.endTime}
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <Button variant="outline" size="sm" onClick={() => handleEditClick(clinic)} className="h-8 font-bold border-primary/20">
                                            <Pencil className="h-3 w-3 mr-2 text-blue-600" /> Configurar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
              </div>
          </CardContent>
          <CardFooter className="bg-muted/5 border-t pt-6"><Button onClick={handleSave} disabled={isSaving} className="w-full h-12 text-lg font-black uppercase shadow-lg">SINCRONIZAR TODA LA ESTRUCTURA</Button></CardFooter>
          </Card>
          {selectedClinic && <ClinicEditDialog clinic={selectedClinic} allColonias={colonias} specialties={specialties} serviceTypes={serviceTypes} onSave={handleDialogSave} onCancel={() => setIsDialogOpen(false)} />}
      </Dialog>
    </div>
  );
}
