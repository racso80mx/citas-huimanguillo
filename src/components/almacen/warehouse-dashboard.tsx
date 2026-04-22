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
  Package,
  LogOut,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  CalendarClock
} from 'lucide-react';
import { getSupplies, bulkInsertSupplies, deleteAllSupplies } from '@/lib/actions';
import type { Supply } from '@/lib/definitions';
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

export function WarehouseDashboard({ onLogout }: { onLogout?: () => void }) {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, startUploadTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState({ processed: 0, total: 0, message: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Supply; direction: 'asc' | 'desc' } | null>(null);

  const { toast } = useToast();

  const loadSupplies = async () => {
    setIsLoading(true);
    try {
      const data = await getSupplies();
      setSupplies(data);
    } catch (e) {
      toast({ title: 'Error al cargar inventario', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSupplies();
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
          const result = await bulkInsertSupplies(plainChunk);

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

        toast({ title: 'Inventario de almacén actualizado', description: `Se procesaron ${processedCount} registros.` });
        loadSupplies();
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
      const res = await deleteAllSupplies();
      if (res.success) {
        toast({ title: 'Inventario vaciado' });
        loadSupplies();
      }
    });
  };

  const handleSort = (key: keyof Supply) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedSupplies = useMemo(() => {
    let result = [...supplies];

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
  }, [supplies, searchTerm, sortConfig]);

  const stats = useMemo(() => {
    const counts = { red: 0, yellow: 0, green: 0, unknown: 0 };
    supplies.forEach(m => {
        const status = getExpirationStatus(m.fechaCaducidad);
        counts[status]++;
    });
    return counts;
  }, [supplies]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                <Package className="h-8 w-8 text-primary" /> Gestión de Almacén
            </h1>
            <p className="text-muted-foreground">Control de inventario de insumos generales.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadSupplies} disabled={isLoading}>
                <RefreshCw className={isLoading ? "animate-spin" : ""} />
            </Button>
            {onLogout && (
                <Button variant="outline" onClick={onLogout}>
                    <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
                </Button>
            )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5" /> Cargar Insumos</CardTitle>
            <CardDescription>
              Carga masiva de inventario para el departamento de Almacén.
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
                  <Button variant="destructive" size="sm" className="w-full" disabled={isDeleting || supplies.length === 0}>
                    <Trash2 className="h-4 w-4 mr-2" /> Vaciar Inventario de Almacén
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Vaciar todo el inventario de almacén?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción eliminará todos los registros de insumos actuales. No se puede deshacer.
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
            <CardTitle className="flex items-center gap-2 text-lg"><CalendarClock className="h-5 w-5" /> Alertas de Insumos</CardTitle>
            <CardDescription>Estado de los insumos según su fecha de vencimiento.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
                <div className="text-[10px] text-red-600 uppercase font-black mb-1">Cerca ( &lt; 6 meses )</div>
                <div className="text-3xl font-black text-red-700">{stats.red}</div>
                <div className="text-[10px] text-red-500 mt-1 flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3"/> Crítico</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl text-center">
                <div className="text-[10px] text-yellow-600 uppercase font-black mb-1">Medio ( 6m - 1 año )</div>
                <div className="text-3xl font-black text-yellow-700">{stats.yellow}</div>
                <div className="text-[10px] text-yellow-500 mt-1 flex items-center justify-center gap-1"><CalendarClock className="h-3 w-3"/> Preventivo</div>
              </div>
              <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-center">
                <div className="text-[10px] text-green-600 uppercase font-black mb-1">Óptimo ( &gt; 1 año )</div>
                <div className="text-3xl font-black text-green-700">{stats.green}</div>
                <div className="text-[10px] text-green-500 mt-1 flex items-center justify-center gap-1"><CheckCircle2 className="h-3 w-3"/> Seguro</div>
              </div>
              <div className="bg-muted/50 p-4 rounded-xl text-center">
                <div className="text-[10px] text-muted-foreground uppercase font-black mb-1">Total Registros</div>
                <div className="text-3xl font-black">{supplies.length}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Insumos totales</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b bg-muted/10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle>Inventario de Almacén</CardTitle>
                <CardDescription>Mostrando {filteredAndSortedSupplies.length} insumos registrados.</CardDescription>
            </div>
            <div className="relative w-full sm:w-96">
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
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
                  {filteredAndSortedSupplies.length > 0 ? (
                    filteredAndSortedSupplies.slice(0, 300).map((med) => {
                      const expiryStatus = getExpirationStatus(med.fechaCaducidad);
                      return (
                        <TableRow key={med.id} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-[11px] font-bold">{med.claveCuadroBasico}</TableCell>
                          <TableCell className="text-[11px] max-w-xs">{med.descripcion}</TableCell>
                          <TableCell className={`text-right font-black text-sm ${med.existencia <= 0 ? 'text-red-600' : 'text-foreground'}`}>
                            {med.existencia}
                          </TableCell>
                          <TableCell>
                            <Badge 
                                variant="outline"
                                className={cn(
                                    "font-bold text-[10px] px-2 py-0",
                                    expiryStatus === 'red' && "bg-red-100 text-red-700 border-red-200",
                                    expiryStatus === 'yellow' && "bg-yellow-100 text-yellow-700 border-yellow-200",
                                    expiryStatus === 'green' && "bg-green-100 text-green-700 border-green-200",
                                    expiryStatus === 'unknown' && "bg-gray-100 text-gray-600"
                                )}
                            >
                              {med.fechaCaducidad || 'SIN FECHA'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[10px] font-mono">{med.lote}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                        No se encontraron registros en el inventario de almacén.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filteredAndSortedSupplies.length > 300 && (
                <div className="p-4 text-center text-xs text-muted-foreground bg-muted/20 border-t font-medium italic">
                  Mostrando los primeros 300 resultados de {filteredAndSortedSupplies.length}.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
