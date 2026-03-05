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
import { updatePharmacySettings, getPharmacySettings } from '@/lib/actions';
import { Loader2, Save, KeyRound, Eye, EyeOff, Pill } from 'lucide-react';
import type { PharmacySettings } from '@/lib/definitions';
import { Label } from '../ui/label';

export function PharmacySettingsManager() {
  const [settings, setSettings] = useState<PharmacySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const settingsData = await getPharmacySettings();
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to fetch pharmacy settings:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración de farmacia.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePasswordChange = (value: string) => {
    if (settings) {
        setSettings({ ...settings, password: value });
    }
  };

  const handleSave = () => {
    if (!settings || !settings.password) {
        toast({
            title: 'Contraseña requerida',
            description: 'La contraseña para el módulo de farmacia no puede estar vacía.',
            variant: 'destructive'
        });
        return;
    }

    startSavingTransition(async () => {
      const result = await updatePharmacySettings(settings);

      if (result.success) {
        toast({
          title: 'Configuración Guardada',
          description: 'La contraseña del módulo de farmacia ha sido actualizada.',
          className: 'bg-accent text-accent-foreground',
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
            <Pill className="h-5 w-5" /> Configuración de Farmacia
          </CardTitle>
          <CardDescription>
            Establece la contraseña para acceder al módulo de gestión de inventario.
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
          <Pill className="h-5 w-5" /> Configuración de Farmacia
        </CardTitle>
        <CardDescription>
          Establece la contraseña para acceder al módulo de gestión de inventario.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pharmacy-password">Contraseña de Acceso</Label>
          <div className="relative">
            <Input
              id="pharmacy-password"
              type={showPassword ? 'text' : 'password'}
              value={settings.password || ''}
              onChange={(e) => handlePasswordChange(e.target.value)}
              placeholder="Contraseña para el módulo de farmacia"
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
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isSaving ? 'Guardando...' : 'Guardar Contraseña'}
        </Button>
      </CardFooter>
    </Card>
  );
}
