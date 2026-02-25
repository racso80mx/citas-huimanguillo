
'use client';
import { useState, useEffect, useTransition, useCallback } from 'react';
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
import { updateClinics, getClinics, updateColonias, getColonias } from '@/lib/actions';
import { Loader2, Trash2, PlusCircle, Hospital, Save, Eye, EyeOff, Calendar as CalendarIcon, X, Pencil, MapPin } from 'lucide-react';
import type { Clinic, Colonia } from '@/lib/definitions';
import { ClinicType, BookingMode } from '@/lib/definitions';
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

const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function ClinicEditDialog({ clinic, allColonias, onSave, onCancel }: { clinic: Clinic, allColonias: Colonia[], onSave: (clinic: Clinic, colonias: Colonia[]) => void, onCancel: () => void }) {
    const [editedClinic, setEditedClinic] = useState<Clinic>(clinic);
    const [showPassword, setShowPassword] = useState(false);
    const [clinicColonias, setClinicColonias] = useState<Colonia[]>(() => allColonias.filter(c => c.clinicId === clinic.id));
    const [newColoniaName, setNewColoniaName] = useState('');

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
                <DialogTitle>Editar Núcleo Básico: {clinic.name || "Nuevo Núcleo"}</DialogTitle>
                <DialogDescription>
                    Modifica los detalles del núcleo básico y sus colonias. Los cambios se guardarán al presionar "Guardar Cambios".
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto p-4 space-y-6">
                 <div className='grid sm:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                        <Label htmlFor={`name-${editedClinic.id}`}>Nombre del Núcleo</Label>
                        <Input
                        id={`name-${editedClinic.id}`}
                        value={editedClinic.name}
                        onChange={(e) => handleFieldChange('name', e.target.value)}
                        placeholder="Ej. Núcleo Básico 1"
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`doctor-${editedClinic.id}`}>Nombre del Doctor</Label>
                        <Input
                        id={`doctor-${editedClinic.id}`}
                        value={editedClinic.doctorName}
                        onChange={(e) => handleFieldChange('doctorName', e.target.value)}
                        placeholder="Ej. Dr. Juan Pérez"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`password-${editedClinic.id}`}>Contraseña</Label>
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
                <div className='grid sm:grid-cols-3 gap-4'>
                    <div className='space-y-2'>
                    <Label htmlFor={`clinicType-${editedClinic.id}`}>Tipo de Núcleo</Label>
                    <Select value={editedClinic.clinicType} onValueChange={(value: ClinicType) => handleFieldChange('clinicType', value)}>
                        <SelectTrigger id={`clinicType-${editedClinic.id}`}><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {Object.values(ClinicType).map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
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
                                {timeSlots30Min.filter(slot => slot.value >= editedClinic.startTime && slot.value < editedClinic.endTime).map(slot => (
                                    <SelectItem key={`break-${slot.value}`} value={slot.value}>{slot.label}</SelectItem>
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
                                <Button variant="outline" className='w-full justify-start text-left font-normal'>
                                    <CalendarIcon className='mr-2 h-4 w-4' />
                                    <span>{editedClinic.unavailableDates && editedClinic.unavailableDates.length > 0 ? `${editedClinic.unavailableDates.length} días seleccionados` : "Seleccionar fechas"}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className='w-auto p-0'>
                                <Calendar
                                    mode="multiple"
                                    selected={(editedClinic.unavailableDates || []).map(d => new Date(d))}
                                    onSelect={(dates) => handleFieldChange('unavailableDates', dates?.map(d => d.toISOString().split('T')[0]) || [])}
                                    initialFocus
                                    locale={es}
                                    disabled={{ before: new Date() }}
                                />
                            </PopoverContent>
                        </Popover>
                        {editedClinic.unavailableDates && editedClinic.unavailableDates.length > 0 && (
                            <div className="mt-2 space-y-2">
                                <div className="flex flex-wrap gap-2">
                                    {(editedClinic.unavailableDates || []).sort().map(dateStr => (
                                        <Badge key={dateStr} variant="secondary" className="flex items-center gap-1.5 pl-2 pr-1 py-0.5">
                                            <span>
                                                {format(new Date(dateStr + 'T12:00:00'), "PPP", { locale: es })}
                                            </span>
                                            <button
                                                type="button"
                                                aria-label={`Quitar ${dateStr}`}
                                                className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                                                onClick={() => {
                                                    const newDates = editedClinic.unavailableDates?.filter(d => d !== dateStr) || [];
                                                    handleFieldChange('unavailableDates', newDates);
                                                }}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
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
                            onChange={(e) => setNewColoniaName(e.target.value)}
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [clinicsData, coloniasData] = await Promise.all([getClinics(), getColonias()]);
      const sortedData = clinicsData.sort((a, b) => a.name.localeCompare(b.name));
      setClinics(sortedData);
      setColonias(coloniasData);
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

  const handleEditClick = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setIsDialogOpen(true);
  }

  const handleAddNewClick = () => {
      const newClinic: Clinic = { 
        id: uuidv4(), 
        name: '', 
        doctorName: '', 
        password: '',
        dailySlots: 15,
        startTime: '08:00',
        endTime: '13:00',
        breakTime: undefined,
        weekendBookingEnabled: false,
        daysOfAction: [],
        unavailableDates: [],
        clinicType: ClinicType.ConsultaExterna,
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
    
    // Update the main colonias list by replacing all colonias for the edited clinic
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
          description: `No se puede eliminar el núcleo "${clinicToRemove.name}" porque tiene ${associatedColonias.length} colonia(s) asignada(s). Por favor, reasigna o elimina esas colonias primero.`,
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
            description: 'El nombre del núcleo, del doctor y la contraseña no pueden estar vacíos en ningún núcleo.',
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
          description: 'La configuración de núcleos y colonias ha sido actualizada. Se requiere un reinicio del servidor para que los cambios se reflejen.',
          className: 'bg-accent text-accent-foreground',
          duration: 8000,
        });
        await fetchData();
      } else {
        toast({
          title: 'Error',
          description: clinicsResult.message || coloniasResult.message || 'No se pudo guardar la configuración.',
          variant: 'destructive',
        });
      }
    });
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Hospital /> Gestionar Núcleos Básicos</CardTitle>
            <CardDescription>Configura los detalles de cada núcleo básico y sus colonias asignadas.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) handleDialogCancel() }}>
        <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="flex items-center gap-2"><Hospital /> Gestionar Núcleos Básicos</CardTitle>
                <CardDescription>Configura los detalles de cada núcleo básico y sus colonias asignadas.</CardDescription>
            </div>
            <Button onClick={handleAddNewClick}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Núcleo</Button>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nombre del Núcleo</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Colonias</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {clinics.map(clinic => (
                        <TableRow key={clinic.id}>
                            <TableCell className="font-medium">{clinic.name}</TableCell>
                            <TableCell>{clinic.doctorName}</TableCell>
                            <TableCell>{clinic.clinicType}</TableCell>
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
             {clinics.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                    No hay núcleos básicos definidos. Agrega uno para comenzar.
                </div>
            )}
        </CardContent>
        <CardFooter>
            <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? 'Guardando...' : 'Guardar Todos los Cambios'}
            </Button>
        </CardFooter>
        </Card>

        {selectedClinic && (
            <ClinicEditDialog
                clinic={selectedClinic}
                allColonias={colonias}
                onSave={handleDialogSave}
                onCancel={handleDialogCancel}
            />
        )}
    </Dialog>
  );
}
