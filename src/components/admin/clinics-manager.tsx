'use client';
import { useState, useEffect, useTransition, useMemo, useCallback } from 'react';
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
    getSpecialties, getServiceTypes,
    deleteClinic
} from '@/lib/actions';
import { 
    Loader2, 
    PlusCircle, 
    Hospital, 
    Save, 
    Calendar as CalendarIcon, 
    X, 
    Pencil, 
    RefreshCw, 
    Clock,
    CalendarDays,
    Search,
    Fingerprint,
    ShieldCheck,
    Timer,
    CalendarPlus
} from 'lucide-react';
import type { Clinic, Specialty, ServiceType, CustomSchedule } from '@/lib/definitions';
import { BookingMode } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar } from '../ui/calendar';
import { format, isValid } from 'date-fns';
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
import { Separator } from '../ui/separator';

const DAYS_OF_WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function ClinicEditDialog({ clinic, specialties, serviceTypes, onSave, onCancel }: { 
    clinic: Clinic, 
    specialties: Specialty[], 
    serviceTypes: ServiceType[],
    onSave: (clinic: Clinic) => void, 
    onCancel: () => void 
}) {
    const [editedClinic, setEditedClinic] = useState<Clinic>(clinic);
    const [newScheduleDate, setNewScheduleDate] = useState<Date | undefined>();
    const [newScheduleEndTime, setNewScheduleEndTime] = useState<string>("13:00");

    useEffect(() => {
        // Normalización de datos para evitar errores de renderizado
        const rawDates = clinic.unavailableDates || [];
        const normalizedDates = Array.from(new Set(rawDates.map(d => {
            if (typeof d === 'string') return d;
            if (d && typeof d === 'object' && 'seconds' in d) return new Date((d as any).seconds * 1000).toISOString().split('T')[0];
            return String(d);
        }).filter(d => !!d && d !== "[object Object]")));

        setEditedClinic({ 
            ...clinic, 
            unavailableDates: normalizedDates, 
            daysOfAction: clinic.daysOfAction || [],
            customSchedules: clinic.customSchedules || [],
            waitlistSlots: clinic.waitlistSlots || 0
        });
    }, [clinic]);

    const handleFieldChange = (field: keyof Omit<Clinic, 'id'>, value: any) => {
        setEditedClinic(prev => ({...prev, [field]: value}));
    }

    const toggleDay = (day: string) => {
        const current = editedClinic.daysOfAction || [];
        const updated = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
        handleFieldChange('daysOfAction', updated);
    };

    const handleDateSelection = (dates: Date[] | undefined) => {
        const newDateStrings = Array.from(new Set(dates?.map(d => format(d, 'yyyy-MM-dd')) || []));
        handleFieldChange('unavailableDates', newDateStrings);
    };

    const addCustomSchedule = () => {
        if (!newScheduleDate) return;
        const dateStr = format(newScheduleDate, 'yyyy-MM-dd');
        const existing = editedClinic.customSchedules || [];
        if (existing.some(s => s.date === dateStr)) return;
        
        handleFieldChange('customSchedules', [...existing, { date: dateStr, endTime: newScheduleEndTime, reason: 'Salida Temprana' }]);
        setNewScheduleDate(undefined);
    };

    const removeCustomSchedule = (dateStr: string) => {
        handleFieldChange('customSchedules', editedClinic.customSchedules?.filter(s => s.date !== dateStr) || []);
    };

    const formatBadgeDate = (d: any) => {
        try {
            const dateStr = typeof d === 'string' ? d : (d.seconds ? new Date(d.seconds * 1000).toISOString().split('T')[0] : String(d));
            const dateObj = new Date(dateStr + 'T12:00:00');
            return isValid(dateObj) ? format(dateObj, 'dd/MM/yy', { locale: es }) : dateStr;
        } catch (e) { return String(d); }
    };

    const dynamicBreakSlots = useMemo(() => {
        if (!editedClinic.startTime || !editedClinic.endTime) return [];
        const slots: Set<string> = new Set();
        try {
            const startParts = editedClinic.startTime.split(':').map(Number);
            const endParts = editedClinic.endTime.split(':').map(Number);
            let current = new Date(1970, 0, 1, startParts[0], startParts[1]);
            const end = new Date(1970, 0, 1, endParts[0], endParts[1]);
            while (current < end) {
                slots.add(current.toTimeString().substring(0, 5));
                current = new Date(current.getTime() + (editedClinic.consultationDuration || 30) * 60000);
            }
            if (editedClinic.breakTime) slots.add(editedClinic.breakTime);
        } catch (e) {}
        return Array.from(slots).sort();
    }, [editedClinic.startTime, editedClinic.endTime, editedClinic.consultationDuration, editedClinic.breakTime]);

    return (
        <DialogContent className="sm:max-w-[90vw] h-[95vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 shrink-0 border-b">
                <DialogTitle className="text-2xl font-black uppercase">Configuración Avanzada de Unidad</DialogTitle>
                <DialogDescription className="font-bold text-primary">{editedClinic.name || "Nueva Unidad"}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1">
                 <div className="p-8 space-y-12">
                    {/* SECCIÓN 1: IDENTIFICACIÓN */}
                    <div className="space-y-6">
                        <h4 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2"><Fingerprint className="h-5 w-5" /> 1. Datos del Responsable</h4>
                        <div className='grid sm:grid-cols-3 gap-8'>
                            <div className='space-y-2'><Label className="font-black text-[10px] uppercase opacity-60 tracking-tighter">Nombre de la Unidad</Label><Input value={editedClinic.name} onChange={(e) => handleFieldChange('name', e.target.value.toUpperCase())} className="h-12 font-bold" /></div>
                            <div className='space-y-2'><Label className="font-black text-[10px] uppercase opacity-60 tracking-tighter">Médico Responsable</Label><Input value={editedClinic.doctorName} onChange={(e) => handleFieldChange('doctorName', e.target.value.toUpperCase())} className="h-12 font-bold" /></div>
                            <div className='space-y-2'><Label className="font-black text-[10px] uppercase opacity-60 tracking-tighter">CURP del Médico</Label><Input value={editedClinic.doctorCurp || ''} onChange={(e) => handleFieldChange('doctorCurp', e.target.value.toUpperCase())} className="h-12 font-mono" maxLength={18} /></div>
                        </div>
                        <div className='grid sm:grid-cols-3 gap-8'>
                            <div className='space-y-2'><Label className="font-black text-[10px] uppercase opacity-60 tracking-tighter">Categoría de Atención</Label><Select value={editedClinic.serviceTypeId} onValueChange={(v) => handleFieldChange('serviceTypeId', v)}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent>{serviceTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                            <div className='space-y-2'><Label className="font-black text-[10px] uppercase opacity-60 tracking-tighter">Especialidad</Label><Select value={editedClinic.specialtyId || 'none'} onValueChange={(v) => handleFieldChange('specialtyId', v === 'none' ? undefined : v)}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">General / No Especializado</SelectItem>{specialties.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                            <div className='space-y-2'><Label className="font-black text-[10px] uppercase opacity-60 tracking-tighter">Cédula Profesional</Label><Input value={editedClinic.professionalLicense || ''} onChange={(e) => handleFieldChange('professionalLicense', e.target.value.toUpperCase())} className="h-12" /></div>
                        </div>
                    </div>

                    <Separator />

                    {/* SECCIÓN 2: AGENDA Y TURNOS */}
                    <div className="space-y-6">
                        <h4 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2"><Timer className="h-5 w-5" /> 2. Control de Agenda y Turnos</h4>
                        <div className='grid grid-cols-2 md:grid-cols-6 gap-6 bg-primary/5 p-6 rounded-3xl border border-primary/10'>
                            <div className='space-y-2'><Label className="text-[10px] font-black uppercase text-primary">Cupo Normal</Label><Input type="number" value={editedClinic.dailySlots} onChange={(e) => handleFieldChange('dailySlots', parseInt(e.target.value,10) || 0)} className="h-11 font-black text-center" /></div>
                            <div className='space-y-2'><Label className="text-[10px] font-black uppercase text-primary">Lista de Espera</Label><Input type="number" value={editedClinic.waitlistSlots || 0} onChange={(e) => handleFieldChange('waitlistSlots', parseInt(e.target.value,10) || 0)} className="h-11 font-black text-center bg-blue-50 border-blue-200" /></div>
                            <div className='space-y-2'><Label className="text-[10px] font-black uppercase text-primary">Duración (min)</Label><Input type="number" value={editedClinic.consultationDuration || ''} onChange={(e) => handleFieldChange('consultationDuration', parseInt(e.target.value,10) || 0)} className="h-11 font-black text-center" /></div>
                            <div className='space-y-2'><Label className="text-[10px] font-black uppercase text-primary">Entrada</Label><Select value={editedClinic.startTime} onValueChange={(v) => handleFieldChange('startTime', v)}><SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger><SelectContent>{timeSlots30Min.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                            <div className='space-y-2'><Label className="text-[10px] font-black uppercase text-primary">Salida</Label><Select value={editedClinic.endTime} onValueChange={(v) => handleFieldChange('endTime', v)}><SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger><SelectContent>{timeSlots30Min.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                            <div className='space-y-2'><Label className="text-[10px] font-black uppercase text-primary">Hora Comida</Label><Select value={editedClinic.breakTime || ''} onValueChange={(v) => handleFieldChange('breakTime', v === 'none' ? '' : v)}><SelectTrigger className="h-11 font-bold bg-orange-50 border-orange-200"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No</SelectItem>{dynamicBreakSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                    </div>

                    <Separator />

                    {/* SECCIÓN 3: DÍAS LABORALES */}
                    <div className="grid lg:grid-cols-2 gap-10">
                        <div className="space-y-4">
                            <Label className="text-sm font-black text-primary uppercase flex items-center gap-2"><CalendarDays className="h-5 w-5" /> 3. Días de Acción (Laborales)</Label>
                            <div className="flex flex-wrap gap-3 p-6 bg-muted/20 border-2 border-dashed rounded-3xl">
                                {DAYS_OF_WEEK.map(day => (<div key={day} className="flex items-center space-x-3 bg-background p-3 px-4 rounded-xl border-2 shadow-sm"><Checkbox id={`day-${day}`} checked={editedClinic.daysOfAction?.includes(day)} onCheckedChange={() => toggleDay(day)} /><Label htmlFor={`day-${day}`} className="text-xs font-black uppercase cursor-pointer">{day}</Label></div>))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Label className="text-sm font-black text-primary uppercase flex items-center gap-2"><Clock className="h-5 w-5" /> Disponibilidad Adicional</Label>
                            <div className="p-6 bg-muted/20 border-2 border-dashed rounded-3xl space-y-6">
                                <div className="flex items-center justify-between p-4 bg-background rounded-2xl border-2 shadow-sm"><Label className="text-sm font-black uppercase">¿Labora Fines de Semana?</Label><Switch checked={editedClinic.weekendBookingEnabled} onCheckedChange={(v) => handleFieldChange('weekendBookingEnabled', v)} /></div>
                                <div className="flex items-center justify-between p-4 bg-background rounded-2xl border-2 shadow-sm"><Label className="text-sm font-black uppercase">Modo de Reserva</Label><Select value={editedClinic.bookingMode} onValueChange={(v: BookingMode) => handleFieldChange('bookingMode', v)}><SelectTrigger className="w-40 h-10 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={BookingMode.Time}>Por Horario</SelectItem><SelectItem value={BookingMode.Token}>Por Ficha</SelectItem></SelectContent></Select></div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* SECCIÓN 4: HORARIOS ESPECIALES / CIERRES ANTICIPADOS */}
                    <div className="space-y-6">
                        <h4 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2"><Timer className="h-5 w-5" /> 4. Horarios Especiales (Salidas Tempranas)</h4>
                        <div className="grid sm:grid-cols-3 gap-6 items-end bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                             <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">Fecha del Evento</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full h-11 justify-start font-bold">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {newScheduleDate ? format(newScheduleDate, 'dd/MM/yyyy') : "Elegir Fecha..."}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newScheduleDate} onSelect={setNewScheduleDate} locale={es} disabled={{ before: new Date() }} /></PopoverContent>
                                </Popover>
                             </div>
                             <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">Hora de Fin (Cierre)</Label>
                                <Select value={newScheduleEndTime} onValueChange={setNewScheduleEndTime}>
                                    <SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent>{timeSlots30Min.map(t => <SelectItem key={`sched-${t.value}`} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                                </Select>
                             </div>
                             <Button onClick={addCustomSchedule} disabled={!newScheduleDate} className="h-11 font-black bg-blue-600 hover:bg-blue-700">PROGRAMAR CIERRE</Button>
                        </div>
                        
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {editedClinic.customSchedules?.length ? editedClinic.customSchedules.map(sched => (
                                <div key={sched.date} className="flex items-center justify-between p-4 bg-background border-2 border-blue-100 rounded-2xl shadow-sm animate-in zoom-in-95">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-blue-600">Salida Temprana</p>
                                        <p className="font-bold text-sm">{formatBadgeDate(sched.date)}</p>
                                        <p className="text-xs font-black text-muted-foreground uppercase flex items-center gap-1"><Clock className="h-3 w-3" /> Cierre: {sched.endTime}</p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => removeCustomSchedule(sched.date)}><X className="h-4 w-4 text-destructive" /></Button>
                                </div>
                            )) : <div className="col-span-full py-8 text-center border-2 border-dashed rounded-3xl opacity-30 font-black text-[10px] uppercase">No hay cierres anticipados programados</div>}
                        </div>
                    </div>

                    <Separator />

                    {/* SECCIÓN 5: BLOQUEOS Y VACACIONES */}
                    <div className='space-y-6'>
                        <h4 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2"><CalendarDays className="h-5 w-5" /> 5. Vacaciones y Bloqueos Totales</h4>
                        <div className="flex gap-4 items-center">
                            <Popover><PopoverTrigger asChild><Button variant="outline" className='flex-1 h-12 font-black bg-destructive/5 text-destructive border-destructive/20'><CalendarPlus className="mr-2 h-5 w-5" /> SELECCIONAR DÍAS DE BLOQUEO EN CALENDARIO</Button></PopoverTrigger><PopoverContent className='w-auto p-0'><Calendar mode="multiple" selected={editedClinic.unavailableDates?.map(d => new Date(d + 'T12:00:00')).filter(isValid)} onSelect={handleDateSelection} locale={es} disabled={{ before: new Date() }} /></PopoverContent></Popover>
                        </div>
                        <ScrollArea className="h-[250px] border-2 border-dashed rounded-3xl bg-muted/5 p-6">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {editedClinic.unavailableDates?.length ? editedClinic.unavailableDates.map(d => (
                                    <div key={String(d)} className="flex items-center justify-between p-3 bg-background border rounded-xl shadow-sm hover:border-destructive/40 transition-colors">
                                        <span className="text-xs font-bold uppercase">{formatBadgeDate(d)}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveUnavailableDate(String(d))}><X className="h-3 w-3 text-destructive" /></Button>
                                    </div>
                                )) : <div className="col-span-full text-center py-20 opacity-30 uppercase font-black text-xs">Sin días bloqueados por vacaciones</div>}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter className="p-6 border-t bg-muted/10 shrink-0"><Button onClick={() => onSave(editedClinic)} className="h-14 px-12 text-lg font-black uppercase shadow-2xl bg-primary hover:bg-primary/90 rounded-2xl"><Save className="mr-2 h-6 w-6" /> GUARDAR TODA LA CONFIGURACIÓN</Button></DialogFooter>
        </DialogContent>
    );
}

export function ClinicsManager() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
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
      const [clinicsData, specialtiesData, servicesData] = await Promise.all([getClinics(), getSpecialties(), getServiceTypes()]);
      setClinics(clinicsData);
      setSpecialties(specialtiesData);
      setServiceTypes(servicesData);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEditClick = (clinic: Clinic) => { setSelectedClinic(clinic); setIsDialogOpen(true); }
  const handleDialogSave = (updatedClinic: Clinic) => {
    setClinics(clinics.some(c => c.id === updatedClinic.id) ? clinics.map(c => c.id === updatedClinic.id ? updatedClinic : c) : [...clinics, updatedClinic]);
    setIsDialogOpen(false);
    setSelectedClinic(null);
  }
  const handleSave = () => { startSavingTransition(async () => { await updateClinics(clinics); toast({ title: 'Configuración Sincronizada' }); fetchData(); }); };

  if (isLoading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="w-full">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Card className="shadow-lg border-primary/20"><CardHeader className="flex flex-row items-center justify-between border-b pb-6"><div><CardTitle className="text-2xl font-black uppercase flex items-center gap-2"><Hospital className="h-7 w-7 text-primary" /> Unidades Médicas</CardTitle></div><div className="flex gap-2"><Button variant="outline" onClick={fetchData} className="h-11"><RefreshCw className="h-4 w-4" /></Button><Button onClick={() => { setSelectedClinic({ id: uuidv4(), name: '', doctorName: '', password: '123', dailySlots: 15, waitlistSlots: 0, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, serviceTypeId: serviceTypes[0]?.id || '', bookingMode: BookingMode.Time, consultationDuration: 30, customSchedules: [] } as Clinic); setIsDialogOpen(true); }} className="h-11 font-bold"><PlusCircle className="mr-2 h-4 w-4" /> Nueva Unidad</Button></div></CardHeader>
          <CardContent className="pt-6"><div className="relative mb-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por consultorio o médico..." className="pl-9 h-11 w-full sm:w-96" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div><div className="border rounded-2xl overflow-hidden"><Table><TableHeader className="bg-muted/50"><TableRow><TableHead className="font-black uppercase text-[10px]">Unidad</TableHead><TableHead className="font-black uppercase text-[10px]">Médico Responsable</TableHead><TableHead className="font-black uppercase text-[10px] text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{clinics.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.doctorName.toLowerCase().includes(searchTerm.toLowerCase())).map(clinic => (<TableRow key={clinic.id} className="hover:bg-muted/30"><TableCell className="font-black text-sm text-primary uppercase">{clinic.name}</TableCell><TableCell className="text-xs uppercase font-medium">{clinic.doctorName}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => handleEditClick(clinic)} className="h-9 font-bold border-primary/20 hover:bg-primary hover:text-white transition-all"><Pencil className="h-3 w-3 mr-2" /> Editar Configuración</Button></TableCell></TableRow>))}</TableBody></Table></div></CardContent>
          <CardFooter className="bg-muted/5 border-t pt-6"><Button onClick={handleSave} disabled={isSaving} className="w-full h-14 text-xl font-black uppercase shadow-xl bg-primary hover:bg-primary/90 transition-all">SINCRONIZAR TODA LA RED MÉDICA</Button></CardFooter></Card>
          {selectedClinic && <ClinicEditDialog clinic={selectedClinic} specialties={specialties} serviceTypes={serviceTypes} onSave={handleDialogSave} onCancel={() => setIsDialogOpen(false)} />}
      </Dialog>
    </div>
  );
}

