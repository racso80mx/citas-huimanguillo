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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useToast } from '@/hooks/use-toast';
import { getColonias, getClinics, updateColonias } from '@/lib/data';
import { Loader2, Trash2, PlusCircle, MapPin, Save } from 'lucide-react';
import type { Colonia, Clinic } from '@/lib/definitions';

export function ColoniasManager() {
  const [colonias, setColonias] = useState<Colonia[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [coloniasData, clinicsData] = await Promise.all([getColonias(), getClinics()]);
      setColonias(coloniasData);
      setClinics(clinicsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos iniciales. Por favor, recarga la página.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleColoniaChange = (id: string, field: 'name' | 'clinicId', value: string) => {
    setColonias(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const addColonia = () => {
    if (clinics.length === 0) {
        toast({
            title: "Acción requerida",
            description: "Primero debes agregar al menos un núcleo básico.",
            variant: "destructive"
        });
        return;
    }
    const newColonia: Colonia = { id: uuidv4(), name: '', clinicId: clinics[0].id };
    setColonias([...colonias, newColonia]);
  };

  const removeColonia = (id: string) => {
    setColonias(colonias.filter(c => c.id !== id));
  };

  const handleSave = () => {
    const validColonias = colonias.filter(c => c.name.trim() !== '');
    if (validColonias.length !== colonias.length) {
        toast({
            title: 'Campo Requerido',
            description: 'El nombre de la colonia no puede estar vacío.',
            variant: 'destructive',
        });
        return;
    }

    startSavingTransition(async () => {
      const result = await updateColonias(validColonias);
      if (result.success) {
        toast({
          title: 'Configuración Guardada',
          description: 'Las colonias y sus asignaciones han sido actualizadas.',
          className: 'bg-accent text-accent-foreground',
        });
        // Refetch to ensure sync with DB state
        await fetchData();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'No se pudo guardar la configuración.',
          variant: 'destructive',
        });
      }
    });
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin /> Gestionar Colonias y Asignación
          </CardTitle>
          <CardDescription>
            Añade, elimina y asigna colonias a un núcleo básico.
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
          <MapPin /> Gestionar Colonias y Asignación
        </CardTitle>
        <CardDescription>
          Añade o elimina colonias y asígnales un núcleo básico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-h-96 overflow-y-auto p-4">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground px-2">
            <span>Nombre de la Colonia</span>
            <span>Núcleo Básico</span>
            <span className='sr-only'>Acciones</span>
        </div>
        {colonias.map((colonia) => (
          <div key={colonia.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2 p-2 rounded-md bg-background">
            <Input
              value={colonia.name}
              onChange={(e) => handleColoniaChange(colonia.id, 'name', e.target.value)}
              placeholder="Nombre de la colonia"
            />
            <Select
              value={colonia.clinicId}
              onValueChange={(value) => handleColoniaChange(colonia.id, 'clinicId', value)}
              disabled={clinics.length === 0}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Asignar..."/>
              </SelectTrigger>
              <SelectContent>
                {clinics.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeColonia(colonia.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
         <Button
            variant="outline"
            className="w-full"
            onClick={addColonia}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Agregar Colonia
          </Button>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isSaving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </CardFooter>
    </Card>
  );
}
