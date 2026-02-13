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
import { downloadBackupAction, cleanupOldRecordsAction } from '@/lib/actions';
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
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function BackupManager({ onRestoreSuccess }: { onRestoreSuccess?: () => void }) {
  const [isDownloading, startDownloadTransition] = useTransition();
  const [isRestoring, startRestoreTransition] = useTransition();
  const [isCleaning, startCleanTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cleanupPassword, setCleanupPassword] = useState('');
  const { toast } = useToast();
  
  const handleDownload = () => {
    startDownloadTransition(async () => {
      const result = await downloadBackupAction();
      if (result.success && result.data) {
        try {
            const workbook = xlsx.utils.book_new();

            const createSheetFromCollection = (sheetName: string, data: any[], keyMapping: Record<string, string>) => {
              if (!data || data.length === 0) return;
              const mappedData = data.map(item => {
                const newRow: Record<string, any> = {};
                for (const key in keyMapping) {
                  const itemKey = keyMapping[key];
                  
                  if (itemKey.includes('.')) {
                     const [obj, prop] = itemKey.split('.');
                     newRow[key] = item[obj] ? item[obj][prop] : '';
                  } else if (Array.isArray(item[itemKey])) {
                    newRow[key] = item[itemKey].map((i: any) => i.name).join(', ');
                  }
                  else {
                    newRow[key] = item[itemKey] ?? '';
                  }
                }
                return newRow;
              });

              const worksheet = xlsx.utils.json_to_sheet(mappedData);
              xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
            };
            
            createSheetFromCollection('Citas Médicas', result.data.appointments, { 'Folio': 'appointmentNumber', 'Fecha': 'date', 'Hora': 'time', 'Estado': 'status', 'Nombre': 'patient.name', 'Apellido Paterno': 'patient.paternalLastName', 'Apellido Materno': 'patient.maternalLastName', 'CURP': 'patient.curp', 'Teléfono': 'patient.phoneNumber', 'Núcleo': 'clinicName', 'Tipo Paciente': 'patientType' });
            createSheetFromCollection('Laboratorio', result.data.labAppointments, { 'Folio': 'appointmentNumber', 'Fecha': 'date', 'Hora': 'time', 'Estado': 'status', 'Nombre': 'patient.name', 'Apellido Paterno': 'patient.paternalLastName', 'Apellido Materno': 'patient.maternalLastName', 'CURP': 'patient.curp', 'Teléfono': 'patient.phoneNumber', 'Estudios': 'studies' });
            createSheetFromCollection('Rayos X', result.data.xRayAppointments, { 'Folio': 'appointmentNumber', 'Fecha': 'date', 'Hora': 'time', 'Estado': 'status', 'Nombre': 'patient.name', 'Apellido Paterno': 'patient.paternalLastName', 'Apellido Materno': 'patient.maternalLastName', 'CURP': 'patient.curp', 'Teléfono': 'patient.phoneNumber', 'Estudio': 'studyName' });
            createSheetFromCollection('Ultrasonidos', result.data.ultrasoundAppointments, { 'Folio': 'appointmentNumber', 'Fecha': 'date', 'Hora': 'time', 'Estado': 'status', 'Nombre': 'patient.name', 'Apellido Paterno': 'patient.paternalLastName', 'Apellido Materno': 'patient.maternalLastName', 'CURP': 'patient.curp', 'Teléfono': 'patient.phoneNumber', 'Estudio': 'studyName' });
            createSheetFromCollection('Vacunación', result.data.vaccineAppointments, { 'Folio': 'appointmentNumber', 'Fecha': 'date', 'Hora': 'time', 'Estado': 'status', 'Nombre': 'patient.name', 'Apellido Paterno': 'patient.paternalLastName', 'Apellido Materno': 'patient.maternalLastName', 'CURP': 'patient.curp', 'Teléfono': 'patient.phoneNumber', 'Vacunas': 'vaccines', 'Recién Nacido': 'isNewborn' });
            createSheetFromCollection('Pacientes', result.data.patients, { 'ID': 'id', 'CURP': 'curp', 'Nombre': 'name', 'Apellido Paterno': 'paternalLastName', 'Apellido Materno': 'maternalLastName', 'Teléfono': 'phoneNumber' });
            createSheetFromCollection('Clinicas', result.data.clinics, { 'ID': 'id', 'Nombre': 'name', 'Doctor': 'doctorName' });

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // This functionality is temporarily disabled.
    toast({
        title: 'Función Deshabilitada',
        description: 'La restauración desde un archivo está deshabilitada en este momento.',
        variant: 'destructive',
    });
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
  
  const handleConfirmCleanup = () => {
    if (cleanupPassword !== 'Hu1m4ngu1ll0') {
      toast({
        title: 'Contraseña Incorrecta',
        description: 'La contraseña proporcionada no es válida para realizar esta acción.',
        variant: 'destructive',
      });
      return;
    }
    handleCleanup();
  };

  return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>Gestión de Datos</CardTitle>
          <CardDescription>
            Realiza respaldos de seguridad en Excel y limpia registros antiguos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <Button onClick={handleDownload} disabled={isDownloading} className="bg-green-600 text-white hover:bg-green-700">
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Descargar Respaldo (Excel)
          </Button>

          <Button onClick={() => fileInputRef.current?.click()} disabled={true} variant="outline">
            {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Cargar Respaldo (Deshabilitado)
          </Button>
          <p className="text-xs text-muted-foreground col-span-1 sm:col-span-3 -mt-2">La restauración desde Excel está deshabilitada temporalmente por la migración a la base de datos en la nube.</p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".xlsx"
          />

          <AlertDialog onOpenChange={(open) => !open && setCleanupPassword('')}>
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
                  Para confirmar, ingresa la contraseña de SuperAdmin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="cleanup-password">Contraseña de SuperAdmin</Label>
                <Input
                  id="cleanup-password"
                  type="password"
                  value={cleanupPassword}
                  onChange={(e) => setCleanupPassword(e.target.value)}
                  placeholder="Ingresa la contraseña para confirmar"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmCleanup}
                  disabled={isCleaning}
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
