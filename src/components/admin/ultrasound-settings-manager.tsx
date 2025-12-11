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
import { updateUltrasoundSettings, getUltrasoundSettings, updateUltrasoundStudies, getUltrasoundStudies } from '@/lib/actions';
import { Loader2, Save, Waves, CalendarClock, Settings, PlusCircle, Trash2 } from 'lucide-react';
import type { UltrasoundSettings, UltrasoundStudy } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';

export function UltrasoundSettingsManager() {
  const [settings, setSettings] = useState<UltrasoundSettings | null>(null);
  const [studies, setStudies] = useState<UltrasoundStudy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [settingsData, studiesData] = await Promise.all([
        getUltrasoundSettings(),
        getUltrasoundStudies()
      ]);
      setSettings(settingsData);
      setStudies(studiesData);
    } catch (error) {
      console.error('Failed to fetch Ultrasound settings:', error);
      toast({
        title: 'Error',
        description:
          'No se pudo cargar la configuración de Ultrasonido.',
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

  const handleSettingsChange = (field: keyof UltrasoundSettings, value: string | number | boolean) => {
    if (settings) {
        setSettings({ ...settings, [field]: value });
    }
  };

  const handleStudyChange = (id: string, field: keyof UltrasoundStudy, value: string | boolean) => {
    setStudies(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };
  
  const addStudy = () => {
    const newStudy: UltrasoundStudy = { id: uuidv4(), name: '', indications: '', available: true };
    setStudies([...studies, newStudy]);
  };

  const removeStudy = (id: string) => {
    setStudies(studies.filter(s => s.id !== id));
  };

  const handleSave = () => {
    if (!settings) return;

    startSavingTransition(async () => {
      const validStudies = studies.filter(s => s.name.trim() !== '' && s.indications.trim() !== '');
      if (validStudies.length !== studies.length) {
          toast({
              title: 'Campos Requeridos',
              description: 'El nombre y las indicaciones del estudio no pueden estar vacíos.',
              variant: 'destructive',
          });
          return;
      }
      
      const results = await Promise.all([
          updateUltrasoundSettings(settings),
          updateUltrasoundStudies(studies)
      ]);

      const settingsResult = results[0];
      const studiesResult = results[1];

      if (settingsResult.success && studiesResult.success) {
        toast({
          title: 'Configuración Guardada',
          description: 'La configuración de Ultrasonido ha sido actualizada. Se requiere un reinicio del servidor para que los cambios se reflejen.',
          className: 'bg-accent text-accent-foreground',
          duration: 8000,
        });
        await fetchData();
      } else {
        toast({
          title: 'Error',
          description: settingsResult.message || studiesResult.message ||'No se pudo guardar la configuración.',
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
            <Settings /> Configuración de Ultrasonido
          </CardTitle>
          <CardDescription>
            Gestiona los horarios y la disponibilidad de los estudios.
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
          <Settings /> Configuración de Ultrasonido
        </CardTitle>
        <CardDescription>
          Gestiona los horarios, la disponibilidad y el catálogo de estudios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-6">
            <h3 className="font-semibold text-lg flex items-center gap-2"><CalendarClock/> Horarios y Citas</h3>
            <div className='grid sm:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                    <Label htmlFor="ultrasound-slots">Citas por día</Label>
                    <Input
                    id="ultrasound-slots"
                    type="number"
                    value={settings.dailySlots}
                    onChange={(e) => handleSettingsChange('dailySlots', parseInt(e.target.value,10) || 0)}
                    />
                </div>
                <div className='space-y-2'>
                    <Label htmlFor="ultrasound-start">Hora Inicio</Label>
                    <Input
                    id="ultrasound-start"
                    type="time"
                    value={settings.startTime}
                    onChange={(e) => handleSettingsChange('startTime', e.target.value)}
                    />
                </div>
                <div className='space-y-2'>
                    <Label htmlFor="ultrasound-end">Hora Fin</Label>
                    <Input
                    id="ultrasound-end"
                    type="time"
                    value={settings.endTime}
                    onChange={(e) => handleSettingsChange('endTime', e.target.value)}
                    />
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <Switch 
                id="ultrasound-weekend"
                checked={settings.weekendBookingEnabled}
                onCheckedChange={(checked) => handleSettingsChange('weekendBookingEnabled', checked)}
                />
                <Label htmlFor="ultrasound-weekend">Permitir citas en fin de semana</Label>
            </div>
        </div>
         <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><Waves/> Gestionar Estudios</h3>
            <ScrollArea className="h-72 w-full rounded-md border p-4 space-y-4">
              {studies.map(study => (
                  <div key={study.id} className="p-4 border rounded-lg space-y-4 relative bg-background/50">
                    <Button variant="ghost" size="icon" onClick={() => removeStudy(study.id)} className="absolute top-2 right-2 h-6 w-6"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    <div className="grid grid-cols-2 gap-4 items-center">
                      <div className='space-y-2'>
                        <Label htmlFor={`us-name-${study.id}`}>Nombre del Estudio</Label>
                        <Input id={`us-name-${study.id}`} value={study.name} onChange={(e) => handleStudyChange(study.id, 'name', e.target.value)} placeholder="Ej. Ultrasonido Abdominal"/>
                      </div>
                      <div className="flex items-center space-x-2 pt-6">
                        <Switch id={`us-available-${study.id}`} checked={study.available} onCheckedChange={(checked) => handleStudyChange(study.id, 'available', checked)} />
                        <Label htmlFor={`us-available-${study.id}`}>Disponible</Label>
                      </div>
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`us-indications-${study.id}`}>Indicaciones</Label>
                        <Textarea id={`us-indications-${study.id}`} value={study.indications} onChange={(e) => handleStudyChange(study.id, 'indications', e.target.value)} placeholder="Indicaciones para el paciente..."/>
                    </div>
                  </div>
              ))}
               <Button variant="outline" className="w-full mt-4" onClick={addStudy}><PlusCircle className="mr-2 h-4 w-4" />Agregar Estudio</Button>
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
          {isSaving ? 'Guardando...' : 'Guardar Configuración de Ultrasonido'}
        </Button>
      </CardFooter>
    </Card>
  );
}
