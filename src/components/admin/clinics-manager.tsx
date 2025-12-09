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
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';


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
        setClinics(data);
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

  const handleClinicChange = (id: string, field: keyof Omit<Clinic, 'id'>, value: string | number | boolean) => {
    setClinics(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c))
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
        <CardDescription>Configura los detalles de cada núcleo básico.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 max-h-96 overflow-y-auto p-4">
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
                    <Label htmlFor={`slots-${clinic.id}`}>Citas por día</Label>
                    <Input
                    id={`slots-${clinic.id}`}
                    type="number"
                    value={clinic.dailySlots}
                    onChange={(e) => handleClinicChange(clinic.id, 'dailySlots', parseInt(e.target.value,10) || 0)}
                    />
                </div>
                <div className='space-y-2'>
                    <Label htmlFor={`start-${clinic.id}`}>Hora Inicio</Label>
                    <Input
                    id={`start-${clinic.id}`}
                    type="time"
                    value={clinic.startTime}
                    onChange={(e) => handleClinicChange(clinic.id, 'startTime', e.target.value)}
                    />
                </div>
                <div className='space-y-2'>
                    <Label htmlFor={`end-${clinic.id}`}>Hora Fin</Label>
                    <Input
                    id={`end-${clinic.id}`}
                    type="time"
                    value={clinic.endTime}
                    onChange={(e) => handleClinicChange(clinic.id, 'endTime', e.target.value)}
                    />
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
