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
import { Loader2, Save, Settings, ToggleRight, MessageCircle } from 'lucide-center';
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
          Controla qué módulos de citas están disponibles y si el envío por WhatsApp está habilitado.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-4">
        {/* Citas Médicas */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-background border shadow-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor="citas-medicas-enabled" className="flex items-center gap-2 text-base font-bold">
              <ToggleRight className="h-5 w-5 text-primary"/> Citas Médicas
            </Label>
            <div className="flex items-center gap-3 pl-7">
                <Switch 
                    id="citas-medicas-whatsapp"
                    checked={settings.citasMedicasWhatsAppEnabled}
                    onCheckedChange={(v) => handleSettingsChange('citasMedicasWhatsAppEnabled', v)}
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                    <MessageCircle className="h-3 w-3 text-green-600" /> WhatsApp
                </span>
            </div>
          </div>
          <Switch
            id="citas-medicas-enabled"
            checked={settings.citasMedicasEnabled}
            onCheckedChange={(checked) => handleSettingsChange('citasMedicasEnabled', checked)}
          />
        </div>

        {/* Laboratorio */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-background border shadow-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor="laboratorio-enabled" className="flex items-center gap-2 text-base font-bold">
              <ToggleRight className="h-5 w-5 text-primary"/> Laboratorio
            </Label>
            <div className="flex items-center gap-3 pl-7">
                <Switch 
                    id="laboratorio-whatsapp"
                    checked={settings.laboratorioWhatsAppEnabled}
                    onCheckedChange={(v) => handleSettingsChange('laboratorioWhatsAppEnabled', v)}
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                    <MessageCircle className="h-3 w-3 text-green-600" /> WhatsApp
                </span>
            </div>
          </div>
          <Switch
            id="laboratorio-enabled"
            checked={settings.laboratorioEnabled}
            onCheckedChange={(checked) => handleSettingsChange('laboratorioEnabled', checked)}
          />
        </div>

        {/* Rayos X */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-background border shadow-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rayos-x-enabled" className="flex items-center gap-2 text-base font-bold">
              <ToggleRight className="h-5 w-5 text-primary"/> Rayos X
            </Label>
            <div className="flex items-center gap-3 pl-7">
                <Switch 
                    id="rayos-x-whatsapp"
                    checked={settings.rayosXWhatsAppEnabled}
                    onCheckedChange={(v) => handleSettingsChange('rayosXWhatsAppEnabled', v)}
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                    <MessageCircle className="h-3 w-3 text-green-600" /> WhatsApp
                </span>
            </div>
          </div>
          <Switch
            id="rayos-x-enabled"
            checked={settings.rayosXEnabled}
            onCheckedChange={(checked) => handleSettingsChange('rayosXEnabled', checked)}
          />
        </div>

        {/* Ultrasonidos */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-background border shadow-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ultrasonido-enabled" className="flex items-center gap-2 text-base font-bold">
              <ToggleRight className="h-5 w-5 text-primary"/> Ultrasonidos
            </Label>
            <div className="flex items-center gap-3 pl-7">
                <Switch 
                    id="ultrasound-whatsapp"
                    checked={settings.ultrasoundWhatsAppEnabled}
                    onCheckedChange={(v) => handleSettingsChange('ultrasoundWhatsAppEnabled', v)}
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                    <MessageCircle className="h-3 w-3 text-green-600" /> WhatsApp
                </span>
            </div>
          </div>
          <Switch
            id="ultrasonido-enabled"
            checked={settings.ultrasoundEnabled}
            onCheckedChange={(checked) => handleSettingsChange('ultrasoundEnabled', checked)}
          />
        </div>

        {/* Vacunas */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-background border shadow-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor="vacunas-enabled" className="flex items-center gap-2 text-base font-bold">
              <ToggleRight className="h-5 w-5 text-primary"/> Vacunas
            </Label>
            <div className="flex items-center gap-3 pl-7">
                <Switch 
                    id="vacunas-whatsapp"
                    checked={settings.vacunasWhatsAppEnabled}
                    onCheckedChange={(v) => handleSettingsChange('vacunasWhatsAppEnabled', v)}
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                    <MessageCircle className="h-3 w-3 text-green-600" /> WhatsApp
                </span>
            </div>
          </div>
          <Switch
            id="vacunas-enabled"
            checked={settings.vacunasEnabled}
            onCheckedChange={(checked) => handleSettingsChange('vacunasEnabled', checked)}
          />
        </div>

        {/* Módulos de Gestión */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-background border shadow-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor="archivo-enabled" className="flex items-center gap-2 text-base font-bold">
              <ToggleRight className="h-5 w-5 text-primary"/> Archivo (Gestión)
            </Label>
            <div className="flex items-center gap-3 pl-7">
                <Switch 
                    id="archivo-whatsapp"
                    checked={settings.archivoWhatsAppEnabled}
                    onCheckedChange={(v) => handleSettingsChange('archivoWhatsAppEnabled', v)}
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                    <MessageCircle className="h-3 w-3 text-green-600" /> WhatsApp
                </span>
            </div>
          </div>
          <Switch
            id="archivo-enabled"
            checked={settings.archivoEnabled}
            onCheckedChange={(checked) => handleSettingsChange('archivoEnabled', checked)}
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-background border shadow-sm opacity-80">
          <Label htmlFor="archivo-consulta-enabled" className="flex items-center gap-2 text-base font-bold">
            <ToggleRight className="h-5 w-5 text-primary"/> Consulta de Recursos
          </Label>
          <Switch
            id="archivo-consulta-enabled"
            checked={settings.archivoConsultaEnabled}
            onCheckedChange={(checked) => handleSettingsChange('archivoConsultaEnabled', checked)}
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-background border shadow-sm opacity-80">
          <Label htmlFor="farmacia-enabled" className="flex items-center gap-2 text-base font-bold">
            <ToggleRight className="h-5 w-5 text-primary"/> Módulo de Farmacia
          </Label>
          <Switch
            id="farmacia-enabled"
            checked={settings.farmaciaEnabled}
            onCheckedChange={(checked) => handleSettingsChange('farmaciaEnabled', checked)}
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-background border shadow-sm opacity-80">
          <Label htmlFor="almacen-enabled" className="flex items-center gap-2 text-base font-bold">
            <ToggleRight className="h-5 w-5 text-primary"/> Módulo de Almacén
          </Label>
          <Switch
            id="almacen-enabled"
            checked={settings.almacenEnabled}
            onCheckedChange={(checked) => handleSettingsChange('almacenEnabled', checked)}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving} className="w-full h-12 text-lg">
          {isSaving ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Save className="mr-2 h-5 w-5" />
          )}
          {isSaving ? 'Guardando...' : 'Guardar Configuración de Módulos'}
        </Button>
      </CardFooter>
    </Card>
  );
}
