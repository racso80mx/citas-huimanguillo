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
import { updateLabSettings, getLabSettings, updateLabStudies, getLabStudies } from '@/lib/actions';
import { Loader2, Save, FlaskConical, CalendarClock, Settings, CheckSquare, Square } from 'lucide-react';
import type { LabSettings, LabStudy } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';

export function LabSettingsManager() {
  const [settings, setSettings] = useState<LabSettings | null>(null);
  const [studies, setStudies] = useState<LabStudy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [settingsData, studiesData] = await Promise.all([
        getLabSettings(),
        getLabStudies()
      ]);
      setSettings(settingsData);
      setStudies(studiesData);
    } catch (error) {
      console.error('Failed to fetch lab settings:', error);
      toast({
        title: 'Error',
        description:
          'No se pudo cargar la configuración del laboratorio.',
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

  const handleSettingsChange = (field: keyof LabSettings, value: string | number | boolean) => {
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
          updateLabSettings(settings),
          updateLabStudies(studies)
      ]);

      const settingsResult = results[0];
      const studiesResult = results[1];

      if (settingsResult.success && studiesResult.success) {
        toast({
          title: 'Configuración Guardada',
          description: 'La configuración del laboratorio ha sido actualizada. Se requiere un reinicio del servidor para que los cambios se reflejen.',
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
            <Settings /> Configuración de Laboratorio
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

  const groupedStudies = studies.reduce((acc, study) => {
    (acc[study.section] = acc[study.section] || []).push(study);
    return acc;
  }, {} as Record<string, LabStudy[]>);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings /> Configuración de Laboratorio
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
                    <Label htmlFor="lab-slots">Citas por día</Label>
                    <Input
                    id="lab-slots"
                    type="number"
                    value={settings.dailySlots}
                    onChange={(e) => handleSettingsChange('dailySlots', parseInt(e.target.value,10) || 0)}
                    />
                </div>
                <div className='space-y-2'>
                    <Label htmlFor="lab-start">Hora Inicio</Label>
                    <Input
                    id="lab-start"
                    type="time"
                    value={settings.startTime}
                    onChange={(e) => handleSettingsChange('startTime', e.target.value)}
                    />
                </div>
                <div className='space-y-2'>
                    <Label htmlFor="lab-end">Hora Fin</Label>
                    <Input
                    id="lab-end"
                    type="time"
                    value={settings.endTime}
                    onChange={(e) => handleSettingsChange('endTime', e.target.value)}
                    />
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <Switch 
                id="lab-weekend"
                checked={settings.weekendBookingEnabled}
                onCheckedChange={(checked) => handleSettingsChange('weekendBookingEnabled', checked)}
                />
                <Label htmlFor="lab-weekend">Permitir citas en fin de semana</Label>
            </div>
        </div>
         <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><FlaskConical/> Estudios Disponibles</h3>
            <ScrollArea className="h-72 w-full rounded-md border p-4">
              {Object.entries(groupedStudies).map(([section, studiesInSection]) => (
                <div key={section} className="mb-4">
                  <h4 className="font-bold text-md mb-2 sticky top-0 bg-background py-1">{section}</h4>
                  <div className="space-y-2">
                    {studiesInSection.map(study => (
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
                </div>
              ))}
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
          {isSaving ? 'Guardando...' : 'Guardar Configuración de Laboratorio'}
        </Button>
      </CardFooter>
    </Card>
  );
}
