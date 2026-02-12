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
import { format, parseISO } from 'date-fns';
import type { Clinic, Appointment, LabAppointment, XRayAppointment, UltrasoundAppointment, VaccineAppointment } from '@/lib/definitions';


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
            const clinics: Clinic[] = result.data.clinics || [];
            const clinicMap = new Map(clinics.map(c => [c.id, c.name]));

            const createSheet = (sheetName: string, appointments: any[], type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine') => {
                if (!appointments || appointments.length === 0) return;

                const worksheetData = appointments.map((item) => {
                    const baseData: any = {
                        'Folio': item.appointmentNumber,
                        'Fecha': format(parseISO(item.date), 'dd/MM/yyyy'),
                        'Hora': item.time,
                        'Estado': item.status,
                        'Paciente': item.patient ? `${item.patient.name} ${item.patient.paternalLastName} ${item.patient.maternalLastName}`: 'N/A',
                        'CURP': item.patient?.curp || 'N/A',
                        'Teléfono': item.patient?.phoneNumber || 'N/A',
                    };

                    if (type === 'lab') {
                        baseData['Estudios'] = (item as LabAppointment).studies.map(s => s.name).join(', ');
                    } else if (type === 'xray') {
                        baseData['Estudio'] = (item as XRayAppointment).studyName;
                    } else if (type === 'ultrasound') {
                        baseData['Estudio'] = (item as UltrasoundAppointment).studyName;
                    } else if (type === 'vaccine') {
                        baseData['Vacunas'] = (item as VaccineAppointment).vaccines.map(v => v.name).join(', ');
                        baseData['Recién Nacido'] = (item as VaccineAppointment).isNewborn ? 'Sí' : 'No';
                    } else { // medical
                        const regularItem = item as Appointment;
                        baseData['Núcleo'] = clinicMap.get(regularItem.clinicId) || 'N/A';
                        baseData['Tipo Paciente'] = regularItem.patientType;
                    }
                    return baseData;
                });
                
                const worksheet = xlsx.utils.json_to_sheet(worksheetData);
                if (worksheetData.length > 0) {
                    const cols = Object.keys(worksheetData[0]);
                    const colWidths = cols.map(col => ({
                        wch: Math.max(...worksheetData.map(row => (row[col as keyof typeof row] ?? '').toString().length), col.length) + 1
                    }));
                    worksheet['!cols'] = colWidths;
                }
                xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
            };

            createSheet('Citas Médicas', result.data.appointments, 'medical');
            createSheet('Laboratorio', result.data.labAppointments, 'lab');
            createSheet('Rayos X', result.data.xRayAppointments, 'xray');
            createSheet('Ultrasonidos', result.data.ultrasoundAppointments, 'ultrasound');
            createSheet('Vacunación', result.data.vaccineAppointments, 'vaccine');

            // Also add patients sheet
            if (result.data.patients && result.data.patients.length > 0) {
                 const worksheet = xlsx.utils.json_to_sheet(result.data.patients);
                 xlsx.utils.book_append_sheet(workbook, worksheet, 'Pacientes');
            }
            
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
        const content = e.target?.result;
        if (content instanceof ArrayBuffer) {
            startRestoreTransition(async () => {
                try {
                    const workbook = xlsx.read(content, { type: 'buffer', cellDates: true });
                    const backupData: { [key: string]: any[] } = {};

                    for (const sheetName of workbook.SheetNames) {
                        const worksheet = workbook.Sheets[sheetName];
                        if (!worksheet) continue;
                        const jsonData = xlsx.utils.sheet_to_json(worksheet);
                        backupData[sheetName] = jsonData;
                    }

                    const result = await restoreBackupAction(JSON.stringify(backupData));
                    
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
                } catch (parseError: any) {
                    toast({
                        title: 'Error al Leer Archivo',
                        description: 'No se pudo procesar el archivo Excel. Asegúrate que tiene el formato correcto.',
                        variant: 'destructive',
                    });
                }
            });
        }
    };
    reader.readAsArrayBuffer(file);
    if (event.target) event.target.value = '';
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
          Realiza respaldos de seguridad en Excel, restaura datos desde un archivo Excel y limpia registros antiguos.
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
