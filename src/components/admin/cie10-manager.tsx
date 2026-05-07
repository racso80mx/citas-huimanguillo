'use client';

import { useState, useTransition } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  Loader2, 
  Trash2, 
  FileDown, 
  BookText, 
  Search,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { 
  bulkInsertCie10Glossary, 
  bulkInsertCie10Catalog, 
  deleteAllCie10Glossary, 
  deleteAllCie10Catalog 
} from '@/lib/actions';
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
import { Label } from '../ui/label';

export function Cie10Manager() {
  const [isUploadingGlossary, startGlossaryTransition] = useTransition();
  const [isUploadingCatalog, startCatalogTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [glossaryProgress, setGlossaryProgress] = useState(0);
  const [catalogProgress, setCatalogProgress] = useState(0);
  
  const [glossaryStatus, setGlossaryStatus] = useState('');
  const [catalogStatus, setCatalogStatus] = useState('');

  const { toast } = useToast();

  const handleUploadGlossary = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    startGlossaryTransition(async () => {
      setGlossaryProgress(0);
      setGlossaryStatus('Leyendo glosario...');
      try {
        const xlsx = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer);
        const json = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        if (json.length === 0) {
          toast({ title: 'Archivo vacío', variant: 'destructive' });
          return;
        }

        const total = json.length;
        const CHUNK_SIZE = 200;
        let processed = 0;

        for (let i = 0; i < total; i += CHUNK_SIZE) {
          const chunk = json.slice(i, i + CHUNK_SIZE);
          const res = await bulkInsertCie10Glossary(JSON.parse(JSON.stringify(chunk)));
          if (res.success) {
            processed += res.processedCount || 0;
            setGlossaryProgress(Math.round((processed / total) * 100));
            setGlossaryStatus(`Procesados: ${processed} de ${total}`);
          } else {
            throw new Error(res.message);
          }
        }
        toast({ title: 'Glosario actualizado', description: `Se cargaron ${processed} términos.` });
      } catch (e: any) {
        toast({ title: 'Error al cargar glosario', description: e.message, variant: 'destructive' });
      } finally {
        setGlossaryProgress(0);
        setGlossaryStatus('');
        event.target.value = '';
      }
    });
  };

  const handleUploadCatalog = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    startCatalogTransition(async () => {
      setCatalogProgress(0);
      setCatalogStatus('Leyendo catálogo CIE-10...');
      try {
        const xlsx = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer);
        const json = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        if (json.length === 0) {
          toast({ title: 'Archivo vacío', variant: 'destructive' });
          return;
        }

        const total = json.length;
        const CHUNK_SIZE = 200;
        let processed = 0;

        for (let i = 0; i < total; i += CHUNK_SIZE) {
          const chunk = json.slice(i, i + CHUNK_SIZE);
          const res = await bulkInsertCie10Catalog(JSON.parse(JSON.stringify(chunk)));
          if (res.success) {
            processed += res.processedCount || 0;
            setCatalogProgress(Math.round((processed / total) * 100));
            setCatalogStatus(`Procesados: ${processed} de ${total}`);
          } else {
            throw new Error(res.message);
          }
        }
        toast({ title: 'Catálogo CIE-10 actualizado', description: `Se cargaron ${processed} registros médicos.` });
      } catch (e: any) {
        toast({ title: 'Error al cargar catálogo', description: e.message, variant: 'destructive' });
      } finally {
        setCatalogProgress(0);
        setCatalogStatus('');
        event.target.value = '';
      }
    });
  };

  const handleClearData = async (type: 'glossary' | 'catalog') => {
    setIsDeleting(true);
    try {
        if (type === 'glossary') await deleteAllCie10Glossary();
        else await deleteAllCie10Catalog();
        toast({ title: 'Catálogo vaciado correctamente.' });
    } finally {
        setIsDeleting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* GLOSARIO */}
      <Card className="shadow-lg border-primary/10">
        <CardHeader className="bg-muted/10">
          <CardTitle className="flex items-center gap-2">
            <BookText className="h-5 w-5 text-primary" /> 1. Glosario CIE-10
          </CardTitle>
          <CardDescription>
            Carga el glosario de términos (Campos: Campo, Descripción).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="glossary-file">Seleccionar archivo (CSV/Excel)</Label>
            <Input id="glossary-file" type="file" accept=".csv, .xlsx, .xls" onChange={handleUploadGlossary} disabled={isUploadingGlossary} />
          </div>
          {isUploadingGlossary && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span>{glossaryStatus}</span>
                <span>{glossaryProgress}%</span>
              </div>
              <Progress value={glossaryProgress} className="h-2" />
            </div>
          )}
          <div className="pt-4">
             <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full text-destructive hover:bg-destructive/5 border-destructive/20" disabled={isDeleting}>
                    <Trash2 className="h-4 w-4 mr-2" /> Vaciar Glosario Actual
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Vaciar glosario?</AlertDialogTitle>
                    <AlertDialogDescription>Esta acción eliminará todos los términos del glosario CIE-10 guardados en el sistema.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleClearData('glossary')} className="bg-destructive hover:bg-destructive/90">Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* CATALOGO */}
      <Card className="shadow-lg border-primary/10">
        <CardHeader className="bg-muted/10">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" /> 2. Catálogo CIE-10 (Médico)
          </CardTitle>
          <CardDescription>
            Carga el catálogo maestro con los 76 campos técnicos requeridos.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="catalog-file">Seleccionar archivo maestro</Label>
            <Input id="catalog-file" type="file" accept=".csv, .xlsx, .xls" onChange={handleUploadCatalog} disabled={isUploadingCatalog} />
          </div>
          {isUploadingCatalog && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span>{catalogStatus}</span>
                <span>{catalogProgress}%</span>
              </div>
              <Progress value={catalogProgress} className="h-2" />
            </div>
          )}
           <div className="pt-4">
             <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full text-destructive hover:bg-destructive/5 border-destructive/20" disabled={isDeleting}>
                    <Trash2 className="h-4 w-4 mr-2" /> Vaciar Catálogo CIE-10
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Vaciar catálogo maestro?</AlertDialogTitle>
                    <AlertDialogDescription>Se eliminarán miles de registros médicos. Esta acción es irreversible.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleClearData('catalog')} className="bg-destructive hover:bg-destructive/90">Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 bg-primary/5 border-primary/20">
        <CardContent className="pt-6 flex items-start gap-4">
            <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-2">
                <p className="font-bold text-primary uppercase tracking-wider">Instrucciones de carga:</p>
                <ul className="list-disc pl-4 text-muted-foreground space-y-1">
                    <li>Asegúrate de que los encabezados del archivo coincidan exactamente con los nombres solicitados.</li>
                    <li>Para el catálogo maestro, el sistema procesa registros en bloques de 200 para garantizar la estabilidad.</li>
                    <li>Se recomienda vaciar el catálogo antes de cargar una versión nueva para evitar duplicados.</li>
                </ul>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
