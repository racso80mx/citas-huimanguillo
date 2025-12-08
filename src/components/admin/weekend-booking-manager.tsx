'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { updateWeekendBooking } from '@/lib/actions';
import { getWeekendBookingConfig } from '@/lib/data';
import { Loader2, CalendarX, CalendarCheck } from 'lucide-react';
import type { WeekendBookingConfig } from '@/lib/definitions';

export function WeekendBookingManager() {
  const [config, setConfig] = useState<WeekendBookingConfig>({ enabled: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoading(true);
      const data = await getWeekendBookingConfig();
      setConfig(data);
      setIsLoading(false);
    };
    fetchConfig();
  }, []);

  const handleToggle = (enabled: boolean) => {
    const newConfig = { enabled };
    setConfig(newConfig);
    startSavingTransition(async () => {
      const result = await updateWeekendBooking(newConfig);
      if (result.success) {
        toast({
          title: 'Configuración Guardada',
          description: `Las citas en fin de semana han sido ${enabled ? 'habilitadas' : 'deshabilitadas'}.`,
          className: 'bg-accent text-accent-foreground',
        });
      } else {
        toast({
          title: 'Error',
          description: result.message || 'No se pudo guardar la configuración.',
          variant: 'destructive',
        });
        // Revert UI on failure
        setConfig({ enabled: !enabled });
      }
    });
  };
  

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Disponibilidad de Fin de Semana</CardTitle>
          <CardDescription>
            Habilita o deshabilita las citas en sábado y domingo.
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
        <CardTitle className='flex items-center gap-2'>
            {config.enabled ? <CalendarCheck /> : <CalendarX />}
            Disponibilidad de Fin de Semana
        </CardTitle>
        <CardDescription>
          Habilita o deshabilita las citas en sábado y domingo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4 rounded-md border p-4">
            <div className="flex-1 space-y-1">
                <Label htmlFor="weekend-mode" className="text-base">
                Permitir Citas en Fin de Semana
                </Label>
                <p className="text-sm text-muted-foreground">
                Las citas en fin de semana están {config.enabled ? 'activadas' : 'desactivadas'}.
                </p>
            </div>
            <Switch
                id="weekend-mode"
                checked={config.enabled}
                onCheckedChange={handleToggle}
                disabled={isSaving}
                aria-label="Permitir citas en fin de semana"
            />
             {isSaving && <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
      </CardContent>
    </Card>
  );
}
