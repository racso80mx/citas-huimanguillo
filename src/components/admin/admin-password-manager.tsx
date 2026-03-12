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
import { Loader2, Save, KeyRound, Eye, EyeOff, ShieldAlert, Lock, Unlock } from 'lucide-react';
import type { AdminSettings } from '@/lib/definitions';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function AdminPasswordManager() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  
  // Security states
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [pinValue, setPinInput] = useState('');
  
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

  const handleTitleClick = () => {
    if (isUnlocked) return;
    
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    if (newCount >= 6) {
      setIsUnlocked(true);
      setClickCount(0);
      toast({
        title: 'Panel Desbloqueado',
        description: 'Ahora puedes modificar la contraseña maestra.',
      });
    }
  };

  const handlePasswordChange = (value: string) => {
    if (settings) {
        setSettings({ ...settings, password: value });
    }
  };

  const handleSaveClick = () => {
    if (!settings || !settings.password || settings.password.length < 6) {
        toast({
            title: 'Contraseña no válida',
            description: 'La contraseña de SuperAdmin debe tener al menos 6 caracteres.',
            variant: 'destructive'
        });
        return;
    }
    
    setIsPinDialogOpen(true);
  };

  const handlePinConfirm = () => {
    if (pinValue !== '171208') {
      toast({
        title: 'PIN Incorrecto',
        description: 'El código de autorización no es válido.',
        variant: 'destructive',
      });
      return;
    }

    setIsPinDialogOpen(false);
    setPinInput('');

    startSavingTransition(async () => {
      const result = await updateAdminSettings(settings!);

      if (result.success) {
        toast({
          title: 'Configuración Guardada',
          description: 'La contraseña Maestra (SuperAdmin) ha sido actualizada.',
          className: 'bg-accent text-accent-foreground',
        });
        await logActivity("Cambio de Seguridad", "Se actualizó la contraseña de SuperAdmin mediante PIN.");
        setIsUnlocked(false); // Relock after saving
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
    <>
      <Card className={`shadow-lg border-destructive/20 transition-colors duration-500 ${isUnlocked ? 'bg-destructive/10' : 'bg-destructive/5'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle 
              className="flex items-center gap-2 text-destructive cursor-pointer select-none"
              onClick={handleTitleClick}
            >
              <ShieldAlert className="h-5 w-5" /> Panel Maestro
              {isUnlocked ? <Unlock className="h-4 w-4 ml-2 animate-bounce" /> : <Lock className="h-4 w-4 ml-2 opacity-20" />}
            </CardTitle>
            {isUnlocked && (
              <Button variant="ghost" size="sm" onClick={() => setIsUnlocked(false)} className="text-xs">
                Bloquear
              </Button>
            )}
          </div>
          <CardDescription>
            Contraseña del usuario SuperAdmin (Acceso total). 
            {!isUnlocked && " [Haga 6 clics en el título para desbloquear]"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-password">Contraseña de SuperAdmin</Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={isUnlocked ? (settings.password || '') : '************'}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Contraseña maestra"
                disabled={!isUnlocked}
                className={!isUnlocked ? "bg-muted/50 cursor-not-allowed" : "bg-background"}
              />
              {isUnlocked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute inset-y-0 right-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleSaveClick} 
            disabled={isSaving || !isUnlocked} 
            variant="destructive" 
            className="w-full font-bold"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Guardando...' : 'Guardar Maestro'}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Autorización Requerida</DialogTitle>
            <DialogDescription>
              Para cambiar la contraseña maestra, ingresa el PIN de seguridad de 6 dígitos.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="security-pin">PIN de Seguridad</Label>
            <Input
              id="security-pin"
              type="password"
              placeholder="••••••"
              value={pinValue}
              onChange={(e) => setPinInput(e.target.value)}
              className="text-center text-2xl tracking-[1em]"
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && handlePinConfirm()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsPinDialogOpen(false); setPinInput(''); }}>
              Cancelar
            </Button>
            <Button onClick={handlePinConfirm} disabled={pinValue.length < 6}>
              Validar y Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
