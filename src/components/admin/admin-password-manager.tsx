
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
import { updateAdminSettings, getAdminSettingsData, logActivity } from '@/lib/actions';
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
  
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [pinValue, setPinInput] = useState('');
  
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const settingsData = await getAdminSettingsData();
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
      toast({ title: 'Panel Maestro Desbloqueado' });
    }
  };

  const handleSaveClick = () => {
    if (!settings?.password || settings.password.length < 6) {
        toast({ title: 'Contraseña no válida', description: 'Mínimo 6 caracteres.', variant: 'destructive' });
        return;
    }
    setIsPinDialogOpen(true);
  };

  const handlePinConfirm = () => {
    if (pinValue !== '171208') {
      toast({ title: 'PIN Incorrecto', variant: 'destructive' });
      return;
    }
    setIsPinDialogOpen(false);
    setPinInput('');
    startSavingTransition(async () => {
      const result = await updateAdminSettings(settings!);
      if (result.success) {
        toast({ title: 'Contraseña Actualizada' });
        await logActivity("Seguridad Crítica", "Se actualizó la contraseña de SuperAdmin.");
        setIsUnlocked(false); 
        await fetchData();
      }
    });
  };

  if (isLoading || !settings) return <Card className="p-10 flex justify-center"><Loader2 className="animate-spin h-6 w-6" /></Card>;

  return (
    <>
      <Card className={cn("shadow-lg border-destructive/20 transition-all duration-500", isUnlocked ? "bg-destructive/10 ring-2 ring-destructive/20" : "bg-muted/5 opacity-80")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive cursor-pointer select-none font-black text-sm uppercase" onClick={handleTitleClick}>
            <ShieldAlert className="h-5 w-5" /> PANEL MAESTRO {isUnlocked ? <Unlock className="h-4 w-4 ml-2" /> : <Lock className="h-4 w-4 ml-2 opacity-20" />}
          </CardTitle>
          <CardDescription className="text-[10px]">6 clics en título para desbloquear SuperAdmin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase">Contraseña SuperAdmin</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={isUnlocked ? (settings.password || '') : '************'}
                onChange={(e) => setSettings({ ...settings, password: e.target.value })}
                disabled={!isUnlocked}
                className={cn("h-11 font-bold", !isUnlocked && "bg-muted/50 cursor-not-allowed")}
              />
              {isUnlocked && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>}
            </div>
          </div>
        </CardContent>
        <CardFooter><Button onClick={handleSaveClick} disabled={isSaving || !isUnlocked} variant="destructive" className="w-full font-black uppercase">{isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} GUARDAR MAESTRO</Button></CardFooter>
      </Card>
      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}><DialogContent><DialogHeader><DialogTitle className="text-center text-destructive font-black">PIN DE SEGURIDAD</DialogTitle><DialogDescription className="text-center">Ingresa el PIN maestro para autorizar el cambio.</DialogDescription></DialogHeader><Input type="password" value={pinValue} onChange={e => setPinInput(e.target.value)} className="text-center text-3xl tracking-[0.5em] h-16" maxLength={6} /><DialogFooter><Button onClick={handlePinConfirm} className="w-full bg-destructive">CONFIRMAR CAMBIO</Button></DialogFooter></DialogContent></Dialog>
    </>
  );
}
