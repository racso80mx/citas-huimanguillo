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
  LogOut,
  RefreshCw
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

export function PharmacyDashboard({ onLogout }: { onLogout?: () => void }) {
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
          const result = await bulkInsertMedications(chunk);

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
        event.target.value = ''; // Reset file input
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                <Pill className="h-8 w-8 text-primary" /> Gestión de Farmacia
            </h1>
            <p className="text-muted-foreground">Actualiza el inventario mediante la carga masiva de Excel.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadMedications} disabled={isLoading}>
                <RefreshCw className={isLoading ? "animate-spin" : ""} />
            </Button>
            {onLogout && (
                <Button variant="outline" onClick={onLogout}>
                    <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
                </Button>
            )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Cargar Inventario</CardTitle>
            <CardDescription>
              Sube el archivo Excel con las 15 columnas del sistema de farmacia.
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
              {isUploading && <Loader2 className="h-5 w-5 animate-spin" />}
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
                  <Button variant="destructive" size="sm" disabled={isDeleting || medications.length === 0}>
                    <Trash2 className="h-4 w-4 mr-2" /> Vaciar Inventario
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Vaciar todo el inventario?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción eliminará todos los registros actuales de medicamentos. No se puede deshacer.
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5" /> Estadísticas</CardTitle>
            <CardDescription>Resumen del inventario actual.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-xs text-muted-foreground uppercase font-bold">Total Insumos</div>
                <div className="text-2xl font-bold">{medications.length}</div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-xs text-muted-foreground uppercase font-bold">Sin Stock</div>
                <div className="text-2xl font-bold text-destructive">
                  {medications.filter(m => m.existencia <= 0).length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Listado de Medicamentos</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por Clave o Descripción..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead onClick={() => handleSort('claveCuadroBasico')} className="cursor-pointer hover:bg-accent">
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
                    filteredAndSortedMedications.slice(0, 100).map((med) => (
                      <TableRow key={med.id}>
                        <TableCell className="font-mono text-xs">{med.claveCuadroBasico}</TableCell>
                        <TableCell className="text-xs font-medium">{med.descripcion}</TableCell>
                        <TableCell className={`text-right font-bold ${med.existencia <= 5 ? 'text-destructive' : 'text-green-600'}`}>
                          {med.existencia}
                        </TableCell>
                        <TableCell className="text-xs">{med.fechaCaducidad}</TableCell>
                        <TableCell className="text-xs">{med.lote}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        No se encontraron medicamentos.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filteredAndSortedMedications.length > 100 && (
                <div className="p-2 text-center text-xs text-muted-foreground border-t">
                  Mostrando primeros 100 resultados de {filteredAndSortedMedications.length}. Utiliza el buscador para filtrar.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
