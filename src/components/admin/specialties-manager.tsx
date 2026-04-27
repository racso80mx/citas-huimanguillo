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
import { getSpecialties, updateSpecialties } from '@/lib/actions';
import { Loader2, Plus, Trash2, Save, Tags, CheckCircle2, XCircle } from 'lucide-react';
import type { Specialty } from '@/lib/definitions';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function SpecialtiesManager() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getSpecialties();
      setSpecialties(data);
    } catch (error) {
      console.error('Failed to fetch specialties:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addSpecialty = () => {
    setSpecialties([
      ...specialties,
      { id: uuidv4(), name: '', available: true }
    ]);
  };

  const removeSpecialty = (id: string) => {
    setSpecialties(specialties.filter(s => s.id !== id));
  };

  const updateSpecialtyField = (id: string, field: keyof Specialty, value: any) => {
    setSpecialties(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSave = () => {
    const valid = specialties.filter(s => s.name.trim() !== '');
    if (valid.length === 0) {
      toast({ title: 'Error', description: 'Agregue al menos una especialidad válida.', variant: 'destructive' });
      return;
    }

    startSavingTransition(async () => {
      const result = await updateSpecialties(valid);
      if (result.success) {
        toast({ title: 'Catálogo Actualizado', description: 'Las especialidades y servicios han sido guardados.' });
        fetchData();
      } else {
        toast({ title: 'Error', description: 'No se pudo guardar el catálogo.', variant: 'destructive' });
      }
    });
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Tags /> Catálogo de Especialidades</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-primary/20 bg-primary/5">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-primary"><Tags /> Especialidades y Servicios</CardTitle>
          <CardDescription>
            Administra las áreas de atención del hospital que aparecen en los selectores.
          </CardDescription>
        </div>
        <Button onClick={addSpecialty} variant="outline" className="bg-background">
          <Plus className="mr-2 h-4 w-4" /> Agregar Especialidad
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border rounded-xl overflow-hidden bg-background">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold">Nombre de la Especialidad / Servicio</TableHead>
                <TableHead className="w-[150px] text-center">Disponible</TableHead>
                <TableHead className="w-[100px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {specialties.length > 0 ? specialties.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell>
                    <Input 
                      value={item.name} 
                      onChange={e => updateSpecialtyField(item.id, 'name', e.target.value.toUpperCase())}
                      placeholder="Ej. CARDIOLOGÍA, URGENCIAS, etc."
                      className="h-10 font-bold border-transparent focus:border-primary/30"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <Switch 
                        checked={item.available} 
                        onCheckedChange={v => updateSpecialtyField(item.id, 'available', v)}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeSpecialty(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-20 text-muted-foreground italic">
                    No hay especialidades configuradas. Haz clic en "Agregar Especialidad".
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="pt-6">
        <Button onClick={handleSave} disabled={isSaving} className="w-full h-12 text-lg font-bold">
          {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          {isSaving ? 'Guardando catálogo...' : 'Guardar Catálogo de Especialidades'}
        </Button>
      </CardFooter>
    </Card>
  );
}
