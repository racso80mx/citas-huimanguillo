'use client';
import { useState, useEffect, useTransition } from 'react';
import { v4 as uuidv4 } from 'uuid';
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
import { updateVaccineSettings, getVaccineSettings, updateVaccines, getVaccines } from '@/lib/actions';
import { Loader2, Save, ShieldPlus, CalendarClock, Settings, Eye, EyeOff, PlusCircle, Trash2, Pencil } from 'lucide-react';
import type { VaccineSettings, Vaccine } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { timeSlots10Min } from '@/lib/time-slots';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

function VaccineEditDialog({ vaccine, onSave, onCancel }: { vaccine: Vaccine, onSave: (vaccine: Vaccine) => void, onCancel: () => void }) {
    const [editedVaccine, setEditedVaccine] = useState<Vaccine>(vaccine);

    useEffect(() => {
        setEditedVaccine(vaccine);
    }, [vaccine]);

    const handleFieldChange = (field: keyof Omit<Vaccine, 'id'>, value: any) => {
        setEditedVaccine(prev => ({...prev, [field]: value}));
    }

    return (
        <DialogContent className="sm:max-w-[50%]">
            <DialogHeader>
                <DialogTitle>Editar Vacuna: {vaccine.name || "Nueva Vacuna"}</DialogTitle>
                <DialogDescription>
                    Modifica los detalles de la vacuna. Los cambios se guardarán cuando presiones "Guardar Configuración de Vacunación".
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4 items-center">
                    <div className='space-y-2'>
                        <Label htmlFor={`vac-name-${editedVaccine.id}`}>Nombre</Label>
                        <Input id={`vac-name-${editedVaccine.id}`} value={editedVaccine.name} onChange={(e) => handleFieldChange('name', e.target.value)} placeholder="Ej. BCG"/>
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                        <Switch id={`vac-available-${editedVaccine.id}`} checked={editedVaccine.available} onCheckedChange={(checked) => handleFieldChange('available', checked)} />
                        <Label htmlFor={`vac-available-${editedVaccine.id}`}>Disponible</Label>
                    </div>
                </div>
                <div className='grid grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                        <Label htmlFor={`vac-age-${editedVaccine.id}`}>Edad de Aplicación</Label>
                        <Input id={`vac-age-${editedVaccine.id}`} value={editedVaccine.applicationAge} onChange={(e) => handleFieldChange('applicationAge', e.target.value)} placeholder="Ej. Al nacer"/>
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`vac-sex-${editedVaccine.id}`}>Sexo</Label>
                        <Input id={`vac-sex-${editedVaccine.id}`} value={editedVaccine.sex} onChange={(e) => handleFieldChange('sex', e.target.value)} placeholder="Ej. Ambos"/>
                    </div>
                </div>
                <div className='space-y-2'>
                    <Label htmlFor={`vac-desc-${editedVaccine.id}`}>Descripción / Protección</Label>
                    <Textarea id={`vac-desc-${editedVaccine.id}`} value={editedVaccine.description} onChange={(e) => handleFieldChange('description', e.target.value)} placeholder="Protege contra..."/>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
                </DialogClose>
                <Button type="button" onClick={() => onSave(editedVaccine)}>Guardar Cambios</Button>
            </DialogFooter>
        </DialogContent>
    );
}

