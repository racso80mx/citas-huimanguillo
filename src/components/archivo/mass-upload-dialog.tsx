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
        try {
            const xlsx = await import('xlsx');
            const data = await file.arrayBuffer();
            const workbook = xlsx.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = xlsx.utils.sheet_to_json(worksheet);
            
            if (json.length === 0) {
                toast({ title: 'Archivo vacío', description: 'El archivo Excel no contiene datos.', variant: 'destructive' });
                return;
            }

            const result = await bulkInsertPatients(json);

            if (result.success) {
                toast({
                    title: 'Carga Exitosa',
                    description: `Se procesaron ${result.processedCount} registros. ${result.addedCount} agregados, ${result.updatedCount} actualizados.`,
                    duration: 8000
                });
                onUploadSuccess();
                onClose();
            } else {
                toast({ title: 'Error en la carga', description: result.message, variant: 'destructive' });
            }
        } catch (error: any) {
             toast({ title: 'Error al procesar el archivo', description: error.message || 'Hubo un problema al leer el archivo Excel.', variant: 'destructive' });
        }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Carga Masiva de Pacientes</DialogTitle>
          <DialogDescription>
            Sube un archivo Excel (.xlsx) con los datos de los pacientes. El sistema actualizará los registros existentes (basado en CURP) y creará los nuevos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Alert>
            <AlertTitle className="flex items-center gap-2">Instrucciones</AlertTitle>
            <AlertDescription>
                <ol className="list-decimal list-inside space-y-1 mt-2">
                    <li>Descarga la plantilla para asegurar el formato correcto.</li>
                    <li>Llena la plantilla con los datos de los pacientes.</li>
                    <li>Asegúrate de que la columna `DerechoAbiencia` contenga `TRUE` o `FALSE`.</li>
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {isUploading ? 'Procesando...' : 'Iniciar Carga'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
