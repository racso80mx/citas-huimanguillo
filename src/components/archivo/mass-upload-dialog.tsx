'use client';

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Upload, FileDown, Loader2 } from 'lucide-react';
import { bulkInsertPatients } from '@/lib/actions';
import { Progress } from '@/components/ui/progress';

type MassUploadDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
};

const requiredColumns = [
    'No.Expediente', 'Nombre', 'Apaterno', 'Amaterno', 'FNacimiento',
    'Edad', 'Sexo', 'Estado', 'Domicilio', 'Colonia', 'NombrePadre',
    'NombreMadre', 'EdadPadre', 'EdadMadre', 'FechaApertura',
    'Estatus', 'DerechoAbiencia', 'Telefono', 'CURP'
];

export function MassUploadDialog({ isOpen, onClose, onUploadSuccess }: MassUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const { toast } = useToast();
  
  // State to track upload progress
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState({
      processed: 0,
      added: 0,
      updated: 0,
      total: 0,
      message: ''
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
    }
  };

  const handleDownloadTemplate = async () => {
    const xlsx = await import('xlsx');
    const ws = xlsx.utils.json_to_sheet([{}], { header: requiredColumns });
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Pacientes');
    xlsx.writeFile(wb, 'plantilla_pacientes.xlsx');
  };

  const handleUpload = () => {
    if (!file) {
      toast({ title: 'Error', description: 'Por favor, selecciona un archivo.', variant: 'destructive' });
      return;
    }

    startUploadTransition(async () => {
        // Reset status for a new upload session
        setProgress(0);
        setUploadStatus({ processed: 0, added: 0, updated: 0, total: 0, message: 'Iniciando proceso...' });

        let json: any[] = [];
        try {
            // Read the file from the client's machine
            const xlsx = await import('xlsx');
            const data = await file.arrayBuffer();
            const workbook = xlsx.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            json = xlsx.utils.sheet_to_json(worksheet);
        } catch (error: any) {
            toast({ title: 'Error al leer archivo', description: error.message || 'No se pudo procesar el archivo Excel.', variant: 'destructive' });
            return;
        }

        if (json.length === 0) {
            toast({ title: 'Archivo vacío', description: 'El archivo Excel no contiene datos.', variant: 'destructive' });
            return;
        }
        
        const totalRecords = json.length;
        setUploadStatus(prev => ({ ...prev, total: totalRecords, message: 'Archivo leído. Preparando carga...' }));

        // Define the size of each chunk to be sent to the server.
        // This avoids hitting serverless function payload size and execution time limits.
        const CHUNK_SIZE = 500;
        const numChunks = Math.ceil(totalRecords / CHUNK_SIZE);

        let totalAdded = 0;
        let totalUpdated = 0;
        let totalProcessed = 0;

        // Loop through the data in chunks and send each one to the server individually.
        for (let i = 0; i < numChunks; i++) {
            const chunk = json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            
            setUploadStatus(prev => ({
                ...prev,
                message: `Enviando lote ${i + 1} de ${numChunks}...`
            }));
            
            // Server Action is called for each chunk.
            const result = await bulkInsertPatients(chunk);

            if (result.success) {
                totalAdded += result.addedCount || 0;
                totalUpdated += result.updatedCount || 0;
                totalProcessed += result.processedCount || 0;

                // Update UI state with the accumulated progress.
                setProgress(Math.round(((i + 1) / numChunks) * 100));
                setUploadStatus({
                    processed: totalProcessed,
                    added: totalAdded,
                    updated: totalUpdated,
                    total: totalRecords,
                    message: `Lote ${i + 1} de ${numChunks} completado.`
                });
            } else {
                // If a chunk fails, stop the entire process and notify the user.
                toast({
                    title: `Error en el lote ${i + 1}`,
                    description: result.message || 'Una parte de la carga falló. Revise la consola y el archivo e intente de nuevo.',
                    variant: 'destructive',
                    duration: 10000,
                });
                setUploadStatus(prev => ({ ...prev, message: `Error en el lote ${i+1}. Carga detenida.` }));
                return; // Stop the upload process.
            }
        }

        // Final success message after all chunks are processed.
        toast({
            title: 'Carga Masiva Completada',
            description: `Se procesaron ${totalProcessed} registros. ${totalAdded} agregados, ${totalUpdated} actualizados.`,
            duration: 10000,
        });
        setUploadStatus(prev => ({ ...prev, message: '¡Carga completada!' }));
        onUploadSuccess();
        
        // Close the dialog after a short delay on success.
        setTimeout(() => {
            onClose();
        }, 3000);
    });
  };
  
  const handleClose = () => {
    if (isUploading) return;
    onClose();
    setFile(null);
    setProgress(0);
    setUploadStatus({ processed: 0, added: 0, updated: 0, total: 0, message: '' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Carga Masiva de Pacientes</DialogTitle>
          <DialogDescription>
            Sube un archivo Excel (.xlsx) con los datos de los pacientes. El sistema actualizará los registros existentes (basado en CURP) y creará los nuevos.
          </DialogDescription>
        </DialogHeader>
        
        {isUploading ? (
          <div className="space-y-4 py-4">
              <h3 className="font-semibold text-center">{uploadStatus.message}</h3>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                  {uploadStatus.processed} de {uploadStatus.total} registros procesados.
              </p>
              <div className="flex justify-around text-center pt-2">
                  <div>
                      <div className="font-bold text-lg text-green-600">{uploadStatus.added}</div>
                      <div className="text-xs text-muted-foreground">Nuevos Registros</div>
                  </div>
                  <div>
                      <div className="font-bold text-lg text-blue-600">{uploadStatus.updated}</div>
                      <div className="text-xs text-muted-foreground">Registros Actualizados</div>
                  </div>
              </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert>
              <AlertTitle className="flex items-center gap-2">Instrucciones</AlertTitle>
              <AlertDescription>
                  <ol className="list-decimal list-inside space-y-1 mt-2">
                      <li>Descarga la plantilla para asegurar el formato correcto.</li>
                      <li>Llena la plantilla con los datos de los pacientes.</li>
                      <li>Sube el archivo completo.</li>
                  </ol>
              </AlertDescription>
            </Alert>
            <Button onClick={handleDownloadTemplate} variant="outline" className="w-full">
              <FileDown className="mr-2 h-4 w-4" />
              Descargar Plantilla
            </Button>
            <div className="space-y-2">
              <Label htmlFor="file-upload">Seleccionar archivo Excel</Label>
              <Input id="file-upload" type="file" accept=".xlsx" onChange={handleFileChange} />
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
             {progress === 100 ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!isUploading && (
              <Button onClick={handleUpload} disabled={!file || isUploading}>
                  <Upload className="mr-2 h-4 w-4" /> Iniciar Carga
              </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
