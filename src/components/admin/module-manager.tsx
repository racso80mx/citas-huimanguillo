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
import { useToast } from '@/hooks/use-toast';
import { updateModuleSettings, getModuleSettings } from '@/lib/actions';
import { Loader2, Save, Settings, ToggleRight } from 'lucide-react';
import type { ModuleSettings } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

export function ModuleManager() {
  const [settings, setSettings] = useState<ModuleSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const settingsData = await getModuleSettings();
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to fetch module settings:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración de módulos.',
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

  const handleSettingsChange = (field: keyof ModuleSettings, value: boolean) => {
    if (settings) {
        setSettings({ ...settings, [field]: value });
    }
  };

  const handleSave = () => {
    if (!settings) return;

    startSavingTransition(async () => {
      const result = await updateModuleSettings(settings);

      if (result.success) {
        toast({
          title: 'Configuración Guardada',
          description: 'La configuración de módulos ha sido actualizada. Los cambios se verán reflejados en la navegación y página principal.',
          className: 'bg-accent text-accent-foreground',
          duration: 8000,
        });
        await fetchData();
      } else {
        toast({
          title: 'Error',
          description: result.message ||'No se pudo guardar la configuración.',
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
            <Settings /> Activar/Desactivar Módulos
          </CardTitle>
          <CardDescription>
            Controla qué módulos de citas están disponibles para los usuarios.
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
          <Settings /> Activar/Desactivar Módulos
        </CardTitle>
        <CardDescription>
          Controla qué módulos de citas están disponibles para los usuarios.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-2 rounded-md bg-background">
          <Label htmlFor="citas-medicas-enabled" className="flex items-center gap-2 text-base">
            <ToggleRight className="h-5 w-5"/> Citas Médicas
          </Label>
          <Switch
            id="citas-medicas-enabled"
            checked={settings.citasMedicasEnabled}
            onCheckedChange={(checked) => handleSettingsChange('citasMedicasEnabled', checked)}
          />
        </div>
        <div className="flex items-center justify-between p-2 rounded-md bg-background">
          <Label htmlFor="laboratorio-enabled" className="flex items-center gap-2 text-base">
            <ToggleRight className="h-5 w-5"/> Laboratorio
          </Label>
          <Switch
            id="laboratorio-enabled"
            checked={settings.laboratorioEnabled}
            onCheckedChange={(checked) => handleSettingsChange('laboratorioEnabled', checked)}
          />
        </div>
        <div className="flex items-center justify-between p-2 rounded-md bg-background">
          <Label htmlFor="rayos-x-enabled" className="flex items-center gap-2 text-base">
            <ToggleRight className="h-5 w-5"/> Rayos X
          </Label>
          <Switch
            id="rayos-x-enabled"
            checked={settings.rayosXEnabled}
            onCheckedChange={(checked) => handleSettingsChange('rayosXEnabled', checked)}
          />
        </div>
        <div className="flex items-center justify-between p-2 rounded-md bg-background">
          <Label htmlFor="ultrasonido-enabled" className="flex items-center gap-2 text-base">
            <ToggleRight className="h-5 w-5"/> Ultrasonidos
          </Label>
          <Switch
            id="ultrasonido-enabled"
            checked={settings.ultrasoundEnabled}
            onCheckedChange={(checked) => handleSettingsChange('ultrasoundEnabled', checked)}
          />
        </div>
         <div className="flex items-center justify-between p-2 rounded-md bg-background">
          <Label htmlFor="vacunas-enabled" className="flex items-center gap-2 text-base">
            <ToggleRight className="h-5 w-5"/> Vacunas
          </Label>
          <Switch
            id="vacunas-enabled"
            checked={settings.vacunasEnabled}
            onCheckedChange={(checked) => handleSettingsChange('vacunasEnabled', checked)}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isSaving ? 'Guardando...' : 'Guardar Configuración de Módulos'}
        </Button>
      </CardFooter>
    </Card>
  );
}
