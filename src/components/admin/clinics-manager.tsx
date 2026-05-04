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
import { updateClinics, getClinics, updateColonias, getColonias, getSpecialties } from '@/lib/actions';
import { 
    Loader2, 
    Trash2, 
    PlusCircle, 
    Hospital, 
    Save, 
    Eye, 
    EyeOff, 
    Calendar as CalendarIcon, 
    X, 
    Pencil, 
    MapPin, 
    Search, 
    ArrowUpDown, 
    ArrowUp, 
    ArrowDown 
} from 'lucide-react';
import type { Clinic, Colonia, Specialty } from '@/lib/definitions';
import { BookingMode } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { timeSlots30Min } from '@/lib/time-slots';
import { Checkbox } from '../ui/checkbox';
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
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';

const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function ClinicEditDialog({ clinic, allColonias, specialties, onSave, onCancel }: { clinic: Clinic, allColonias: Colonia[], specialties: Specialty[], onSave: (clinic: Clinic, colonias: Colonia[]) => void, onCancel: () => void }) {
    const [editedClinic, setEditedClinic] = useState<Clinic>(clinic);
    const [showPassword, setShowPassword] = useState(false);
    const [clinicColonias, setClinicColonias] = useState<Colonia[]>(() => allColonias.filter(c => c.clinicId === clinic.id));
    const [newColoniaName, setNewColoniaName] = useState('');

    const dynamicBreakSlots = useMemo(() => {
        if (!editedClinic.startTime || !editedClinic.endTime) return [];
        const duration = editedClinic.consultationDuration || 30;
        const slots: string[] = [];
        try {
            const startParts = editedClinic.startTime.split(':').map(Number);
            const endParts = editedClinic.endTime.split(':').map(Number);
            if (startParts.length !== 2 || endParts.length !== 2) return [];
            let current = new Date(1970, 0, 1, startParts[0], startParts[1]);
            const end = new Date(1970, 0, 1, endParts[0], endParts[1]);
            if (current >= end || isNaN(current.getTime())) return [];
            while (current < end) {
                const timeStr = current.toTimeString().substring(0, 5);
                slots.push(timeStr);
                current = new Date(current.getTime() + duration * 60000);
            }
        } catch (e) { return []; }
        return slots;
    }, [editedClinic.startTime, editedClinic.endTime, editedClinic.consultationDuration]);

    useEffect(() => {
        setEditedClinic(clinic);
        setClinicColonias(allColonias.filter(c => c.clinicId === clinic.id));
    }, [clinic, allColonias]);

    const handleFieldChange = (field: keyof Omit<Clinic, 'id'>, value: any) => {
        setEditedClinic(prev => ({...prev, [field]: value}));
    }
    
    const handleDaysOfActionChange = (day: string, checked: boolean) => {
        setEditedClinic(prev => {
            const currentDays = prev.daysOfAction || [];
            const newDays = checked
              ? [...currentDays, day]
              : currentDays.filter(d => d !== day);
            return { ...prev, daysOfAction: newDays };
        });
    }

    const handleAddColonia = () => {
        if (newColoniaName.trim() === '') return;
        const newColonia: Colonia = {
            id: uuidv4(),
            name: newColoniaName.trim(),
            clinicId: editedClinic.id,
        };
        setClinicColonias(prev => [...prev, newColonia]);
        setNewColoniaName('');
    }

    const handleRemoveColonia = (idToRemove: string) => {
        setClinicColonias(prev => prev.filter(c => c.id !== idToRemove));
    }


    return (
        <DialogContent className="sm:max-w-[60%]">
            <DialogHeader>
                <DialogTitle>Editar Configuración: {clinic.name || "Nueva Unidad"}</DialogTitle>
                <DialogDescription>
                    Modifica los horarios y capacidad de atención.
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto p-4 space-y-6">
                 <div className='grid sm:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                        <Label htmlFor={`name-${editedClinic.id}`}>Nombre de la Unidad / Consultorio</Label>
                        <Input
                        id={`name-${editedClinic.id}`}
                        value={editedClinic.name}
                        onChange={(e) => handleFieldChange('name', e.target.value.toUpperCase())}
                        placeholder="Ej. CONSULTORIO 1"
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`doctor-${editedClinic.id}`}>Médico Responsable</Label>
                        <Input
                        id={`doctor-${editedClinic.id}`}
                        value={editedClinic.doctorName}
                        onChange={(e) => handleFieldChange('doctorName', e.target.value.toUpperCase())}
                        placeholder="Ej. DR. JUAN PEREZ"
                        />
                    </div>
                </div>
                <div className='grid sm:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                        <Label htmlFor={`license-${editedClinic.id}`}>Cédula Profesional</Label>
                        <Input
                        id={`license-${editedClinic.id}`}
                        value={editedClinic.professionalLicense || ''}
                        onChange={(e) => handleFieldChange('professionalLicense', e.target.value.toUpperCase())}
                        placeholder="Ej. 1234567"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`password-${editedClinic.id}`}>Contraseña de Reportes</Label>
                        <div className="relative">
                            <Input
                                id={`password-${editedClinic.id}`}
                                type={showPassword ? 'text' : 'password'}
                                value={editedClinic.password}
                                onChange={(e) => handleFieldChange('password', e.target.value)}
                                placeholder="Contraseña para reportes"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute inset-y-0 right-0 h-full px-3"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
                <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                    <div className='space-y-2'>
                    <Label htmlFor={`clinicType-${editedClinic.id}`}>Tipo de Servicio / Especialidad</Label>
                    <Select value={editedClinic.clinicType} onValueChange={(value: string) => handleFieldChange('clinicType', value)}>
                        <SelectTrigger id={`clinicType-${editedClinic.id}`}><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {specialties.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    </div>
                    <div className='space-y-2'>
                    <Label htmlFor={`bookingMode-${editedClinic.id}`}>Modo de Agendar</Label>
                    <Select value={editedClinic.bookingMode} onValueChange={(value: BookingMode) => handleFieldChange('bookingMode', value)}>
                        <SelectTrigger id={`bookingMode-${editedClinic.id}`}><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={BookingMode.Time}>Por Horario</SelectItem>
                            <SelectItem value={BookingMode.Token}>Por Ficha</SelectItem>
                        </SelectContent>
                    </Select>
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`slots-${editedClinic.id}`}>Citas por día</Label>
                        <Input
                        id={`slots-${editedClinic.id}`}
                        type="number"
                        value={editedClinic.dailySlots}
                        onChange={(e) => handleFieldChange('dailySlots', parseInt(e.target.value,10) || 0)}
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`waitlist-${editedClinic.id}`}>Citas Lista de Espera</Label>
                        <Input
                        id={`waitlist-${editedClinic.id}`}
                        type="number"
                        value={editedClinic.waitlistSlots || 0}
                        onChange={(e) => handleFieldChange('waitlistSlots', parseInt(e.target.value,10) || 0)}
                        placeholder="Ej. 5"
                        />
                    </div>
                </div>
                <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                    <div className='space-y-2'>
                        <Label htmlFor={`start-${editedClinic.id}`}>Hora Inicio</Label>
                        <Select value={editedClinic.startTime} onValueChange={(value) => handleFieldChange('startTime', value)}>
                            <SelectTrigger id={`start-${editedClinic.id}`}><SelectValue /></SelectTrigger>
                            <SelectContent>{timeSlots30Min.map(slot => <SelectItem key={`start-${slot.value}`} value={slot.value}>{slot.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`end-${editedClinic.id}`}>Hora Fin</Label>
                        <Select value={editedClinic.endTime} onValueChange={(value) => handleFieldChange('endTime', value)}>
                            <SelectTrigger id={`end-${editedClinic.id}`}><SelectValue /></SelectTrigger>
                            <SelectContent>{timeSlots30Min.map(slot => <SelectItem key={`end-${slot.value}`} value={slot.value}>{slot.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`break-${editedClinic.id}`}>Tiempo de Descanso</Label>
                        <Select value={editedClinic.breakTime || ''} onValueChange={(value) => handleFieldChange('breakTime', value === 'none' ? undefined : value)}>
                            <SelectTrigger id={`break-${editedClinic.id}`}><SelectValue placeholder="Seleccionar descanso..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sin Descanso</SelectItem>
                                {dynamicBreakSlots.map(slot => (
                                    <SelectItem key={`break-${slot}`} value={slot}>{slot}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {editedClinic.bookingMode === BookingMode.Time && (
                    <div className='space-y-2'>
                        <Label htmlFor={`duration-${editedClinic.id}`}>Duración (min)</Label>
                        <Input
                            id={`duration-${editedClinic.id}`}
                            type="number"
                            value={editedClinic.consultationDuration || ''}
                            onChange={(e) => handleFieldChange('consultationDuration', parseInt(e.target.value,10) || 0)}
                            placeholder="Ej. 30"
                        />
                    </div>
                    )}
                </div>
                <div className='grid sm:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                    <Label>Días de Acción (No Citas)</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg border p-4">
                        {daysOfWeek.map(day => (
                        <div key={day} className="flex items-center space-x-2">
                            <Checkbox
                            id={`day-${editedClinic.id}-${day}`}
                            checked={editedClinic.daysOfAction?.includes(day)}
                            onCheckedChange={(checked) => handleDaysOfActionChange(day, !!checked)}
                            />
                            <Label htmlFor={`day-${editedClinic.id}-${day}`} className="font-normal">{day}</Label>
                        </div>
                        ))}
                    </div>
                    </div>
                    <div className='space-y-2'>
                        <Label>Días Inhábiles (Vacaciones)</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className='w-full justify-start text-left font-normal h-11'>
                                    <CalendarIcon className='mr-2 h-4 w-4' />
                                    <span>{editedClinic.unavailableDates && editedClinic.unavailableDates.length > 0 ? `${editedClinic.unavailableDates.length} días seleccionados` : "Seleccionar fechas"}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className='w-auto p-0'>
                                <Calendar
                                    mode="multiple"
                                    selected={(editedClinic.unavailableDates || []).map(d => new Date(d + 'T12:00:00'))}
                                    onSelect={(dates) => {
                                        const uniqueDates = Array.from(new Set(dates?.map(d => d.toISOString().split('T')[0]) || []));
                                        handleFieldChange('unavailableDates', uniqueDates);
                                    }}
                                    initialFocus
                                    locale={es}
                                    disabled={{ before: new Date() }}
                                />
                            </PopoverContent>
                        </Popover>
                        
                        <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto p-2 border rounded-md bg-muted/20">
                            {editedClinic.unavailableDates && editedClinic.unavailableDates.length > 0 ? (
                                editedClinic.unavailableDates
                                    .sort()
                                    .map(dateStr => (
                                        <Badge key={dateStr} variant="secondary" className="flex items-center gap-1.5 pr-1 font-bold text-[10px]">
                                            {format(new Date(dateStr + 'T12:00:00'), 'dd/MM/yyyy', { locale: es })}
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    const newDates = editedClinic.unavailableDates?.filter(d => d !== dateStr);
                                                    handleFieldChange('unavailableDates', newDates);
                                                }}
                                                className="hover:text-destructive transition-colors p-0.5"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))
                            ) : (
                                <p className="text-[10px] text-muted-foreground p-1 italic">No hay días de vacaciones seleccionados.</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch 
                    id={`weekend-${editedClinic.id}`}
                    checked={editedClinic.weekendBookingEnabled}
                    onCheckedChange={(checked) => handleFieldChange('weekendBookingEnabled', checked)}
                    />
                    <Label htmlFor={`weekend-${editedClinic.id}`}>Permitir citas en fin de semana</Label>
                </div>
                
                 <Separator />
                <div className="space-y-4 pt-4">
                    <Label className="text-lg font-semibold flex items-center gap-2"><MapPin/> Colonias Asignadas</Label>
                    <CardDescription>
                        Añade o elimina las colonias que son atendidas por este núcleo.
                    </CardDescription>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {clinicColonias.length > 0 ? (
                            clinicColonias.map(col => (
                                <div key={col.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-secondary/50">
                                    <span className="text-sm">{col.name}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveColonia(col.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No hay colonias asignadas a este núcleo.</p>
                        )}
                    </div>
                     <div className="flex items-center gap-2 pt-2">
                        <Input 
                            value={newColoniaName}
                            onChange={(e) => setNewColoniaName(e.target.value.toUpperCase())}
                            placeholder="Nombre de la nueva colonia"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddColonia();
                                }
                            }}
                        />
                        <Button type="button" onClick={handleAddColonia}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Agregar
                        </Button>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="button" onClick={() => onSave(editedClinic, clinicColonias)}>Guardar Cambios</Button>
            </DialogFooter>
        </DialogContent>
    );
}

export function ClinicsManager() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [colonias, setColonias] = useState<Colonia[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [clinicsData, coloniasData, specialtiesData] = await Promise.all([
          getClinics(), 
          getColonias(), 
          getSpecialties()
      ]);
      const sortedData = clinicsData.sort((a, b) => a.name.localeCompare(b.name));
      setClinics(sortedData);
      setColonias(coloniasData);
      setSpecialties(specialtiesData);
    } catch (error) {
      console.error("Failed to fetch clinics and colonias:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos. Por favor, recarga la página.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const filteredAndSortedClinics = useMemo(() => {
    let result = clinics.filter(clinic => {
      const matchesSearch = clinic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          clinic.doctorName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || clinic.clinicType === typeFilter;
      return matchesSearch && matchesType;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        let valA: any;
        let valB: any;

        if (sortConfig.key === 'coloniaCount') {
          valA = colonias.filter(c => c.clinicId === a.id).length;
          valB = colonias.filter(c => c.clinicId === b.id).length;
        } else {
          valA = (a as any)[sortConfig.key] || '';
          valB = (b as any)[sortConfig.key] || '';
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [clinics, searchTerm, typeFilter, sortConfig, colonias]);

  const handleEditClick = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setIsDialogOpen(true);
  }

  const handleAddNewClick = () => {
      const newClinic: Clinic = { 
        id: uuidv4(), 
        name: '', 
        doctorName: '', 
        professionalLicense: '',
        password: '',
        dailySlots: 15,
        waitlistSlots: 0,
        startTime: '08:00',
        endTime: '13:00',
        breakTime: undefined,
        weekendBookingEnabled: false,
        daysOfAction: [],
        unavailableDates: [],
        clinicType: specialties[0]?.name || 'Consulta Externa',
        bookingMode: BookingMode.Time,
        consultationDuration: 30,
    };
    setSelectedClinic(newClinic);
    setIsDialogOpen(true);
  }
  
  const handleDialogSave = (updatedClinic: Clinic, updatedClinicColonias: Colonia[]) => {
    const clinicExists = clinics.some(c => c.id === updatedClinic.id);
    if (clinicExists) {
        setClinics(clinics.map(c => c.id === updatedClinic.id ? updatedClinic : c));
    } else {
        setClinics(prev => [...prev, updatedClinic].sort((a, b) => a.name.localeCompare(b.name)));
    }
    
    const otherColonias = colonias.filter(c => c.clinicId !== updatedClinic.id);
    setColonias([...otherColonias, ...updatedClinicColonias]);

    setIsDialogOpen(false);
    setSelectedClinic(null);
  }

  const handleDialogCancel = () => {
      setIsDialogOpen(false);
      setSelectedClinic(null);
  }
  
  const removeClinic = (idToRemove: string) => {
    const clinicToRemove = clinics.find(c => c.id === idToRemove);
    if (clinicToRemove) {
      const associatedColonias = colonias.filter(c => c.clinicId === idToRemove);
      if (associatedColonias.length > 0) {
        toast({
          title: "Acción Bloqueada",
          description: `No se puede eliminar el consultorio "${clinicToRemove.name}" porque tiene ${associatedColonias.length} colonia(s) asignada(s).`,
          variant: "destructive",
          duration: 8000
        });
        return;
      }
    }
    setClinics(clinics.filter(c => c.id !== idToRemove));
  }

  const handleSave = () => {
    const validClinics = clinics.filter(c => c.name.trim() !== '' && c.doctorName.trim() !== '' && c.password.trim() !== '');
    if (validClinics.length !== clinics.length) {
        toast({
            title: 'Campos Requeridos',
            description: 'Nombre, Responsable y Contraseña son obligatorios.',
            variant: 'destructive',
        });
        return;
    }

    startSavingTransition(async () => {
      const [clinicsResult, coloniasResult] = await Promise.all([
        updateClinics(validClinics),
        updateColonias(colonias)
      ]);
      if (clinicsResult.success && coloniasResult.success) {
        toast({
          title: 'Configuración Guardada',
          description: 'La estructura de atención ha sido actualizada.',
          className: 'bg-accent text-accent-foreground',
        });
        await fetchData();
      } else {
        toast({
          title: 'Error',
          description: clinicsResult.message || coloniasResult.message || 'No se pudo guardar.',
          variant: 'destructive',
        });
      }
    });
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Hospital /> Estructura de Atención</CardTitle>
            <CardDescription>Cargando unidades médicas...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full">
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) handleDialogCancel() }}>
          <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
              <div>
                  <CardTitle className="flex items-center gap-2"><Hospital /> Estructura de Atención</CardTitle>
                  <CardDescription>Configura los consultorios físicos y sus áreas de influencia.</CardDescription>
              </div>
              <Button onClick={handleAddNewClick} className="bg-primary hover:bg-primary/90">
                  <PlusCircle className="mr-2 h-4 w-4" /> Agregar Consultorio
              </Button>
          </CardHeader>
          <CardContent>
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                  <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                          placeholder="Buscar por consultorio o responsable..." 
                          className="pl-9 h-10"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <div className="w-full sm:w-64">
                      <Select value={typeFilter} onValueChange={setTypeFilter}>
                          <SelectTrigger className="h-10">
                              <SelectValue placeholder="Filtrar por Servicio" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Todos los Servicios</SelectItem>
                              {specialties.map(s => (
                                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
              </div>

              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-accent/50 group transition-colors">
                              <div className="flex items-center">
                                  Consultorio {getSortIcon('name')}
                              </div>
                          </TableHead>
                          <TableHead onClick={() => handleSort('doctorName')} className="cursor-pointer hover:bg-accent/50 group transition-colors">
                              <div className="flex items-center">
                                  Responsable {getSortIcon('doctorName')}
                              </div>
                          </TableHead>
                          <TableHead onClick={() => handleSort('clinicType')} className="cursor-pointer hover:bg-accent/50 group transition-colors">
                              <div className="flex items-center">
                                  Tipo / Servicio {getSortIcon('clinicType')}
                              </div>
                          </TableHead>
                          <TableHead onClick={() => handleSort('coloniaCount')} className="cursor-pointer hover:bg-accent/50 group transition-colors">
                              <div className="flex items-center">
                                  Municipios {getSortIcon('coloniaCount')}
                              </div>
                          </TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {filteredAndSortedClinics.map(clinic => (
                          <TableRow key={clinic.id}>
                              <TableCell className="font-bold text-xs">{clinic.name}</TableCell>
                              <TableCell className="text-xs uppercase">{clinic.doctorName}</TableCell>
                              <TableCell>
                                  <Badge variant="outline" className="text-[10px] uppercase font-black tracking-tighter">
                                      {clinic.clinicType}
                                  </Badge>
                              </TableCell>
                              <TableCell>{colonias.filter(c => c.clinicId === clinic.id).length}</TableCell>
                              <TableCell className="text-right">
                                  <Button variant="ghost" size="icon" onClick={() => handleEditClick(clinic)}>
                                      <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => removeClinic(clinic.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
               {filteredAndSortedClinics.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground italic">
                      No se encontraron consultorios con los criterios seleccionados.
                  </div>
              )}
          </CardContent>
          <CardFooter>
              <Button onClick={handleSave} disabled={isSaving} className="w-full h-12 font-bold">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? 'Guardando...' : 'Confirmar Cambios en Estructura'}
              </Button>
          </CardFooter>
          </Card>

          {selectedClinic && (
              <ClinicEditDialog
                  clinic={selectedClinic}
                  allColonias={colonias}
                  specialties={specialties}
                  onSave={handleDialogSave}
                  onCancel={handleDialogCancel}
              />
          )}
      </Dialog>
    </div>
  );
}
