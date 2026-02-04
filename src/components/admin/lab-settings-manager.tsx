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
import { updateLabSettings, getLabSettings, updateLabStudies, getLabStudies } from '@/lib/actions';
import { Loader2, Save, FlaskConical, CalendarClock, Settings, Eye, EyeOff, PlusCircle, Trash2 } from 'lucide-react';
import type { LabSettings, LabStudy } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';

export function LabSettingsManager() {
  const [settings, setSettings] = useState<LabSettings | null>(null);
  const [studies, setStudies] = useState<LabStudy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
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
  
  const handleStudyChange = (id: string, field: keyof LabStudy, value: string | boolean) => {
    setStudies(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };
  
  const addStudy = () => {
    const newStudy: LabStudy = { id: uuidv4(), name: '', section: 'Nueva Sección', sampleType: '', fastingHours: '', available: true };
    setStudies([...studies, newStudy]);
  };

  const removeStudy = (id: string) => {
    setStudies(studies.filter(s => s.id !== id));
  };


  const handleSave = () => {
    if (!settings) return;

    startSavingTransition(async () => {
      const validStudies = studies.filter(s => s.name.trim() !== '' && s.section.trim() !== '');
       if (validStudies.length !== studies.length) {
          toast({
              title: 'Campos Requeridos',
              description: 'El nombre y la sección del estudio no pueden estar vacíos.',
              variant: 'destructive',
          });
          return;
      }

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

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings /> Configuración de Laboratorio
        </CardTitle>
        <CardDescription>
          Gestiona los horarios y el catálogo de estudios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-6">
            <h3 className="font-semibold text-lg flex items-center gap-2"><CalendarClock/> Citas y Horarios</h3>
            <div className='space-y-2'>
                <Label htmlFor="lab-slots">Citas por día</Label>
                <Input
                id="lab-slots"
                type="number"
                value={settings.dailySlots}
                onChange={(e) => handleSettingsChange('dailySlots', parseInt(e.target.value,10) || 0)}
                />
            </div>
            <div className="flex items-center space-x-2">
                <Switch 
                id="lab-weekend"
                checked={settings.weekendBookingEnabled}
                onCheckedChange={(checked) => handleSettingsChange('weekendBookingEnabled', checked)}
                />
                <Label htmlFor="lab-weekend">Permitir citas en fin de semana</Label>
            </div>
            <div className="space-y-2">
                <Label htmlFor="lab-password">Contraseña para Reportes</Label>
                <div className="relative">
                    <Input
                        id="lab-password"
                        type={showPassword ? 'text' : 'password'}
                        value={settings.password || ''}
                        onChange={(e) => handleSettingsChange('password', e.target.value)}
                        placeholder="Contraseña para reportes de Laboratorio"
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
            <h3 className="font-semibold text-lg flex items-center gap-2"><FlaskConical/> Gestionar Estudios</h3>
            <ScrollArea className="h-72 w-full rounded-md border p-4 space-y-4">
              {studies.map(study => (
                 <div key={study.id} className="p-4 border rounded-lg space-y-4 relative bg-background/50">
                    <Button variant="ghost" size="icon" onClick={() => removeStudy(study.id)} className="absolute top-2 right-2 h-6 w-6"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                     <div className='grid grid-cols-2 gap-4'>
                         <div className='space-y-2'>
                            <Label htmlFor={`lab-name-${study.id}`}>Nombre</Label>
                            <Input id={`lab-name-${study.id}`} value={study.name} onChange={(e) => handleStudyChange(study.id, 'name', e.target.value)} placeholder="Ej. Biometría Hemática"/>
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor={`lab-section-${study.id}`}>Sección</Label>
                            <Input id={`lab-section-${study.id}`} value={study.section} onChange={(e) => handleStudyChange(study.id, 'section', e.target.value)} placeholder="Ej. Hematología"/>
                        </div>
                     </div>
                     <div className='grid grid-cols-2 gap-4'>
                         <div className='space-y-2'>
                            <Label htmlFor={`lab-sample-${study.id}`}>Tipo de Muestra</Label>
                            <Input id={`lab-sample-${study.id}`} value={study.sampleType} onChange={(e) => handleStudyChange(study.id, 'sampleType', e.target.value)} placeholder="Ej. Sangre venosa"/>
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor={`lab-fasting-${study.id}`}>Ayuno</Label>
                            <Input id={`lab-fasting-${study.id}`} value={study.fastingHours} onChange={(e) => handleStudyChange(study.id, 'fastingHours', e.target.value)} placeholder="Ej. 8 horas"/>
                        </div>
                     </div>
                      <div className="flex items-center space-x-2 pt-2">
                        <Switch id={`lab-available-${study.id}`} checked={study.available} onCheckedChange={(checked) => handleStudyChange(study.id, 'available', checked)} />
                        <Label htmlFor={`lab-available-${study.id}`}>Disponible</Label>
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
          {isSaving ? 'Guardando...' : 'Guardar Configuración de Laboratorio'}
        </Button>
      </CardFooter>
    </Card>
  );
}
