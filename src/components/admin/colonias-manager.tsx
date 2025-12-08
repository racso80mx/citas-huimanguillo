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
import { getColonias, updateColonias } from '@/lib/actions';
import { Loader2, Trash2, PlusCircle, MapPin, Save } from 'lucide-react';
import type { Colonia } from '@/lib/definitions';

const NUCLEOS_BASICOS = Array.from({ length: 8 }, (_, i) => i + 1);

export function ColoniasManager() {
  const [colonias, setColonias] = useState<Colonia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    const fetchColonias = async () => {
      setIsLoading(true);
      const data = await getColonias();
      setColonias(data);
      setIsLoading(false);
    };
    fetchColonias();
  }, []);

  const handleColoniaChange = (id: string, field: 'nombre' | 'nucleo', value: string | number) => {
    setColonias(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const addColonia = () => {
    const newColonia: Colonia = { id: uuidv4(), nombre: '', nucleo: 1 };
    setColonias([...colonias, newColonia]);
  };

  const removeColonia = (id: string) => {
    setColonias(colonias.filter(c => c.id !== id));
  };

  const handleSave = () => {
    const validColonias = colonias.filter(c => c.nombre.trim() !== '');
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
        const data = await getColonias();
        setColonias(data);
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
            <MapPin /> Gestionar Colonias y Asignación de Núcleos
          </CardTitle>
          <CardDescription>
            Añade o elimina colonias y asígnales un núcleo básico.
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
          <MapPin /> Gestionar Colonias y Asignación de Núcleos
        </CardTitle>
        <CardDescription>
          Añade o elimina colonias y asígnales un núcleo básico. Los cambios se reflejarán en la página de reservas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground px-2">
            <span>Nombre de la Colonia</span>
            <span>Núcleo Básico</span>
            <span className='sr-only'>Acciones</span>
        </div>
        {colonias.map((colonia) => (
          <div key={colonia.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2">
            <Input
              value={colonia.nombre}
              onChange={(e) => handleColoniaChange(colonia.id, 'nombre', e.target.value)}
              placeholder="Nombre de la colonia"
            />
            <Select
              value={String(colonia.nucleo)}
              onValueChange={(value) => handleColoniaChange(colonia.id, 'nucleo', parseInt(value, 10))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NUCLEOS_BASICOS.map(n => (
                  <SelectItem key={n} value={String(n)}>
                    Núcleo {n}
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
        <Button onClick={handleSave} disabled={isSaving} className="bg-destructive hover:bg-destructive/90">
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
