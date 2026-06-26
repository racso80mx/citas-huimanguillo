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
import { Loader2, Save, Eye, EyeOff, ShieldAlert, Lock, Unlock } from 'lucide-react';
import type { AdminSettings } from '@/lib/definitions';
import { Label } from '../ui/label';
import { cn } from '@/lib/utils';
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
        title: 'Panel Maestro Desbloqueado',
        description: 'Ahora puedes modificar la contraseña de SuperAdmin.',
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
            description: 'La contraseña maestra debe tener al menos 6 caracteres.',
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
          title: 'Contraseña Maestra Actualizada',
          description: 'Se ha guardado la nueva clave de SuperAdmin.',
          className: 'bg-primary text-primary-foreground',
        });
        await logActivity("Seguridad Crítica", "Se actualizó la contraseña de SuperAdmin mediante PIN.");
        setIsUnlocked(false); 
        await fetchData();
      } else {
        toast({
          title: 'Error',
          description: result.message ||'No se pudo actualizar.',
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
      <Card className={cn(
        "shadow-lg border-destructive/20 transition-all duration-500",
        isUnlocked ? "bg-destructive/10 ring-2 ring-destructive/20" : "bg-muted/5 opacity-80"
      )}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle 
              className="flex items-center gap-2 text-destructive cursor-pointer select-none font-black uppercase tracking-widest text-sm"
              onClick={handleTitleClick}
            >
              <ShieldAlert className="h-5 w-5" /> PANEL MAESTRO
              {isUnlocked ? <Unlock className="h-4 w-4 ml-2 animate-bounce" /> : <Lock className="h-4 w-4 ml-2 opacity-20" />}
            </CardTitle>
            {isUnlocked && (
              <Button variant="ghost" size="sm" onClick={() => setIsUnlocked(false)} className="text-[10px] font-bold h-6">
                BLOQUEAR
              </Button>
            )}
          </div>
          <CardDescription className="text-xs font-medium">
            {isUnlocked ? "Estás editando el acceso total." : "Haz clic 6 veces en el título para habilitar edición."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-password" className="text-[10px] font-black uppercase">Contraseña SuperAdmin</Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={isUnlocked ? (settings.password || '') : '************'}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Contraseña Maestra"
                disabled={!isUnlocked}
                className={cn(
                    "h-11 font-bold",
                    !isUnlocked ? "bg-muted/50 cursor-not-allowed" : "bg-background border-destructive/40"
                )}
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
            className="w-full font-black uppercase"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Guardando...' : 'Actualizar Maestro'}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black text-center text-destructive">AUTORIZACIÓN REQUERIDA</DialogTitle>
            <DialogDescription className="text-center">
              Ingresa el PIN de seguridad de 6 dígitos para confirmar el cambio de la clave maestra.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Input
              type="password"
              placeholder="••••••"
              value={pinValue}
              onChange={(e) => setPinInput(e.target.value)}
              className="text-center text-3xl font-black tracking-[0.5em] h-16 border-primary/40"
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && handlePinConfirm()}
              autoFocus
            />
          </div>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" onClick={() => { setIsPinDialogOpen(false); setPinInput(''); }}>
              Cancelar
            </Button>
            <Button onClick={handlePinConfirm} disabled={pinValue.length < 6} className="bg-destructive hover:bg-destructive/90 font-bold px-8">
              Confirmar Cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
