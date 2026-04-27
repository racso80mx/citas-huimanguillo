'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, 
  Plus, 
  Trash2, 
  Loader2, 
  FileText, 
  Pill,
  User,
  X,
  Calendar,
  FlaskConical,
  Stethoscope,
  UserRound,
  Hospital
} from 'lucide-react';
import { getMedications, createPrescription, getPatients, getLabStudies, getClinics } from '@/lib/actions';
import type { Medication, Patient, PrescriptionItem, Clinic, LabStudy } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Combobox } from '../ui/combobox';

type CreatePrescriptionDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  clinic: Clinic; // This is the current logged-in context
  initialPatient?: Patient | null;
};

export function CreatePrescriptionDialog({ isOpen, onClose, clinic, initialPatient }: CreatePrescriptionDialogProps) {
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatient || null);
  
  const [diagnosis, setDiagnosis] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);
  const [otherMedications, setOtherMedications] = useState('');
  
  const [allLabStudies, setAllLabStudies] = useState<LabStudy[]>([]);
  const [selectedLabStudies, setSelectedLabStudies] = useState<string[]>([]);
  const [otherStudies, setOtherStudies] = useState('');

  // Medical Directory selection
  const [allDoctors, setAllDoctors] = useState<Clinic[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(clinic.id);
  const [manualDoctor, setManualDoctor] = useState({ name: '', license: '', unit: '' });
  const [isManualDoctor, setIsManualDoctor] = useState(false);
  
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setIsLoadingInitialData(true);
      Promise.all([getMedications(), getLabStudies(), getClinics()]).then(([meds, labs, docs]) => {
        setMedications(meds);
        setAllLabStudies(labs.filter(l => l.available));
        setAllDoctors(docs);
        setIsLoadingInitialData(false);
      });
      if (initialPatient) setSelectedPatient(initialPatient);
      setSelectedDoctorId(clinic.id);
    }
  }, [isOpen, initialPatient, clinic.id]);

  const selectedDoctor = useMemo(() => {
    return allDoctors.find(d => d.id === selectedDoctorId) || null;
  }, [allDoctors, selectedDoctorId]);

  const handleSearchPatients = async () => {
    if (!patientSearch.trim()) return;
    setIsSearchingPatients(true);
    try {
      const data = await getPatients({ searchName: patientSearch, limitNum: 10 });
      setPatients(data);
    } finally {
      setIsSearchingPatients(false);
    }
  };

  const handleAddMedication = (med: Medication) => {
    if (med.existencia <= 0) {
        toast({ title: "Sin stock", description: "Este lote no tiene existencia.", variant: "destructive" });
        return;
    }
    
    if (prescriptionItems.some(i => i.medicationId === med.id)) {
        toast({ title: "Ya agregado", description: "Este lote específico ya está en la lista." });
        return;
    }

    setPrescriptionItems([
        ...prescriptionItems,
        {
            medicationId: med.id,
            name: med.descripcion,
            clave: med.claveCuadroBasico,
            quantity: 1,
            lote: med.lote,
            frequency: 'Cada 8 horas'
        }
    ]);
  };

  const updateItem = (id: string, field: keyof PrescriptionItem, value: any) => {
    setPrescriptionItems(prev => prev.map(i => i.medicationId === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => {
    setPrescriptionItems(prev => prev.filter(i => i.medicationId !== id));
  };

  const toggleLabStudy = (studyName: string) => {
    setSelectedLabStudies(prev => 
        prev.includes(studyName) ? prev.filter(s => s !== studyName) : [...prev, studyName]
    );
  };

  const handleSave = async () => {
    if (!selectedPatient) {
        toast({ title: "Paciente requerido", variant: "destructive" });
        return;
    }
    if (!diagnosis.trim()) {
        toast({ title: "Diagnóstico requerido", variant: "destructive" });
        return;
    }

    const docName = isManualDoctor ? manualDoctor.name : selectedDoctor?.doctorName;
    const docLicense = isManualDoctor ? manualDoctor.license : selectedDoctor?.professionalLicense;
    const unit = isManualDoctor ? manualDoctor.unit : selectedDoctor?.name;

    if (!docName) {
        toast({ title: "Médico requerido", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    try {
        const result = await createPrescription({
            patientId: selectedPatient.id,
            patientName: `${selectedPatient.name} ${selectedPatient.paternalLastName} ${selectedPatient.maternalLastName}`,
            clinicId: isManualDoctor ? 'externo' : (selectedDoctor?.id || clinic.id),
            doctorName: docName,
            doctorLicense: docLicense || '',
            unitName: unit || '',
            date: new Date().toISOString(),
            diagnosis,
            items: prescriptionItems,
            otherMedications,
            labStudies: selectedLabStudies,
            otherStudies,
            type: 'interno'
        });

        if (result.success) {
            toast({ title: "Receta Generada", description: `Folio: ${result.folio}.` });
            setPrescriptionItems([]);
            setDiagnosis('');
            setOtherMedications('');
            setSelectedLabStudies([]);
            setOtherStudies('');
            setSelectedPatient(null);
            onClose();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
    } finally {
        setIsSaving(false);
    }
  };

  const doctorOptions = useMemo(() => {
    return allDoctors.map(d => ({
        value: d.id,
        label: `${d.doctorName} (${d.name})`,
        keywords: `${d.doctorName} ${d.name} ${d.professionalLicense} ${d.clinicType}`,
        content: (
            <div className="flex flex-col gap-0.5 py-1">
                <span className="font-bold text-sm uppercase">{d.doctorName}</span>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase">
                    <Hospital className="h-3 w-3" /> {d.name}
                    {d.professionalLicense && <span>• CED: {d.professionalLicense}</span>}
                </div>
            </div>
        )
    }));
  }, [allDoctors]);

  const medOptions = useMemo(() => {
    return medications.map(m => ({
        value: m.id,
        label: `${m.descripcion} [LOTE: ${m.lote}]`,
        keywords: `${m.claveCuadroBasico} ${m.descripcion} ${m.lote}`,
        disabled: m.existencia <= 0,
        content: (
            <div className="flex flex-col gap-1 py-2">
                <div className="flex items-start justify-between gap-4">
                    <span className="font-bold text-sm uppercase leading-tight">{m.descripcion}</span>
                    <Badge variant={m.existencia > 0 ? "secondary" : "destructive"} className="text-[10px] h-5 shrink-0 font-black">Stock: {m.existencia}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground font-mono font-bold uppercase mt-1">
                    <span className="flex items-center gap-1.5"><Pill className="h-3 w-3 text-primary" /> LOTE: {m.lote}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3 text-primary" /> VENCE: {m.fechaCaducidad || 'N/A'}</span>
                </div>
            </div>
        )
    }));
  }, [medications]);

  const labOptions = useMemo(() => {
    return allLabStudies.map(s => ({
        value: s.name,
        label: s.name,
        keywords: `${s.name} ${s.section}`
    }));
  }, [allLabStudies]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl h-[95vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
                <DialogTitle className="flex items-center gap-2 text-2xl font-black">
                    <FileText className="h-7 w-7 text-primary" /> PRESCRIPCIÓN MÉDICA
                </DialogTitle>
                <DialogDescription>
                    Completa la receta para el paciente. Los insumos se descuentan en Farmacia.
                </DialogDescription>
            </div>
            <div className="text-right">
                <Badge variant="outline" className="font-mono text-xs uppercase bg-background">{clinic.name}</Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
                {/* 1. SELECCIÓN DE PACIENTE */}
                <div className="space-y-4">
                    <Label className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                        <User className="h-4 w-4" /> 1. Información del Paciente
                    </Label>
                    {!selectedPatient ? (
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Nombre completo o apellidos del paciente..." 
                            className="h-11 pl-9"
                            value={patientSearch}
                            onChange={e => setPatientSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearchPatients()}
                        />
                        </div>
                        <Button onClick={handleSearchPatients} disabled={isSearchingPatients} className="h-11">
                        {isSearchingPatients ? <Loader2 className="animate-spin h-4 w-4" /> : "Buscar"}
                        </Button>
                    </div>
                    ) : (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between animate-in fade-in zoom-in duration-200 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="bg-primary/10 p-3 rounded-full"><User className="h-6 w-6 text-primary" /></div>
                            <div>
                                <p className="font-black text-base uppercase leading-none">{selectedPatient.name} {selectedPatient.paternalLastName} {selectedPatient.maternalLastName}</p>
                                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground font-medium">
                                    <span>CURP: <span className="text-foreground font-bold">{selectedPatient.curp}</span></span>
                                    <span>|</span>
                                    <span>EXP: <span className="text-foreground font-bold">{selectedPatient.expediente || 'S/E'}</span></span>
                                    <span>|</span>
                                    <span>EDAD: <span className="text-foreground font-bold">{selectedPatient.age} años</span></span>
                                </div>
                            </div>
                        </div>
                        {!initialPatient && <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}><X className="h-4 w-4" /></Button>}
                    </div>
                    )}

                    {patients.length > 0 && !selectedPatient && (
                    <div className="border rounded-xl p-2 bg-muted/10 grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto shadow-inner">
                        {patients.map(p => (
                            <button 
                                key={p.id}
                                className="text-left p-3 hover:bg-background rounded-lg text-xs border border-transparent hover:border-border transition-all flex flex-col gap-0.5"
                                onClick={() => setSelectedPatient(p)}
                            >
                                <span className="font-black uppercase">{p.name} {p.paternalLastName}</span>
                                <span className="text-muted-foreground">{p.curp}</span>
                            </button>
                        ))}
                    </div>
                    )}
                </div>

                {/* 2. MÉDICO QUE PRESCRIBE */}
                <div className="space-y-4">
                    <Label className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                        <UserRound className="h-4 w-4" /> 2. Médico que Prescribe
                    </Label>
                    
                    {!isManualDoctor ? (
                        <div className="space-y-4">
                            <Combobox 
                                options={doctorOptions}
                                value={selectedDoctorId}
                                onChange={setSelectedDoctorId}
                                placeholder="Selecciona el médico del directorio..."
                                searchPlaceholder="Buscar por nombre o unidad..."
                                disabled={isLoadingInitialData}
                            />
                            {selectedDoctor && (
                                <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl border bg-muted/30 animate-in fade-in">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Unidad / Área</p>
                                        <p className="text-sm font-bold uppercase">{selectedDoctor.name}</p>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Cédula Profesional</p>
                                        <p className="text-sm font-bold font-mono">{selectedDoctor.professionalLicense || 'N/A'}</p>
                                    </div>
                                </div>
                            )}
                            <Button variant="link" size="sm" className="px-0" onClick={() => setIsManualDoctor(true)}>
                                ¿No está en el directorio? Capturar manualmente
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 p-4 border rounded-xl bg-accent/5">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase opacity-60">Nombre del Médico</Label>
                                    <Input placeholder="Ej. Dr. Juan Pérez" value={manualDoctor.name} onChange={e => setManualDoctor({...manualDoctor, name: e.target.value.toUpperCase()})} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase opacity-60">Cédula</Label>
                                    <Input placeholder="Número de cédula" value={manualDoctor.license} onChange={e => setManualDoctor({...manualDoctor, license: e.target.value.toUpperCase()})} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase opacity-60">Unidad Médica de Procedencia</Label>
                                <Input placeholder="Ej. Urgencias, Hospitalización..." value={manualDoctor.unit} onChange={e => setManualDoctor({...manualDoctor, unit: e.target.value.toUpperCase()})} />
                            </div>
                            <Button variant="link" size="sm" className="px-0" onClick={() => setIsManualDoctor(false)}>
                                Volver al Directorio Médico
                            </Button>
                        </div>
                    )}
                </div>

                {/* 3. DIAGNÓSTICO */}
                <div className="space-y-4">
                    <Label className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" /> 3. Diagnóstico Clínico
                    </Label>
                    <Textarea 
                        placeholder="Escribe el diagnóstico médico y observaciones generales..."
                        className="min-h-[80px] bg-muted/10 font-medium"
                        value={diagnosis}
                        onChange={e => setDiagnosis(e.target.value.toUpperCase())}
                    />
                </div>

                {/* 4. MEDICAMENTOS DEL HOSPITAL */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                            <Pill className="h-4 w-4" /> 4. Medicamentos de Farmacia (Surtido Interno)
                        </Label>
                        <Badge variant="outline" className="text-[10px] font-bold bg-background">Válido 24 hrs</Badge>
                    </div>
                    <Combobox 
                        options={medOptions}
                        value=""
                        onChange={(id) => {
                            const med = medications.find(m => m.id === id);
                            if (med) handleAddMedication(med);
                        }}
                        placeholder="Busca medicamento por nombre o lote..."
                        searchPlaceholder="Filtrar catálogo de farmacia..."
                        disabled={isLoadingInitialData}
                    />

                    <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase">Insumo / Lote</TableHead>
                                    <TableHead className="w-[80px] text-center text-[10px] font-black uppercase">Cant.</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Frecuencia / Vía</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Indicaciones</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {prescriptionItems.length > 0 ? prescriptionItems.map((item) => (
                                    <TableRow key={item.medicationId} className="hover:bg-muted/10">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-xs uppercase leading-tight">{item.name}</span>
                                                <span className="text-[9px] font-mono text-primary font-black mt-0.5">LOTE: {item.lote}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                type="number" 
                                                min={1} 
                                                className="h-9 text-center font-black" 
                                                value={item.quantity}
                                                onChange={e => updateItem(item.medicationId, 'quantity', parseInt(e.target.value) || 1)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                placeholder="Ej. Cada 8 hrs" 
                                                className="h-9 text-xs font-medium"
                                                value={item.frequency || ''}
                                                onChange={e => updateItem(item.medicationId, 'frequency', e.target.value.toUpperCase())}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                placeholder="Observaciones..." 
                                                className="h-9 text-xs"
                                                value={item.indications || ''}
                                                onChange={e => updateItem(item.medicationId, 'indications', e.target.value.toUpperCase())}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(item.medicationId)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic text-xs">
                                            No se han seleccionado medicamentos de farmacia.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* 5. MEDICAMENTOS EXTERNOS */}
                <div className="space-y-4">
                    <Label className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                        <Plus className="h-4 w-4" /> 5. Otros Medicamentos (Adquisición Externa)
                    </Label>
                    <Textarea 
                        placeholder="Escribe otros medicamentos que el paciente deba adquirir por su cuenta..."
                        className="min-h-[80px] bg-muted/10 uppercase"
                        value={otherMedications}
                        onChange={e => setOtherMedications(e.target.value.toUpperCase())}
                    />
                </div>

                {/* 6. ESTUDIOS DE LABORATORIO */}
                <div className="space-y-4">
                    <Label className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                        <FlaskConical className="h-4 w-4" /> 6. Estudios de Laboratorio
                    </Label>
                    <Combobox 
                        options={labOptions}
                        value=""
                        onChange={(val) => toggleLabStudy(val)}
                        placeholder="Busca estudios (ej. Biometría, Glucosa...)"
                        searchPlaceholder="Filtrar catálogo de laboratorio..."
                        disabled={isLoadingInitialData}
                    />
                    {selectedLabStudies.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-4 bg-muted/20 border rounded-xl shadow-inner">
                            {selectedLabStudies.map(study => (
                                <Badge key={study} variant="secondary" className="pl-3 pr-1.5 py-1.5 flex items-center gap-2 bg-background border-primary/20 text-foreground font-bold shadow-sm">
                                    <span className="text-xs uppercase">{study}</span>
                                    <button onClick={() => toggleLabStudy(study)} className="hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>

                {/* 7. OTROS ESTUDIOS / GABINETE */}
                <div className="space-y-4">
                    <Label className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                        <Plus className="h-4 w-4" /> 7. Otros Estudios / Gabinete
                    </Label>
                    <Textarea 
                        placeholder="Escribe otros estudios adicionales (Rayos X, Ultrasonidos externos, Gabinete, etc.)"
                        className="min-h-[80px] bg-muted/10 uppercase"
                        value={otherStudies}
                        onChange={e => setOtherStudies(e.target.value.toUpperCase())}
                    />
                </div>
            </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-muted/10 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-8">Cancelar</Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !selectedPatient || !diagnosis || (!selectedDoctor && !isManualDoctor)} 
            className="h-12 px-10 font-bold bg-primary hover:bg-primary/90 shadow-lg transition-all"
          >
            {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <FileText className="mr-2 h-5 w-5" />}
            Finalizar y Guardar Receta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
