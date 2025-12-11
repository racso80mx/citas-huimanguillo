'use client';
import { useState, useEffect, useTransition } from 'react';
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
import { updateXRaySettings, getXRaySettings, updateXRayStudies, getXRayStudies } from '@/lib/actions';
import { Loader2, Save, Stethoscope, CalendarClock, Settings } from 'lucide-react';
import type { XRaySettings, XRayStudy } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';

export function XRaySettingsManager() {
  const [settings, setSettings] = useState<XRaySettings | null>(null);
  const [studies, setStudies] = useState<XRayStudy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [settingsData, studiesData] = await Promise.all([
        getXRaySettings(),
        getXRayStudies()
      ]);
      setSettings(settingsData);
      setStudies(studiesData);
    } catch (error) {
      console.error('Failed to fetch X-Ray settings:', error);
      toast({
        title: 'Error',
        description:
          'No se pudo cargar la configuración de Rayos X.',
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

  const handleSettingsChange = (field: keyof XRaySettings, value: string | number | boolean) => {
    if (settings) {
        setSettings({ ...settings, [field]: value });
    }
  };

  const handleStudyAvailabilityChange = (id: string, available: boolean) => {
      setStudies(prev => prev.map(s => s.id === id ? {...s, available} : s));
  }

  const handleSave = () => {
    if (!settings) return;

    startSavingTransition(async () => {
      const results = await Promise.all([
          updateXRaySettings(settings),
          updateXRayStudies(studies)
      ]);

      const settingsResult = results[0];
      const studiesResult = results[1];

      if (settingsResult.success && studiesResult.success) {
        toast({
          title: 'Configuración Guardada',
          description: 'La configuración de Rayos X ha sido actualizada. Se requiere un reinicio del servidor para que los cambios se reflejen.',
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
            <Settings /> Configuración de Rayos X
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
          <Settings /> Configuración de Rayos X
        </CardTitle>
        <CardDescription>
          Gestiona los horarios y la disponibilidad de los estudios.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
            <h3 className="font-semibold text-lg flex items-center gap-2"><CalendarClock/> Horarios y Citas</h3>
            <div className='grid sm:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                    <Label htmlFor="xray-slots">Citas por día</Label>
                    <Input
                    id="xray-slots"
                    type="number"
                    value={settings.dailySlots}
                    onChange={(e) => handleSettingsChange('dailySlots', parseInt(e.target.value,10) || 0)}
                    />
                </div>
                <div className='space-y-2'>
                    <Label htmlFor="xray-start">Hora Inicio</Label>
                    <Input
                    id="xray-start"
                    type="time"
                    value={settings.startTime}
                    onChange={(e) => handleSettingsChange('startTime', e.target.value)}
                    />
                </div>
                <div className='space-y-2'>
                    <Label htmlFor="xray-end">Hora Fin</Label>
                    <Input
                    id="xray-end"
                    type="time"
                    value={settings.endTime}
                    onChange={(e) => handleSettingsChange('endTime', e.target.value)}
                    />
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <Switch 
                id="xray-weekend"
                checked={settings.weekendBookingEnabled}
                onCheckedChange={(checked) => handleSettingsChange('weekendBookingEnabled', checked)}
                />
                <Label htmlFor="xray-weekend">Permitir citas en fin de semana</Label>
            </div>
        </div>
         <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><Stethoscope/> Estudios Disponibles</h3>
            <ScrollArea className="h-72 w-full rounded-md border p-4">
              <div className="space-y-2">
                {studies.map(study => (
                  <div key={study.id} className="flex items-center justify-between">
                    <Label htmlFor={`study-${study.id}`} className="flex-1">
                      {study.name}
                    </Label>
                    <Switch
                      id={`study-${study.id}`}
                      checked={study.available}
                      onCheckedChange={(checked) => handleStudyAvailabilityChange(study.id, checked)}
                    />
                  </div>
                ))}
              </div>
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
          {isSaving ? 'Guardando...' : 'Guardar Configuración de Rayos X'}
        </Button>
      </CardFooter>
    </Card>
  );
}
