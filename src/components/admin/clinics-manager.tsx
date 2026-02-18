
'use client';
import { useState, useEffect, useTransition } from 'react';
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
import { updateClinics, getClinics } from '@/lib/actions';
import { Loader2, Trash2, PlusCircle, Hospital, Save, Eye, EyeOff } from 'lucide-react';
import type { Clinic } from '@/lib/definitions';
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

const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function ClinicsManager() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const fetchClinics = async () => {
      setIsLoading(true);
      try {
        const data = await getClinics();
        const sortedData = data.sort((a, b) => a.name.localeCompare(b.name));
        setClinics(sortedData);
      } catch (error) {
        console.error("Failed to fetch clinics:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los núcleos. Por favor, recarga la página.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchClinics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClinicChange = (id: string, field: keyof Omit<Clinic, 'id'>, value: any) => {
    setClinics(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  };
  
  const handleDaysOfActionChange = (id: string, day: string, checked: boolean) => {
    setClinics(prev =>
      prev.map(c => {
        if (c.id === id) {
          const currentDays = c.daysOfAction || [];
          const newDays = checked
            ? [...currentDays, day]
            : currentDays.filter(d => d !== day);
          return { ...c, daysOfAction: newDays };
        }
        return c;
      })
    );
  };

  const toggleShowPassword = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const addClinic = () => {
    const newClinic: Clinic = { 
        id: uuidv4(), 
        name: '', 
        doctorName: '', 
        password: '',
        dailySlots: 15,
        startTime: '08:00',
        endTime: '13:00',
        weekendBookingEnabled: false,
        daysOfAction: [],
        unavailableDates: [],
        clinicType: ClinicType.ConsultaExterna,
        bookingMode: BookingMode.Time,
        consultationDuration: 30,
    };
    setClinics([...clinics, newClinic]);
  };

  const removeClinic = (id: string) => {
    setClinics(clinics.filter(c => c.id !== id));
  };

  const handleSave = () => {
    const validClinics = clinics.filter(c => c.name.trim() !== '' && c.doctorName.trim() !== '' && c.password.trim() !== '');
    if (validClinics.length !== clinics.length) {
        toast({
            title: 'Campos Requeridos',
            description: 'El nombre del núcleo, del doctor y la contraseña no pueden estar vacíos.',
            variant: 'destructive',
        });
        return;
    }

    startSavingTransition(async () => {
      const result = await updateClinics(validClinics);
      if (result.success) {
        toast({
          title: 'Configuración Guardada',
          description: 'La configuración de núcleos básicos ha sido actualizada. Se requiere un reinicio del servidor para que los cambios se reflejen en la UI de reserva.',
          className: 'bg-accent text-accent-foreground',
          duration: 8000,
        });
        await fetchClinics();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'No se pudo guardar la configuración.',
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
            <CardDescription>Configura los detalles de cada núcleo básico.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Hospital /> Gestionar Núcleos Básicos</CardTitle>
        <CardDescription>Configura los detalles y horarios de cada núcleo básico.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 max-h-[32rem] overflow-y-auto p-4">
        {clinics.map((clinic) => (
          <div key={clinic.id} className="p-4 border rounded-lg space-y-4 relative bg-background">
             <Button
              variant="ghost"
              size="icon"
              onClick={() => removeClinic(clinic.id)}
              className="absolute top-2 right-2"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
            <div className='grid sm:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                    <Label htmlFor={`name-${clinic.id}`}>Nombre del Núcleo</Label>
                    <Input
                    id={`name-${clinic.id}`}
                    value={clinic.name}
                    onChange={(e) => handleClinicChange(clinic.id, 'name', e.target.value)}
                    placeholder="Ej. Núcleo Básico 1"
                    />
                </div>
                 <div className='space-y-2'>
                    <Label htmlFor={`doctor-${clinic.id}`}>Nombre del Doctor</Label>
                    <Input
                    id={`doctor-${clinic.id}`}
                    value={clinic.doctorName}
                    onChange={(e) => handleClinicChange(clinic.id, 'doctorName', e.target.value)}
                    placeholder="Ej. Dr. Juan Pérez"
                    />
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor={`password-${clinic.id}`}>Contraseña</Label>
                <div className="relative">
                    <Input
                        id={`password-${clinic.id}`}
                        type={showPasswords[clinic.id] ? 'text' : 'password'}
                        value={clinic.password}
                        onChange={(e) => handleClinicChange(clinic.id, 'password', e.target.value)}
                        placeholder="Contraseña para reportes"
                    />
                     <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute inset-y-0 right-0 h-full px-3"
                        onClick={() => toggleShowPassword(clinic.id)}
                      >
                        {showPasswords[clinic.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                </div>
            </div>
            <div className='grid sm:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor={`clinicType-${clinic.id}`}>Tipo de Núcleo</Label>
                  <Select value={clinic.clinicType} onValueChange={(value: ClinicType) => handleClinicChange(clinic.id, 'clinicType', value)}>
                      <SelectTrigger id={`clinicType-${clinic.id}`}><SelectValue/></SelectTrigger>
                      <SelectContent>
                          {Object.values(ClinicType).map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                      </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor={`bookingMode-${clinic.id}`}>Modo de Agendar</Label>
                  <Select value={clinic.bookingMode} onValueChange={(value: BookingMode) => handleClinicChange(clinic.id, 'bookingMode', value)}>
                      <SelectTrigger id={`bookingMode-${clinic.id}`}><SelectValue/></SelectTrigger>
                      <SelectContent>
                          <SelectItem value={BookingMode.Time}>Por Horario</SelectItem>
                          <SelectItem value={BookingMode.Token}>Por Ficha</SelectItem>
                      </SelectContent>
                  </Select>
                </div>
                 <div className='space-y-2'>
                    <Label htmlFor={`slots-${clinic.id}`}>Citas por día</Label>
                    <Input
                    id={`slots-${clinic.id}`}
                    type="number"
                    value={clinic.dailySlots}
                    onChange={(e) => handleClinicChange(clinic.id, 'dailySlots', parseInt(e.target.value,10) || 0)}
                    />
                </div>
            </div>
             <div className='grid sm:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                    <Label htmlFor={`start-${clinic.id}`}>Hora Inicio</Label>
                    <Select value={clinic.startTime} onValueChange={(value) => handleClinicChange(clinic.id, 'startTime', value)}>
                        <SelectTrigger id={`start-${clinic.id}`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {timeSlots30Min.map(slot => <SelectItem key={`start-${slot.value}`} value={slot.value}>{slot.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className='space-y-2'>
                    <Label htmlFor={`end-${clinic.id}`}>Hora Fin</Label>
                     <Select value={clinic.endTime} onValueChange={(value) => handleClinicChange(clinic.id, 'endTime', value)}>
                        <SelectTrigger id={`end-${clinic.id}`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {timeSlots30Min.map(slot => <SelectItem key={`end-${slot.value}`} value={slot.value}>{slot.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {clinic.bookingMode === BookingMode.Time && (
                  <div className='space-y-2'>
                      <Label htmlFor={`duration-${clinic.id}`}>Duración (min)</Label>
                      <Input
                          id={`duration-${clinic.id}`}
                          type="number"
                          value={clinic.consultationDuration || ''}
                          onChange={(e) => handleClinicChange(clinic.id, 'consultationDuration', parseInt(e.target.value,10) || 0)}
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
                          id={`day-${clinic.id}-${day}`}
                          checked={clinic.daysOfAction?.includes(day)}
                          onCheckedChange={(checked) => handleDaysOfActionChange(clinic.id, day, !!checked)}
                        />
                        <Label htmlFor={`day-${clinic.id}-${day}`} className="font-normal">{day}</Label>
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
                                <span>{clinic.unavailableDates && clinic.unavailableDates.length > 0 ? `${clinic.unavailableDates.length} días seleccionados` : "Seleccionar fechas"}</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className='w-auto p-0'>
                             <Calendar
                                mode="multiple"
                                selected={(clinic.unavailableDates || []).map(d => new Date(d))}
                                onSelect={(dates) => handleClinicChange(clinic.id, 'unavailableDates', dates?.map(d => d.toISOString().split('T')[0]) || [])}
                                initialFocus
                                locale={es}
                             />
                        </PopoverContent>
                    </Popover>
                </div>
             </div>
            <div className="flex items-center space-x-2">
                <Switch 
                id={`weekend-${clinic.id}`}
                checked={clinic.weekendBookingEnabled}
                onCheckedChange={(checked) => handleClinicChange(clinic.id, 'weekendBookingEnabled', checked)}
                />
                <Label htmlFor={`weekend-${clinic.id}`}>Permitir citas en fin de semana</Label>
            </div>
          </div>
        ))}
         <Button
            variant="outline"
            className="w-full"
            onClick={addClinic}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Agregar Núcleo Básico
          </Button>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isSaving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </CardFooter>
    </Card>
  );
}
