'use client';

import React, { useState, useMemo } from 'react';
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
import { 
  Search, 
  Plus, 
  Trash2, 
  Loader2, 
  FileText, 
  Pill,
  AlertCircle,
  User,
  X
} from 'lucide-react';
import { getMedications, createPrescription, getPatients } from '@/lib/actions';
import type { Medication, Patient, PrescriptionItem } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Combobox } from '../ui/combobox';

type CreatePrescriptionDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  clinicId: string;
  doctorName: string;
};

export function CreatePrescriptionDialog({ isOpen, onClose, clinicId, doctorName }: CreatePrescriptionDialogProps) {
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  const [medications, setMedications] = useState<Medication[]>([]);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);
  
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [isLoadingMeds, setIsLoadingInitialMeds] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      setIsLoadingInitialMeds(true);
      getMedications().then(data => {
        setMedications(data);
        setIsLoadingInitialMeds(false);
      });
    }
  }, [isOpen]);

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
        toast({ title: "Sin stock", description: "Este medicamento no tiene existencia en farmacia.", variant: "destructive" });
        return;
    }
    
    if (prescriptionItems.some(i => i.medicationId === med.id)) {
        toast({ title: "Ya agregado", description: "Este medicamento ya está en la lista." });
        return;
    }

    setPrescriptionItems([
        ...prescriptionItems,
        {
            medicationId: med.id,
            name: med.descripcion,
            clave: med.claveCuadroBasico,
            quantity: 1
        }
    ]);
  };

  const updateItemQuantity = (id: string, qty: number) => {
    setPrescriptionItems(prev => prev.map(i => i.medicationId === id ? { ...i, quantity: qty } : i));
  };

  const updateItemIndications = (id: string, text: string) => {
    setPrescriptionItems(prev => prev.map(i => i.medicationId === id ? { ...i, indications: text } : i));
  };

  const removeItem = (id: string) => {
    setPrescriptionItems(prev => prev.filter(i => i.medicationId !== id));
  };

  const handleSave = async () => {
    if (!selectedPatient) {
        toast({ title: "Paciente requerido", description: "Selecciona un paciente para la receta.", variant: "destructive" });
        return;
    }
    if (prescriptionItems.length === 0) {
        toast({ title: "Receta vacía", description: "Agrega al menos un medicamento.", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    try {
        const result = await createPrescription({
            patientId: selectedPatient.id,
            patientName: `${selectedPatient.name} ${selectedPatient.paternalLastName}`,
            clinicId,
            doctorName,
            date: new Date().toISOString(),
            items: prescriptionItems,
            type: 'interno'
        });

        if (result.success) {
            toast({ title: "Receta Generada", description: `Folio: ${result.folio}` });
            setPrescriptionItems([]);
            setSelectedPatient(null);
            onClose();
        } else {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        }
    } finally {
        setIsSaving(false);
    }
  };

  const medOptions = useMemo(() => {
    return medications.map(m => ({
        value: m.id,
        label: `${m.claveCuadroBasico} - ${m.descripcion} (${m.existencia} disp.)`,
        keywords: `${m.claveCuadroBasico} ${m.descripcion}`,
        disabled: m.existencia <= 0
    }));
  }, [medications]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Generar Receta Médica
          </DialogTitle>
          <DialogDescription>
            Selecciona el paciente y los medicamentos. La receta tendrá una vigencia de 24 horas para ser surtida.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-6 px-6 pb-6">
          {/* Patient Selection */}
          <div className="space-y-4">
            <Label className="text-xs font-bold uppercase text-muted-foreground">1. Datos del Paciente</Label>
            {!selectedPatient ? (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar paciente por nombre o apellidos..." 
                    className="pl-9 h-11"
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearchPatients()}
                  />
                </div>
                <Button onClick={handleSearchPatients} disabled={isSearchingPatients}>
                  {isSearchingPatients ? <Loader2 className="animate-spin h-4 w-4" /> : "Buscar"}
                </Button>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full"><User className="h-5 w-5 text-primary" /></div>
                    <div>
                        <p className="font-bold text-sm uppercase">{selectedPatient.name} {selectedPatient.paternalLastName} {selectedPatient.maternalLastName}</p>
                        <p className="text-xs text-muted-foreground">CURP: {selectedPatient.curp} | Expediente: {selectedPatient.expediente || 'S/E'}</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}><X className="h-4 w-4" /></Button>
              </div>
            )}

            {patients.length > 0 && !selectedPatient && (
              <ScrollArea className="h-40 border rounded-lg p-2 bg-muted/20">
                <div className="space-y-1">
                  {patients.map(p => (
                    <button 
                      key={p.id}
                      className="w-full text-left p-2 hover:bg-background rounded-md text-xs border border-transparent hover:border-border transition-all"
                      onClick={() => setSelectedPatient(p)}
                    >
                      <span className="font-bold">{p.name} {p.paternalLastName}</span> - {p.curp}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Medication Selection */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <Label className="text-xs font-bold uppercase text-muted-foreground">2. Prescripción</Label>
            <div className="flex gap-2 shrink-0">
               <Combobox 
                options={medOptions}
                value=""
                onChange={(id) => {
                    const med = medications.find(m => m.id === id);
                    if (med) handleAddMedication(med);
                }}
                placeholder="Escribe el nombre o clave del medicamento..."
                searchPlaceholder="Filtrar inventario..."
                noResultsText="Medicamento no encontrado o sin existencia."
               />
            </div>

            <div className="flex-1 border rounded-xl overflow-hidden bg-card flex flex-col shadow-inner">
               <ScrollArea className="flex-1">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Medicamento</TableHead>
                        <TableHead className="w-[100px] text-center">Cant.</TableHead>
                        <TableHead>Indicaciones / Posología</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prescriptionItems.length > 0 ? prescriptionItems.map((item) => (
                        <TableRow key={item.medicationId} className="hover:bg-muted/20">
                          <TableCell>
                            <div className="flex flex-col">
                                <span className="font-bold text-xs">{item.name}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{item.clave}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input 
                                type="number" 
                                min={1} 
                                className="h-8 text-center font-bold" 
                                value={item.quantity}
                                onChange={e => updateItemQuantity(item.medicationId, parseInt(e.target.value) || 1)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input 
                                placeholder="Ej: 1 cada 8 hrs por 7 días..." 
                                className="h-8 text-xs"
                                value={item.indications || ''}
                                onChange={e => updateItemIndications(item.medicationId, e.target.value)}
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
                            <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">
                                <Pill className="h-12 w-12 mx-auto mb-2 opacity-10" />
                                No has agregado medicamentos a la receta.
                            </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
               </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 border-t bg-muted/10 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || prescriptionItems.length === 0 || !selectedPatient}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Confirmar y Guardar Receta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
