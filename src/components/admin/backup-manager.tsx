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
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().split('T')[0];
        a.download = `respaldo_citas_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: 'Respaldo Descargado',
          description: 'El archivo de respaldo ha sido generado y descargado.',
        });
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
            const { stats } = result;
            const totalAdded = (stats.patients.added || 0) + (stats.appointments.added || 0) + (stats.labAppointments.added || 0) + (stats.xRayAppointments.added || 0) + (stats.ultrasoundAppointments.added || 0) + (stats.vaccineAppointments.added || 0);
            const totalUpdated = (stats.patients.updated || 0) + (stats.appointments.updated || 0) + (stats.labAppointments.updated || 0) + (stats.xRayAppointments.updated || 0) + (stats.ultrasoundAppointments.updated || 0) + (stats.vaccineAppointments.updated || 0);

            toast({
              title: 'Respaldo Restaurado',
              description: `Se agregaron ${totalAdded} registros y se actualizaron ${totalUpdated}.`,
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
                  description: `Se eliminaron ${result.deletedCount || 0} registros antiguos. La página se recargará.`,
                  duration: 5000,
              });
              window.location.reload();
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
          Realiza respaldos de seguridad, restaura datos y limpia registros antiguos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-3 gap-4">
        <Button onClick={handleDownload} disabled={isDownloading} variant="outline">
          {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Descargar Respaldo
        </Button>
        <Button onClick={handleRestoreClick} disabled={isRestoring} variant="outline">
          {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Cargar Respaldo
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
