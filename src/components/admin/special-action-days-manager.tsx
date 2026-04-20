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
import { updateSpecialActionDays, getSpecialActionDays } from '@/lib/actions';
import { Loader2, Trash2, PlusCircle, Calendar as CalendarIcon, Save, X, Settings2 } from 'lucide-react';
import type { SpecialActionDay } from '@/lib/definitions';
import { ClinicType } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function SpecialActionDaysManager() {
  const [items, setItems] = useState<SpecialActionDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newType, setNewType] = useState<ClinicType>(ClinicType.ConsultaExterna);
  const [newName, setNewName] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getSpecialActionDays();
      setItems(data || []);
    } catch (error) {
      console.error('Failed to fetch special action days:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    if (!newDate || !newName.trim()) {
        toast({ title: "Datos incompletos", description: "Selecciona una fecha y escribe el motivo.", variant: "destructive" });
        return;
    }
    const dateStr = format(newDate, 'yyyy-MM-dd');
    if (items.some(h => h.date === dateStr && h.clinicType === newType)) {
        toast({ title: "Bloqueo duplicado", description: "Ya existe un bloqueo para este servicio en esta fecha.", variant: "destructive" });
        return;
    }
    setItems([...items, { date: dateStr, clinicType: newType, name: newName }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewName('');
    setNewDate(undefined);
  };

  const handleRemove = (dateStr: string, type: ClinicType) => {
    setItems(items.filter(h => !(h.date === dateStr && h.clinicType === type)));
  };

  const handleSave = () => {
    startSavingTransition(async () => {
      const result = await updateSpecialActionDays(items);
      if (result.success) {
        toast({
          title: 'Acciones Especiales Guardadas',
          description: 'Los bloqueos por servicio han sido actualizados exitosamente.',
          className: 'bg-accent text-accent-foreground',
        });
        await fetchData();
      } else {
        toast({
          title: 'Error',
          description: 'No se pudieron guardar los cambios.',
          variant: 'destructive',
        });
      }
    });
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 /> Días de Acciones Especiales</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Settings2 /> Gestión de Días por Tipo de Consulta</CardTitle>
        <CardDescription>
          Configura días específicos (mensuales o únicos) donde un servicio completo no dará citas por labores administrativas o informes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid sm:grid-cols-4 gap-4 items-end bg-background p-4 rounded-xl border border-primary/10">
            <div className="space-y-2">
                <Label>Fecha del Evento</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal h-11">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newDate ? format(newDate, 'dd/MM/yyyy') : "Seleccionar..."}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={newDate}
                            onSelect={setNewDate}
                            initialFocus
                            locale={es}
                        />
                    </PopoverContent>
                </Popover>
            </div>
            <div className="space-y-2">
                <Label>Tipo de Consulta</Label>
                <Select value={newType} onValueChange={(v: ClinicType) => setNewType(v)}>
                    <SelectTrigger className="h-11">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.values(ClinicType).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Motivo (Ej. Entrega de Informes)</Label>
                <Input 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                    placeholder="Descripción breve..." 
                    className="h-11"
                />
            </div>
            <Button onClick={handleAdd} className="h-11 bg-primary text-primary-foreground font-bold">
                <PlusCircle className="mr-2 h-4 w-4" /> Agregar Bloqueo
            </Button>
        </div>

        <div className="grid gap-3">
            {items.length > 0 ? (
                items.map((item, idx) => (
                    <div key={`${item.date}-${item.clinicType}-${idx}`} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border bg-background shadow-sm hover:shadow-md transition-shadow">
                        <div className="min-w-[120px]">
                            <Badge variant="secondary" className="text-sm font-bold bg-muted text-muted-foreground px-3 py-1">
                                {format(new Date(item.date + 'T12:00:00'), "dd MMM yyyy", { locale: es })}
                            </Badge>
                        </div>
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                            <Badge className="bg-primary/10 text-primary border-primary/20 font-bold uppercase text-[10px] w-fit">
                                {item.clinicType}
                            </Badge>
                            <span className="text-sm font-medium text-foreground">{item.name}</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(item.date, item.clinicType)}
                            className="self-end sm:self-center"
                        >
                            <X className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))
            ) : (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl bg-background/50">
                    <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    No hay bloqueos específicos configurados.
                </div>
            )}
        </div>
      </CardContent>
      <CardFooter className="bg-primary/5 pt-6 rounded-b-xl border-t border-primary/10">
        <Button onClick={handleSave} disabled={isSaving} className="w-full h-12 text-lg font-bold">
          {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          {isSaving ? 'Guardando cambios...' : 'Confirmar y Guardar Bloqueos'}
        </Button>
      </CardFooter>
    </Card>
  );
}