export function VaccineSettingsManager() {
  const [settings, setSettings] = useState<VaccineSettings | null>(null);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVaccine, setSelectedVaccine] = useState<Vaccine | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [settingsData, vaccinesData] = await Promise.all([
        getVaccineSettings(),
        getVaccines()
      ]);
      setSettings(settingsData);
      setVaccines(vaccinesData);
    } catch (error) {
      console.error('Failed to fetch vaccine settings:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración de vacunación.',
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

  const handleSettingsChange = (field: keyof VaccineSettings, value: string | number | boolean) => {
    if (settings) {
        setSettings({ ...settings, [field]: value });
    }
  };

  const handleEditClick = (vaccine: Vaccine) => {
    setSelectedVaccine(vaccine);
    setIsDialogOpen(true);
  }

  const handleAddNewClick = () => {
    const newVaccine: Vaccine = { id: uuidv4(), name: '', applicationAge: '', sex: 'Ambos', description: '', available: true };
    setSelectedVaccine(newVaccine);
    setIsDialogOpen(true);
  }

  const handleDialogSave = (updatedVaccine: Vaccine) => {
    const vaccineExists = vaccines.some(v => v.id === updatedVaccine.id);
    if (vaccineExists) {
        setVaccines(vaccines.map(v => v.id === updatedVaccine.id ? updatedVaccine : v));
    } else {
        setVaccines([...vaccines, updatedVaccine]);
    }
    setIsDialogOpen(false);
    setSelectedVaccine(null);
  }

  const handleDialogCancel = () => {
      setIsDialogOpen(false);
      setSelectedStudy(null);
  }

  const removeVaccine = (id: string) => {
    setVaccines(vaccines.filter(v => v.id !== id));
  };

  const handleSave = () => {
    if (!settings) return;

    startSavingTransition(async () => {
      const validVaccines = vaccines.filter(v => v.name.trim() !== '' && v.description.trim() !== '');
      if (validVaccines.length !== vaccines.length) {
          toast({
              title: 'Campos Requeridos',
              description: 'El nombre y la descripción de la vacuna no pueden estar vacíos.',
              variant: 'destructive',
          });
          return;
      }
      
      const results = await Promise.all([
          updateVaccineSettings(settings),
          updateVaccines(vaccines)
      ]);

      const settingsResult = results[0];
      const vaccinesResult = results[1];

      if (settingsResult.success && vaccinesResult.success) {
        toast({
          title: 'Configuración Guardada',
          description: 'La configuración de vacunación ha sido actualizada. Se requiere un reinicio del servidor para que los cambios se reflejen.',
          className: 'bg-accent text-accent-foreground',
          duration: 8000,
        });
        await fetchData();
      } else {
        toast({
          title: 'Error',
          description: settingsResult.message || vaccinesResult.message ||'No se pudo guardar la configuración.',
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
            <Settings /> Configuración de Vacunación
          </CardTitle>
          <CardDescription>
            Gestiona los horarios y la disponibilidad de las vacunas.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
            <Settings /> Configuración de Vacunación
            </CardTitle>
            <CardDescription>
            Gestiona los horarios, la disponibilidad y el catálogo de vacunas.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
            <div className="space-y-6">
                <h3 className="font-semibold text-lg flex items-center gap-2"><CalendarClock/> Citas y Horarios</h3>
                <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                    <div className='space-y-2'>
                        <Label htmlFor="vaccine-slots">Citas por día</Label>
                        <Input
                        id="vaccine-slots"
                        type="number"
                        value={settings.dailySlots}
                        onChange={(e) => handleSettingsChange('dailySlots', parseInt(e.target.value,10) || 0)}
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor="vaccine-waitlist">Citas Lista de Espera</Label>
                        <Input
                        id="vaccine-waitlist"
                        type="number"
                        value={settings.waitlistSlots || 0}
                        onChange={(e) => handleSettingsChange('waitlistSlots', parseInt(e.target.value,10) || 0)}
                        placeholder="Ej. 5"
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor="vaccine-start">Hora Inicio</Label>
                        <Select value={settings.startTime} onValueChange={(value) => handleSettingsChange('startTime', value)}>
                            <SelectTrigger id="vaccine-start"><SelectValue /></SelectTrigger>
                            <SelectContent>{timeSlots10Min.map(slot => <SelectItem key={`start-${slot.value}`} value={slot.value}>{slot.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor="vaccine-end">Hora Fin</Label>
                        <Select value={settings.endTime} onValueChange={(value) => handleSettingsChange('endTime', value)}>
                            <SelectTrigger id="vaccine-end"><SelectValue /></SelectTrigger>
                            <SelectContent>{timeSlots10Min.map(slot => <SelectItem key={`end-${slot.value}`} value={slot.value}>{slot.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch 
                    id="vaccine-weekend"
                    checked={settings.weekendBookingEnabled}
                    onCheckedChange={(checked) => handleSettingsChange('weekendBookingEnabled', checked)}
                    />
                    <Label htmlFor="vaccine-weekend">Permitir citas en fin de semana</Label>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="vaccine-password">Contraseña para Reportes</Label>
                    <div className="relative">
                        <Input
                            id="vaccine-password"
                            type={showPassword ? 'text' : 'password'}
                            value={settings.password || ''}
                            onChange={(e) => handleSettingsChange('password', e.target.value)}
                            placeholder="Contraseña para reportes de Vacunación"
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
            </div>
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg flex items-center gap-2"><ShieldPlus/> Gestionar Vacunas</h3>
                    <Button onClick={handleAddNewClick}><PlusCircle className="mr-2 h-4 w-4" />Agregar Vacuna</Button>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre de la Vacuna</TableHead>
                            <TableHead>Edad Aplicación</TableHead>
                            <TableHead>Disponible</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {vaccines.map(vaccine => (
                            <TableRow key={vaccine.id}>
                                <TableCell className="font-medium">{vaccine.name}</TableCell>
                                <TableCell>{vaccine.applicationAge}</TableCell>
                                <TableCell>{vaccine.available ? 'Sí' : 'No'}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(vaccine)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => removeVaccine(vaccine.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {vaccines.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                        No hay vacunas definidas. Agrega una para comenzar.
                    </div>
                )}
            </div>
        </CardContent>
        <CardFooter>
            <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? 'Guardando...' : 'Guardar Configuración de Vacunación'}
            </Button>
        </CardFooter>
        </Card>
        {selectedVaccine && (
            <VaccineEditDialog
                vaccine={selectedVaccine}
                onSave={handleDialogSave}
                onCancel={handleDialogCancel}
            />
        )}
    </Dialog>
  );
}
