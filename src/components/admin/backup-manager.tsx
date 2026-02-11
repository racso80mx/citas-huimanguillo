'use client';
import { useState, useTransition, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { downloadBackupAction, restoreBackupAction, cleanupOldRecordsAction } from '@/lib/actions';
import { Loader2, Download, Upload, Trash } from 'lucide-react';
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
import * as xlsx from 'xlsx';

export function BackupManager({ onRestoreSuccess }: { onRestoreSuccess?: () => void }) {
  const [isDownloading, startDownloadTransition] = useTransition();
  const [isRestoring, startRestoreTransition] = useTransition();
  const [isCleaning, startCleanTransition] = useTransition();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = () => {
    startDownloadTransition(async () => {
      const result = await downloadBackupAction();
      if (result.success && result.data) {
        try {
            const workbook = xlsx.utils.book_new();
            for (const sheetName in result.data) {
                if (Object.prototype.hasOwnProperty.call(result.data, sheetName) && Array.isArray(result.data[sheetName]) && result.data[sheetName].length > 0) {
                    const dataForSheet = result.data[sheetName].map((item: any) => {
                        const newItem = {...item};
                        if (newItem.studies && Array.isArray(newItem.studies)) {
                            newItem.studies = newItem.studies.map((s: any) => s.name).join(', ');
                        }
                        if (newItem.vaccines && Array.isArray(newItem.vaccines)) {
                            newItem.vaccines = newItem.vaccines.map((v: any) => v.name).join(', ');
                        }
                        return newItem;
                    });
                    const worksheet = xlsx.utils.json_to_sheet(dataForSheet);
                    xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
                }
            }
            const date = new Date().toISOString().split('T')[0];
            xlsx.writeFile(workbook, `respaldo_citas_${date}.xlsx`);

            toast({
              title: 'Respaldo Descargado',
              description: 'El archivo de respaldo ha sido generado en formato Excel.',
            });
        } catch (excelError: any) {
             toast({
              title: 'Error al generar Excel',
              description: excelError.message || 'No se pudo crear el archivo Excel.',
              variant: 'destructive',
            });
        }
      } else {
        toast({
          title: 'Error',
          description: result.message || 'No se pudo generar el respaldo.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        startRestoreTransition(async () => {
          const result = await restoreBackupAction(content);
           if (result.success && result.stats) {
            const totalAdded = Object.values(result.stats.added).reduce((acc: number, count: any) => acc + count, 0);
            toast({
              title: 'Respaldo Restaurado con Éxito',
              description: `Se agregaron ${totalAdded} nuevos registros. Los registros existentes no fueron modificados.`,
              duration: 8000,
            });
            onRestoreSuccess?.();
          } else {
            toast({
              title: 'Error al Restaurar',
              description: result.message || 'El archivo de respaldo parece ser inválido o está corrupto.',
              variant: 'destructive',
            });
          }
        });
      }
    };
    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
  };
  
  const handleCleanup = () => {
      startCleanTransition(async () => {
          const result = await cleanupOldRecordsAction();
          if (result.success) {
              toast({
                  title: 'Limpieza Completada',
                  description: `Se eliminaron ${result.deletedCount || 0} registros antiguos.`,
                  duration: 5000,
              });
              onRestoreSuccess?.();
          } else {
              toast({
                title: 'Error en la Limpieza',
                description: result.message || 'No se pudieron eliminar los registros.',
                variant: 'destructive',
              });
          }
      });
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>Gestión de Datos</CardTitle>
        <CardDescription>
          Realiza respaldos de seguridad, restaura datos y limpia registros antiguos. El archivo de respaldo para restaurar debe estar en formato JSON.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-3 gap-4">
        <Button onClick={handleDownload} disabled={isDownloading} variant="outline">
          {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Descargar Respaldo (Excel)
        </Button>
        <Button onClick={handleRestoreClick} disabled={isRestoring} variant="outline">
          {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Cargar Respaldo (JSON)
        </Button>
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="application/json"
            className="hidden"
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isCleaning}>
                {isCleaning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash className="mr-2 h-4 w-4" />}
                Limpiar Registros Antiguos
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción es irreversible. Se eliminarán todas las citas del mes pasado hacia atrás.
                Se recomienda descargar un respaldo antes de proceder.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCleanup}
                className='bg-destructive hover:bg-destructive/90'
              >
                Sí, eliminar registros
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
