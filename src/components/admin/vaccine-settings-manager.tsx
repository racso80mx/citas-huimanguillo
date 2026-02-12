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
import { updateVaccineSettings, getVaccineSettings, updateVaccines, getVaccines } from '@/lib/actions';
import { Loader2, Save, ShieldPlus, CalendarClock, Settings, Eye, EyeOff, PlusCircle, Trash2 } from 'lucide-react';
import type { VaccineSettings, Vaccine } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { timeSlots10Min } from '@/lib/time-slots';

export function VaccineSettingsManager() {
  const [settings, setSettings] = useState<VaccineSettings | null>(null);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [settingsData, vaccinesData] = await Promise.all([
        getVaccineSettings(),
        getVaccines()
      ]);
      setSettings(settingsData);
      setVaccines(vaccinesData);
    } catch (error) {
      console.error('Failed to fetch vaccine settings:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración de vacunación.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSettingsChange = (field: keyof VaccineSettings, value: string | number | boolean) => {
    if (settings) {
        setSettings({ ...settings, [field]: value });
    }
  };

  const handleVaccineChange = (id: string, field: keyof Vaccine, value: string | boolean) => {
    setVaccines(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  };
  
  const addVaccine = () => {
    const newVaccine: Vaccine = { 
        id: uuidv4(), 
        name: '', 
        applicationAge: '', 
        sex: '', 
        description: '', 
        available: true 
    };
    setVaccines([...vaccines, newVaccine]);
  };

  const removeVaccine = (id: string) => {
    setVaccines(vaccines.filter(v => v.id !== id));
  };

  const handleSave = () => {
    if (!settings) return;

    startSavingTransition(async () => {
      const validVaccines = vaccines.filter(v => v.name.trim() !== '' && v.description.trim() !== '');
      if (validVaccines.length !== vaccines.length) {
          toast({
              title: 'Campos Requeridos',
              description: 'El nombre y la descripción de la vacuna no pueden estar vacíos.',
              variant: 'destructive',
          });
          return;
      }
      
      const results = await Promise.all([
          updateVaccineSettings(settings),
          updateVaccines(vaccines)
      ]);

      const settingsResult = results[0];
      const vaccinesResult = results[1];

      if (settingsResult.success && vaccinesResult.success) {
        toast({
          title: 'Configuración Guardada',
          description: 'La configuración de vacunación ha sido actualizada. Se requiere un reinicio del servidor para que los cambios se reflejen.',
          className: 'bg-accent text-accent-foreground',
          duration: 8000,
        });
        await fetchData();
      } else {
        toast({
          title: 'Error',
          description: settingsResult.message || vaccinesResult.message ||'No se pudo guardar la configuración.',
          variant: 'destructive',
        });
      }
    });
  };

  if (isLoading || !settings) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings /> Configuración de Vacunación
          </CardTitle>
          <CardDescription>
            Gestiona los horarios y la disponibilidad de las vacunas.
          </CardDescription>
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
        <CardTitle className="flex items-center gap-2">
          <Settings /> Configuración de Vacunación
        </CardTitle>
        <CardDescription>
          Gestiona los horarios, la disponibilidad y el catálogo de vacunas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-6">
            <h3 className="font-semibold text-lg flex items-center gap-2"><CalendarClock/> Citas y Horarios</h3>
             <div className='grid sm:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                    <Label htmlFor="vaccine-slots">Citas por día</Label>
                    <Input
                    id="vaccine-slots"
                    type="number"
                    value={settings.dailySlots}
                    onChange={(e) => handleSettingsChange('dailySlots', parseInt(e.target.value,10) || 0)}
                    />
                </div>
                <div className='space-y-2'>
                    <Label htmlFor="vaccine-start">Hora Inicio</Label>
                    <Select value={settings.startTime} onValueChange={(value) => handleSettingsChange('startTime', value)}>
                        <SelectTrigger id="vaccine-start"><SelectValue /></SelectTrigger>
                        <SelectContent>{timeSlots10Min.map(slot => <SelectItem key={`start-${slot.value}`} value={slot.value}>{slot.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className='space-y-2'>
                    <Label htmlFor="vaccine-end">Hora Fin</Label>
                    <Select value={settings.endTime} onValueChange={(value) => handleSettingsChange('endTime', value)}>
                        <SelectTrigger id="vaccine-end"><SelectValue /></SelectTrigger>
                        <SelectContent>{timeSlots10Min.map(slot => <SelectItem key={`end-${slot.value}`} value={slot.value}>{slot.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <Switch 
                id="vaccine-weekend"
                checked={settings.weekendBookingEnabled}
                onCheckedChange={(checked) => handleSettingsChange('weekendBookingEnabled', checked)}
                />
                <Label htmlFor="vaccine-weekend">Permitir citas en fin de semana</Label>
            </div>
            <div className="space-y-2">
                <Label htmlFor="vaccine-password">Contraseña para Reportes</Label>
                <div className="relative">
                    <Input
                        id="vaccine-password"
                        type={showPassword ? 'text' : 'password'}
                        value={settings.password || ''}
                        onChange={(e) => handleSettingsChange('password', e.target.value)}
                        placeholder="Contraseña para reportes de Vacunación"
                    />
                     <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute inset-y-0 right-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                </div>
            </div>
        </div>
         <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><ShieldPlus/> Gestionar Vacunas</h3>
            <ScrollArea className="h-72 w-full rounded-md border p-4 space-y-4">
              {vaccines.map(vaccine => (
                <div key={vaccine.id} className="p-4 border rounded-lg space-y-4 relative bg-background/50">
                    <Button variant="ghost" size="icon" onClick={() => removeVaccine(vaccine.id)} className="absolute top-2 right-2 h-6 w-6"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    <div className="grid grid-cols-2 gap-4 items-center">
                        <div className='space-y-2'>
                            <Label htmlFor={`vac-name-${vaccine.id}`}>Nombre</Label>
                            <Input id={`vac-name-${vaccine.id}`} value={vaccine.name} onChange={(e) => handleVaccineChange(vaccine.id, 'name', e.target.value)} placeholder="Ej. BCG"/>
                        </div>
                        <div className="flex items-center space-x-2 pt-6">
                            <Switch id={`vac-available-${vaccine.id}`} checked={vaccine.available} onCheckedChange={(checked) => handleVaccineChange(vaccine.id, 'available', checked)} />
                            <Label htmlFor={`vac-available-${vaccine.id}`}>Disponible</Label>
                        </div>
                    </div>
                     <div className='grid grid-cols-2 gap-4'>
                         <div className='space-y-2'>
                            <Label htmlFor={`vac-age-${vaccine.id}`}>Edad de Aplicación</Label>
                            <Input id={`vac-age-${vaccine.id}`} value={vaccine.applicationAge} onChange={(e) => handleVaccineChange(vaccine.id, 'applicationAge', e.target.value)} placeholder="Ej. Al nacer"/>
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor={`vac-sex-${vaccine.id}`}>Sexo</Label>
                            <Input id={`vac-sex-${vaccine.id}`} value={vaccine.sex} onChange={(e) => handleVaccineChange(vaccine.id, 'sex', e.target.value)} placeholder="Ej. Ambos"/>
                        </div>
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`vac-desc-${vaccine.id}`}>Descripción / Protección</Label>
                        <Textarea id={`vac-desc-${vaccine.id}`} value={vaccine.description} onChange={(e) => handleVaccineChange(vaccine.id, 'description', e.target.value)} placeholder="Protege contra..."/>
                    </div>
                </div>
              ))}
               <Button variant="outline" className="w-full mt-4" onClick={addVaccine}><PlusCircle className="mr-2 h-4 w-4" />Agregar Vacuna</Button>
            </ScrollArea>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isSaving ? 'Guardando...' : 'Guardar Configuración de Vacunación'}
        </Button>
      </CardFooter>
    </Card>
  );
}
