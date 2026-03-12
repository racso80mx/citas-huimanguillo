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
import { updateAdminSettings, getAdminSettings, logActivity } from '@/lib/actions';
import { Loader2, Save, KeyRound, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import type { AdminSettings } from '@/lib/definitions';
import { Label } from '../ui/label';

export function AdminPasswordManager() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const settingsData = await getAdminSettings();
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to fetch admin settings:', error);
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
    if (!settings || !settings.password || settings.password.length < 6) {
        toast({
            title: 'Contraseña no válida',
            description: 'La contraseña de SuperAdmin debe tener al menos 6 caracteres.',
            variant: 'destructive'
        });
        return;
    }

    startSavingTransition(async () => {
      const result = await updateAdminSettings(settings);

      if (result.success) {
        toast({
          title: 'Configuración Guardada',
          description: 'La contraseña Maestra (SuperAdmin) ha sido actualizada.',
          className: 'bg-accent text-accent-foreground',
        });
        await logActivity("Cambio de Seguridad", "Se actualizó la contraseña de SuperAdmin.");
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
      <Card className="shadow-lg border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" /> Panel Maestro
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-destructive/20 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="h-5 w-5" /> Panel Maestro
        </CardTitle>
        <CardDescription>
          Contraseña del usuario SuperAdmin (Acceso total).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-password">Contraseña de SuperAdmin</Label>
          <div className="relative">
            <Input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              value={settings.password || ''}
              onChange={(e) => handlePasswordChange(e.target.value)}
              placeholder="Contraseña maestra"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute inset-y-0 right-0 h-full px-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving} variant="destructive" className="w-full">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isSaving ? 'Guardando...' : 'Guardar Maestro'}
        </Button>
      </CardFooter>
    </Card>
  );
}
