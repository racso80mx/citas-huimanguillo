'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { getClinics, updateClinics, bulkInsertDoctors, deleteClinic, getSpecialties } from '@/lib/actions';
import type { Clinic, Specialty } from '@/lib/definitions';
import { ClinicType, BookingMode } from '@/lib/definitions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Loader2, 
  Download, 
  UserRound, 
  Hospital, 
  ShieldCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  PlusCircle,
  Upload,
  Pencil,
  Trash2,
  FileDown,
  Fingerprint
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { v4 as uuidv4 } from 'uuid';
import { Progress } from '../ui/progress';

export function DoctorsCatalog() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Clinic; direction: 'asc' | 'desc' } | null>({ key: 'doctorName', direction: 'asc' });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Clinic | null>(null);
  
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [doctorsData, specialtiesData] = await Promise.all([
          getClinics(),
          getSpecialties()
      ]);
      setClinics(doctorsData.filter(c => c.doctorName && c.doctorName.trim() !== ''));
      setSpecialties(specialtiesData);
    } catch (e) {
      toast({ title: 'Error al cargar médicos', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSort = (key: keyof Clinic) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Clinic) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const filteredDoctors = useMemo(() => {
    let results = [...clinics];

    if (searchTerm) {
      const term = searchTerm.toUpperCase();
      results = results.filter(c => 
        c.doctorName.toUpperCase().includes(term) || 
        (c.doctorCurp && c.doctorCurp.toUpperCase().includes(term)) ||
        (c.professionalLicense && c.professionalLicense.includes(term)) ||
        c.name.toUpperCase().includes(term)
      );
    }

    if (sortConfig) {
      results.sort((a, b) => {
        const valA = String((a as any)[sortConfig.key] || '').toUpperCase();
        const valB = String((b as any)[sortConfig.key] || '').toUpperCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return results;
  }, [clinics, searchTerm, sortConfig]);

  const handleDownloadExcel = async () => {
    if (filteredDoctors.length === 0) return;
    const xlsx = await import('xlsx');
    const data = filteredDoctors.map(d => ({
        'Médico': d.doctorName,
        'CURP': d.doctorCurp || 'S/C',
        'Cédula Profesional': d.professionalLicense || 'S/C',
        'Unidad de Adscripción': d.name,
        'Servicio': d.clinicType
    }));
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Directorio Médico');
    xlsx.writeFile(wb, 'directorio_medicos_adscripcion.xlsx');
  };

  const handleAddDoctor = () => {
    setSelectedDoctor({
        id: uuidv4(),
        name: '',
        doctorName: '',
        doctorCurp: '',
        professionalLicense: '',
        password: 'hospital_default',
        dailySlots: 10,
        startTime: '08:00',
        endTime: '13:00',
        weekendBookingEnabled: false,
        clinicType: specialties[0]?.name || 'Consulta Externa',
        bookingMode: BookingMode.Time,
        consultationDuration: 30
    });
    setIsEditOpen(true);
  };

  const handleEditDoctor = (doctor: Clinic) => {
    setSelectedDoctor(doctor);
    setIsEditOpen(true);
  };

  const handleDeleteDoctor = async (id: string) => {
    if (!confirm('¿Seguro que desea eliminar a este médico del directorio?')) return;
    try {
        await deleteClinic(id);
        toast({ title: 'Médico eliminado' });
        fetchData();
    } catch (e) {
        toast({ title: 'Error al eliminar', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
        <Card className="shadow-lg border-primary/10">
            <CardHeader className="bg-muted/10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle className="text-2xl font-bold font-headline flex items-center gap-2">
                        <UserRound className="h-6 w-6 text-primary" /> Directorio de Médicos y Adscripción
                        </CardTitle>
                        <CardDescription>
                        Gestiona el personal médico interno y externo del hospital.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="default" className="bg-primary hover:bg-primary/90" onClick={handleAddDoctor}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Médico
                        </Button>
                        <Button variant="secondary" onClick={() => setIsUploadOpen(true)}>
                            <Upload className="mr-2 h-4 w-4" /> Carga Masiva
                        </Button>
                        <Button variant="outline" onClick={handleDownloadExcel} disabled={filteredDoctors.length === 0}>
                            <Download className="mr-2 h-4 w-4" /> Exportar Excel
                        </Button>
                        <Button variant="ghost" size="icon" onClick={fetchData} disabled={isLoading}>
                            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        </Button>
                    </div>
                </div>
                <div className="relative mt-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por nombre, CURP, cédula o unidad..." 
                        className="pl-9 h-11"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground tracking-widest uppercase">Consultando Directorio...</p>
                </div>
                ) : (
                <div className="overflow-x-auto">
                    <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                        <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('doctorName')}>
                            <div className="flex items-center">Médico {getSortIcon('doctorName')}</div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('doctorCurp')}>
                            <div className="flex items-center">CURP {getSortIcon('doctorCurp')}</div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('professionalLicense')}>
                            <div className="flex items-center">Cédula {getSortIcon('professionalLicense')}</div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('name')}>
                            <div className="flex items-center">Unidad / Área {getSortIcon('name')}</div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('clinicType')}>
                            <div className="flex items-center">Especialidad {getSortIcon('clinicType')}</div>
                        </TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredDoctors.length > 0 ? filteredDoctors.map((doc) => (
                        <TableRow key={doc.id} className="hover:bg-muted/30 group">
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary/5 p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                                        <UserRound className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="font-bold text-sm uppercase">{doc.doctorName}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Fingerprint className="h-4 w-4 text-blue-600" />
                                    <code className="bg-muted px-2 py-0.5 rounded font-mono text-[10px] font-bold">
                                        {doc.doctorCurp || 'S/C'}
                                    </code>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-green-600" />
                                    <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs font-bold">
                                        {doc.professionalLicense || 'EN TRÁMITE'}
                                    </code>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2 text-xs font-medium uppercase">
                                    <Hospital className="h-3.5 w-3.5 text-muted-foreground" />
                                    {doc.name}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter bg-background">
                                    {doc.clinicType}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEditDoctor(doc)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteDoctor(doc.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                        )) : (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">
                                No se encontraron médicos que coincidan con la búsqueda.
                            </TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                    </Table>
                </div>
                )}
            </CardContent>
        </Card>

        {/* Dialog for adding/editing */}
        {selectedDoctor && (
            <EditDoctorDialog 
                isOpen={isEditOpen} 
                onClose={() => { setIsEditOpen(false); setSelectedDoctor(null); }} 
                doctor={selectedDoctor}
                specialties={specialties}
                onSave={async (data) => {
                    const existing = clinics.map(c => c.id === data.id ? data : c);
                    if (!clinics.some(c => c.id === data.id)) existing.push(data);
                    await updateClinics(existing);
                    fetchData();
                    setIsEditOpen(false);
                    setSelectedDoctor(null);
                }}
            />
        )}

        <MassUploadDoctorsDialog 
            isOpen={isUploadOpen} 
            onClose={() => setIsUploadOpen(false)} 
            onSuccess={() => { fetchData(); setIsUploadOpen(false); }}
        />
    </div>
  );
}

function EditDoctorDialog({ isOpen, onClose, doctor, specialties, onSave }: { isOpen: boolean, onClose: () => void, doctor: Clinic, specialties: Specialty[], onSave: (d: Clinic) => Promise<void> }) {
    const [formData, setFormData] = useState<Clinic>(doctor);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!formData.doctorName.trim() || !formData.name.trim()) return;
        setIsSaving(true);
        await onSave(formData);
        setIsSaving(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{doctor.doctorName ? 'Editar Médico' : 'Registrar Nuevo Médico'}</DialogTitle>
                    <DialogDescription>Completa la información profesional del médico.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Nombre Completo del Médico</Label>
                        <Input value={formData.doctorName} onChange={e => setFormData({...formData, doctorName: e.target.value.toUpperCase()})} placeholder="DR. NOMBRE APELLIDO" />
                    </div>
                    <div className="space-y-2">
                        <Label>CURP</Label>
                        <Input value={formData.doctorCurp || ''} onChange={e => setFormData({...formData, doctorCurp: e.target.value.toUpperCase()})} placeholder="CURP de 18 caracteres" maxLength={18} />
                    </div>
                    <div className="space-y-2">
                        <Label>Cédula Profesional</Label>
                        <Input value={formData.professionalLicense} onChange={e => setFormData({...formData, professionalLicense: e.target.value.toUpperCase()})} placeholder="Número de cédula o 'EN TRÁMITE'" />
                    </div>
                    <div className="space-y-2">
                        <Label>Unidad Médica / Área de Adscripción</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} placeholder="Ej. URGENCIAS, NÚCLEO 1, HOSPITAL..." />
                    </div>
                    <div className="space-y-2">
                        <Label>Especialidad / Servicio</Label>
                        <Select value={formData.clinicType} onValueChange={(v: string) => setFormData({...formData, clinicType: v})}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {specialties.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving || !formData.doctorName || !formData.name}>
                        {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                        Guardar Médico
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function MassUploadDoctorsDialog({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, startUploadTransition] = useTransition();
    const [progress, setProgress] = useState(0);
    const { toast } = useToast();

    const handleDownloadTemplate = async () => {
        const xlsx = await import('xlsx');
        const ws = xlsx.utils.json_to_sheet([
            { 'Médico': 'DR. JUAN PEREZ', 'CURP': 'ABCD010101HXXXXXXX', 'Cédula': '1234567', 'Unidad': 'URGENCIAS', 'Servicio': 'Médico Externo / Otra Área' },
            { 'Médico': 'DRA. MARIA GARCIA', 'CURP': 'EFGH010101MXXXXXXX', 'Cédula': '7654321', 'Unidad': 'NUCLEO BASICO 5', 'Servicio': 'Consulta Externa' }
        ]);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Médicos');
        xlsx.writeFile(wb, 'plantilla_directorio_medico.xlsx');
    };

    const handleUpload = () => {
        if (!file) return;
        startUploadTransition(async () => {
            try {
                const xlsx = await import('xlsx');
                const buffer = await file.arrayBuffer();
                const workbook = xlsx.read(buffer);
                const json = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                if (json.length === 0) {
                    toast({ title: 'Archivo vacío', variant: 'destructive' });
                    return;
                }

                setProgress(20);
                const CHUNK_SIZE = 100;
                let processed = 0;

                for (let i = 0; i < json.length; i += CHUNK_SIZE) {
                    const chunk = json.slice(i, i + CHUNK_SIZE);
                    const res = await bulkInsertDoctors(JSON.parse(JSON.stringify(chunk)));
                    if (res.success) {
                        processed += res.processedCount || 0;
                        setProgress(Math.round(((i + CHUNK_SIZE) / json.length) * 100));
                    } else {
                        throw new Error(res.message);
                    }
                }

                toast({ title: 'Importación exitosa', description: `Se agregaron ${processed} médicos al directorio.` });
                onSuccess();
            } catch (e: any) {
                toast({ title: 'Error al importar', description: e.message, variant: 'destructive' });
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Carga Masiva de Directorio Médico</DialogTitle>
                    <DialogDescription>Sube un archivo Excel para actualizar el catálogo de médicos rápidamente.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <Button variant="outline" className="w-full h-12" onClick={handleDownloadTemplate}>
                        <FileDown className="mr-2 h-4 w-4" /> Descargar Plantilla Excel
                    </Button>
                    <div className="space-y-2">
                        <Label>Archivo de Directorio</Label>
                        <Input type="file" accept=".xlsx, .xls" onChange={e => setFile(e.target.files?.[0] || null)} disabled={isUploading} />
                    </div>
                    {isUploading && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span>Procesando...</span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={isUploading}>Cancelar</Button>
                    <Button onClick={handleUpload} disabled={!file || isUploading}>
                        {isUploading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        Subir Directorio
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

