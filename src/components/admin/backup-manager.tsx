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

            const createSheet = (sheetName: string, data: any[], headers: string[]) => {
                if (!data || data.length === 0) return;
                const worksheet = xlsx.utils.json_to_sheet(data, { header: headers });
                xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
            };

            createSheet('Citas Médicas', result.data.appointments, ['appointmentNumber', 'date', 'time', 'status', 'patient.name', 'patient.curp', 'patient.phoneNumber', 'clinicName', 'patientType']);
            createSheet('Laboratorio', result.data.labAppointments, ['appointmentNumber', 'date', 'time', 'status', 'patient.name', 'patient.curp', 'patient.phoneNumber', 'studies']);
            createSheet('Rayos X', result.data.xRayAppointments, ['appointmentNumber', 'date', 'time', 'status', 'patient.name', 'patient.curp', 'patient.phoneNumber', 'studyName']);
            createSheet('Ultrasonidos', result.data.ultrasoundAppointments, ['appointmentNumber', 'date', 'time', 'status', 'patient.name', 'patient.curp', 'patient.phoneNumber', 'studyName']);
            createSheet('Vacunación', result.data.vaccineAppointments, ['appointmentNumber', 'date', 'time', 'status', 'patient.name', 'patient.curp', 'patient.phoneNumber', 'vaccines', 'isNewborn']);
            createSheet('Pacientes', result.data.patients, ['curp', 'name', 'paternalLastName', 'maternalLastName', 'phoneNumber']);
            createSheet('Clinicas', result.data.clinics, ['id', 'name', 'doctorName']);
            
            const date = new Date().toISOString().split('T')[0];
            xlsx.writeFile(workbook, `respaldo_completo_${date}.xlsx`);

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
        const data = e.target?.result;
        if (typeof data !== 'string') return;
        
        startRestoreTransition(async () => {
            try {
                const workbook = xlsx.read(data, {type: 'binary'});
                const backupData: any = {};
                
                // Helper to parse sheets
                const parseSheet = (sheetName: string, keys: string[]) => {
                    const sheet = workbook.Sheets[sheetName];
                    if (sheet) {
                        return xlsx.utils.sheet_to_json(sheet, {
                           header: keys,
                           range: 1 // Skip header row
                        });
                    }
                    return [];
                };

                backupData.appointments = parseSheet('Citas Médicas', ['appointmentNumber', 'date', 'time', 'status', 'patient.name', 'patient.curp', 'patient.phoneNumber', 'clinicName', 'patientType']);
                backupData.labAppointments = parseSheet('Laboratorio', ['appointmentNumber', 'date', 'time', 'status', 'patient.name', 'patient.curp', 'patient.phoneNumber', 'studies']);
                backupData.xRayAppointments = parseSheet('Rayos X', ['appointmentNumber', 'date', 'time', 'status', 'patient.name', 'patient.curp', 'patient.phoneNumber', 'studyName']);
                backupData.ultrasoundAppointments = parseSheet('Ultrasonidos', ['appointmentNumber', 'date', 'time', 'status', 'patient.name', 'patient.curp', 'patient.phoneNumber', 'studyName']);
                backupData.vaccineAppointments = parseSheet('Vacunación', ['appointmentNumber', 'date', 'time', 'status', 'patient.name', 'patient.curp', 'patient.phoneNumber', 'vaccines', 'isNewborn']);
                backupData.patients = parseSheet('Pacientes', ['curp', 'name', 'paternalLastName', 'maternalLastName', 'phoneNumber']);
                
                const result = await restoreBackupAction(backupData);
                if (result.success && result.stats) {
                    const { newAppointments, newLabAppointments, newXRayAppointments, newUltrasoundAppointments, newVaccineAppointments, newPatients } = result.stats;
                    const total = newAppointments + newLabAppointments + newXRayAppointments + newUltrasoundAppointments + newVaccineAppointments + newPatients;
                    toast({
                        title: 'Restauración Completada',
                        description: `Se agregaron ${total} registros nuevos. Los datos existentes no fueron modificados.`,
                        duration: 8000,
                    });
                    onRestoreSuccess?.();
                } else {
                    throw new Error(result.message || 'Error desconocido durante la restauración.');
                }
            } catch (error: any) {
                toast({
                    title: 'Error al Procesar Respaldo',
                    description: `El archivo no es válido o está corrupto. ${error.message}`,
                    variant: 'destructive',
                });
            }
        });
    };
    reader.readAsBinaryString(file);
    if(fileInputRef.current) fileInputRef.current.value = ''; // Reset input
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
          Realiza respaldos de seguridad en Excel, restaura desde un archivo Excel y limpia registros antiguos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-3 gap-4">
        <Button onClick={handleDownload} disabled={isDownloading} variant="outline">
          {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Descargar Respaldo (Excel)
        </Button>
        <Button onClick={handleRestoreClick} disabled={isRestoring} variant="outline">
           {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
           Cargar Respaldo (Excel)
        </Button>
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls"
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
