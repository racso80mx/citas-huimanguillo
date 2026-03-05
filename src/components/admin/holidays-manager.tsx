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
import { updateHolidays, getHolidays } from '@/lib/actions';
import { Loader2, Trash2, PlusCircle, Calendar as CalendarIcon, Save, X } from 'lucide-react';
import type { Holiday } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '../ui/badge';

export function HolidaysManager() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getHolidays();
      setHolidays(data || []);
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addHoliday = (date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    if (holidays.some(h => h.date === dateStr)) {
        toast({ title: "Fecha duplicada", description: "Este día festivo ya está en la lista.", variant: "destructive" });
        return;
    }
    setHolidays([...holidays, { date: dateStr, name: '' }].sort((a, b) => a.date.localeCompare(b.date)));
  };

  const removeHoliday = (dateStr: string) => {
    setHolidays(holidays.filter(h => h.date !== dateStr));
  };

  const handleNameChange = (dateStr: string, name: string) => {
    setHolidays(holidays.map(h => h.date === dateStr ? { ...h, name } : h));
  };

  const handleSave = () => {
    startSavingTransition(async () => {
      const result = await updateHolidays(holidays);
      if (result.success) {
        toast({
          title: 'Días Festivos Guardados',
          description: 'La configuración ha sido actualizada. Estos días se considerarán como fin de semana para las citas.',
          className: 'bg-accent text-accent-foreground',
        });
        await fetchData();
      } else {
        toast({
          title: 'Error',
          description: 'No se pudieron guardar los días festivos.',
          variant: 'destructive',
        });
      }
    });
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarIcon /> Días Festivos</CardTitle>
          <CardDescription>Cargando configuración...</CardDescription>
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
        <CardTitle className="flex items-center gap-2"><CalendarIcon /> Gestión de Días Festivos</CardTitle>
        <CardDescription>
          Los días festivos agregados aquí se tratarán como fines de semana. Solo los núcleos con "Citas en Fin de Semana" habilitado permitirán agendar en estas fechas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto">
                        <PlusCircle className="mr-2 h-4 w-4" /> Seleccionar Fecha Festiva
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        onSelect={addHoliday}
                        initialFocus
                        locale={es}
                    />
                </PopoverContent>
            </Popover>
        </div>

        <div className="grid gap-4">
            {holidays.length > 0 ? (
                holidays.map((holiday) => (
                    <div key={holiday.date} className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30">
                        <div className="min-w-[140px]">
                            <Badge variant="secondary" className="text-sm font-bold">
                                {format(new Date(holiday.date + 'T12:00:00'), "dd MMM yyyy", { locale: es })}
                            </Badge>
                        </div>
                        <Input
                            placeholder="Nombre del festivo (ej. Navidad)"
                            value={holiday.name}
                            onChange={(e) => handleNameChange(holiday.date, e.target.value)}
                            className="flex-1"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeHoliday(holiday.date)}
                        >
                            <X className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))
            ) : (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    No hay días festivos configurados. Los fines de semana son automáticos.
                </div>
            )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isSaving ? 'Guardando...' : 'Guardar Días Festivos'}
        </Button>
      </CardFooter>
    </Card>
  );
}
