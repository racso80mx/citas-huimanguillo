'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Upload, 
  Loader2, 
  Search, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Pill,
  AlertTriangle,
  CheckCircle2,
  CalendarClock
} from 'lucide-react';
import { getMedications, bulkInsertMedications, deleteAllMedications } from '@/lib/actions';
import type { Medication } from '@/lib/definitions';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { differenceInMonths, parse, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

type ExpirationStatus = 'red' | 'yellow' | 'green' | 'unknown';

export function PharmacyManager() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, startUploadTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState({ processed: 0, total: 0, message: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Medication; direction: 'asc' | 'desc' } | null>(null);

  const { toast } = useToast();

  const loadMedications = async () => {
    setIsLoading(true);
    try {
      const data = await getMedications();
      setMedications(data);
    } catch (e) {
      toast({ title: 'Error al cargar inventario', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedications();
  }, []);

  const getExpirationStatus = (dateStr: string): ExpirationStatus => {
    if (!dateStr) return 'unknown';
    
    let expiryDate: Date;
    if (dateStr.includes('/')) {
        expiryDate = parse(dateStr, 'dd/MM/yyyy', new Date());
    } else {
        expiryDate = new Date(dateStr);
    }

    if (!isValid(expiryDate)) return 'unknown';

    const monthsUntilExpiry = differenceInMonths(expiryDate, new Date());

    if (monthsUntilExpiry < 6) return 'red';
    if (monthsUntilExpiry >= 6 && monthsUntilExpiry < 12) return 'yellow';
    return 'green';
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    startUploadTransition(async () => {
      setProgress(0);
      setUploadStatus({ processed: 0, total: 0, message: 'Leyendo archivo...' });

      try {
        const xlsx = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = xlsx.utils.sheet_to_json(sheet);

        if (json.length === 0) {
          toast({ title: 'El archivo está vacío', variant: 'destructive' });
          return;
        }

        const totalRecords = json.length;
        setUploadStatus({ processed: 0, total: totalRecords, message: 'Iniciando carga...' });

        const CHUNK_SIZE = 300;
        let processedCount = 0;

        for (let i = 0; i < totalRecords; i += CHUNK_SIZE) {
          const chunk = json.slice(i, i + CHUNK_SIZE);
          const plainChunk = JSON.parse(JSON.stringify(chunk));
          const result = await bulkInsertMedications(plainChunk);

          if (result.success) {
            processedCount += result.processedCount || 0;
            const currentProgress = Math.round((processedCount / totalRecords) * 100);
            setProgress(currentProgress);
            setUploadStatus({ 
              processed: processedCount, 
              total: totalRecords, 
              message: `Cargando: ${processedCount} de ${totalRecords} registros...` 
            });
          } else {
            toast({ title: 'Error durante la carga', description: result.message, variant: 'destructive' });
            return;
          }
        }

        toast({ title: 'Inventario actualizado con éxito', description: `Se procesaron ${processedCount} registros.` });
        loadMedications();
      } catch (error: any) {
        toast({ title: 'Error al procesar Excel', description: error.message, variant: 'destructive' });
      } finally {
        setUploadStatus({ processed: 0, total: 0, message: '' });
        setProgress(0);
        event.target.value = '';
      }
    });
  };

  const handleDeleteAll = () => {
    startDeleteTransition(async () => {
      const res = await deleteAllMedications();
      if (res.success) {
        toast({ title: 'Inventario vaciado' });
        loadMedications();
      }
    });
  };

  const handleSort = (key: keyof Medication) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedMedications = useMemo(() => {
    let result = [...medications];

    if (searchTerm) {
      const term = searchTerm.toUpperCase();
      result = result.filter(m => 
        m.descripcion.includes(term) || m.claveCuadroBasico.includes(term)
      );
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA === valB) return 0;
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        return sortConfig.direction === 'asc' 
          ? (valA < valB ? -1 : 1) 
          : (valA > valB ? -1 : 1);
      });
    }

    return result;
  }, [medications, searchTerm, sortConfig]);

  const stats = useMemo(() => {
    const counts = { red: 0, yellow: 0, green: 0, unknown: 0 };
    medications.forEach(m => {
        const status = getExpirationStatus(m.fechaCaducidad);
        counts[status]++;
    });
    return counts;
  }, [medications]);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Cargar Inventario</CardTitle>
            <CardDescription>
              Cada línea de Excel se trata como un registro único.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleFileUpload} 
                disabled={isUploading}
              />
            </div>
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span>{uploadStatus.message}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
            <div className="flex gap-2 pt-2">
               <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full" disabled={isDeleting || medications.length === 0}>
                    <Trash2 className="h-4 w-4 mr-2" /> Vaciar Inventario
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Vaciar todo el inventario?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminarán todos los registros. No se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">
                      Sí, vaciar todo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><CalendarClock className="h-5 w-5" /> Alertas de Caducidad</CardTitle>
            <CardDescription>Estado de los insumos según su fecha de vencimiento.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
                <div className="text-[10px] text-red-600 uppercase font-black mb-1">Rojo ( &lt; 6 meses )</div>
                <div className="text-3xl font-black text-red-700">{stats.red}</div>
                <div className="text-[10px] text-red-500 mt-1 flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3"/> Crítico</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl text-center">
                <div className="text-[10px] text-yellow-600 uppercase font-black mb-1">Amarillo ( 6m - 1 año )</div>
                <div className="text-3xl font-black text-yellow-700">{stats.yellow}</div>
                <div className="text-[10px] text-yellow-500 mt-1 flex items-center justify-center gap-1"><CalendarClock className="h-3 w-3"/> Preventivo</div>
              </div>
              <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-center">
                <div className="text-[10px] text-green-600 uppercase font-black mb-1">Verde ( &gt; 1 año )</div>
                <div className="text-3xl font-black text-green-700">{stats.green}</div>
                <div className="text-[10px] text-green-500 mt-1 flex items-center justify-center gap-1"><CheckCircle2 className="h-3 w-3"/> Óptimo</div>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl text-center">
                <div className="text-[10px] text-muted-foreground uppercase font-black mb-1">Total Insumos</div>
                <div className="text-3xl font-black">{medications.length}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Registros únicos</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Listado de Medicamentos</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por Clave, Descripción o Lote..." 
                className="pl-9 h-11"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead onClick={() => handleSort('claveCuadroBasico')} className="cursor-pointer hover:bg-accent whitespace-nowrap">
                      Clave {sortConfig?.key === 'claveCuadroBasico' && (sortConfig.direction === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
                    </TableHead>
                    <TableHead onClick={() => handleSort('descripcion')} className="cursor-pointer hover:bg-accent">
                      Descripción {sortConfig?.key === 'descripcion' && (sortConfig.direction === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
                    </TableHead>
                    <TableHead onClick={() => handleSort('existencia')} className="cursor-pointer hover:bg-accent text-right">
                      Stock {sortConfig?.key === 'existencia' && (sortConfig.direction === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
                    </TableHead>
                    <TableHead onClick={() => handleSort('fechaCaducidad')} className="cursor-pointer hover:bg-accent">
                      Caducidad {sortConfig?.key === 'fechaCaducidad' && (sortConfig.direction === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
                    </TableHead>
                    <TableHead>Lote</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedMedications.length > 0 ? (
                    filteredAndSortedMedications.slice(0, 300).map((med) => {
                      const expiryStatus = getExpirationStatus(med.fechaCaducidad);
                      return (
                        <TableRow key={med.id}>
                          <TableCell className="font-mono text-xs">{med.claveCuadroBasico}</TableCell>
                          <TableCell className="text-[11px] font-medium max-w-xs">{med.descripcion}</TableCell>
                          <TableCell className={`text-right font-black ${med.existencia <= 5 ? 'text-red-600' : 'text-foreground'}`}>
                            {med.existencia}
                          </TableCell>
                          <TableCell>
                            <Badge 
                                variant="outline"
                                className={cn(
                                    "font-bold text-[10px] px-2",
                                    expiryStatus === 'red' && "bg-red-100 text-red-700 border-red-200",
                                    expiryStatus === 'yellow' && "bg-yellow-100 text-yellow-700 border-yellow-200",
                                    expiryStatus === 'green' && "bg-green-100 text-green-700 border-green-200"
                                )}
                            >
                              {med.fechaCaducidad || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[10px] font-mono">{med.lote}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                        No se encontraron medicamentos.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filteredAndSortedMedications.length > 300 && (
                <div className="p-4 text-center text-xs text-muted-foreground border-t italic">
                  Mostrando primeros 300 de {filteredAndSortedMedications.length}. Use el buscador para filtrar.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
