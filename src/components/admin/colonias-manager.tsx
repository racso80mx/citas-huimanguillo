'use client';
import { useState, useEffect, useTransition, useMemo } from 'react';
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
import { getColonias, updateColonias, getClinics } from '@/lib/actions';
import { Loader2, Plus, Trash2, Save, MapPin, Search, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { Colonia, Clinic } from '@/lib/definitions';
import { Label } from '../ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '../ui/scroll-area';

export function ColoniasManager() {
  const [colonias, setColonias] = useState<Colonia[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Colonia | 'clinicName'; direction: 'asc' | 'desc' } | null>(null);
  
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [coloniasData, clinicsData] = await Promise.all([
        getColonias(),
        getClinics(),
      ]);
      setColonias(coloniasData);
      setClinics(clinicsData);
    } catch (error) {
      console.error('Failed to fetch colonias:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addColonia = () => {
    setColonias([
      ...colonias,
      { id: uuidv4(), name: '', clinicId: clinics[0]?.id || '' }
    ]);
  };

  const removeColonia = (id: string) => {
    setColonias(colonias.filter(c => c.id !== id));
  };

  const updateColoniaField = (id: string, field: keyof Colonia, value: string) => {
    setColonias(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSave = () => {
    const valid = colonias.filter(c => c.name.trim() !== '' && c.clinicId !== '');
    startSavingTransition(async () => {
      const result = await updateColonias(valid);
      if (result.success) {
        toast({ title: 'Catálogo de Localidades Guardado' });
        fetchData();
      } else {
        toast({ title: 'Error', description: 'No se pudo guardar el catálogo.', variant: 'destructive' });
      }
    });
  };

  const handleSort = (key: keyof Colonia | 'clinicName') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Colonia | 'clinicName') => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const sortedAndFiltered = useMemo(() => {
    let result = colonias.filter(c => {
        const clinicName = clinics.find(cl => cl.id === c.clinicId)?.name || '';
        return c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
               clinicName.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (sortConfig) {
      result.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === 'clinicName') {
            valA = clinics.find(cl => cl.id === a.clinicId)?.name || '';
            valB = clinics.find(cl => cl.id === b.clinicId)?.name || '';
        } else {
            valA = String((a as any)[sortConfig.key] || '');
            valB = String((b as any)[sortConfig.key] || '');
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [colonias, clinics, searchTerm, sortConfig]);

  if (isLoading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <Card className="shadow-lg border-primary/20 bg-primary/5">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-primary font-black uppercase"><MapPin /> Catálogo de Localidades</CardTitle>
          <CardDescription>Vincula colonias/comunidades a un consultorio para la asignación de citas.</CardDescription>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} className="bg-background"><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={addColonia} variant="default" className="font-bold bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" /> Agregar Localidad</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Filtrar por nombre de localidad o consultorio..." 
                className="pl-9 h-11 bg-background"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="border rounded-2xl overflow-hidden bg-background shadow-inner">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead 
                  className="font-black uppercase text-[10px] cursor-pointer hover:bg-muted"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">Localidad / Colonia {getSortIcon('name')}</div>
                </TableHead>
                <TableHead 
                  className="font-black uppercase text-[10px] cursor-pointer hover:bg-muted"
                  onClick={() => handleSort('clinicName')}
                >
                  <div className="flex items-center">Consultorio Asignado {getSortIcon('clinicName')}</div>
                </TableHead>
                <TableHead className="w-[80px] text-right font-black uppercase text-[10px] pr-6">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndFiltered.length > 0 ? sortedAndFiltered.map((col) => (
                <TableRow key={col.id} className="hover:bg-muted/30 group">
                  <TableCell>
                    <Input 
                      value={col.name} 
                      onChange={e => updateColoniaField(col.id, 'name', e.target.value.toUpperCase())}
                      placeholder="ESCRIBE EL NOMBRE DE LA COMUNIDAD..."
                      className="h-10 font-bold uppercase border-transparent focus:border-primary/20 bg-transparent group-hover:bg-background transition-colors"
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={col.clinicId} onValueChange={v => updateColoniaField(col.id, 'clinicId', v)}>
                        <SelectTrigger className="h-10 font-bold border-transparent focus:ring-0 bg-transparent group-hover:bg-background transition-colors">
                            <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                            {clinics.map(clinic => (
                                <SelectItem key={clinic.id} value={clinic.id}>{clinic.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => removeColonia(col.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-24 text-muted-foreground italic">
                    {searchTerm ? "No hay coincidencias para el filtro." : "No hay localidades configuradas. Haz clic en 'Agregar Localidad'."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter className="pt-6 border-t bg-muted/5">
        <Button onClick={handleSave} disabled={isSaving} className="w-full h-14 text-xl font-black uppercase shadow-xl bg-primary hover:bg-primary/90">
          {isSaving ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Save className="mr-2 h-6 w-6" />}
          {isSaving ? 'Sincronizando...' : 'SINCRONIZAR CATÁLOGO DE LOCALIDADES'}
        </Button>
      </CardFooter>
    </Card>
  );
}
