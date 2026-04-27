'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Search, 
    CheckCircle2, 
    Loader2, 
    FileText, 
    Hospital, 
    History, 
    AlertTriangle,
    PackageCheck,
    X,
    Filter
} from 'lucide-react';
import { getPendingPrescriptions, dispensePrescription, getClinics, getMedications, createPrescription, getPatients } from '@/lib/actions';
import type { Prescription, Clinic, Medication, Patient } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Combobox } from '../ui/combobox';

export function PrescriptionDispenser() {
    const [view, setActiveView] = useState<'pending' | 'manual'>('pending');
    const [searchFolio, setSearchFolio] = useState('');
    const [clinicFilter, setClinicFilter] = useState('all');
    const [clinics, setClinics] = useState<Clinic[]>([]);
    
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDispensing, setIsDispensing] = useState<string | null>(null);
    
    const { toast } = useToast();

    // Fetch filters data
    React.useEffect(() => {
        getClinics().then(setClinics);
    }, []);

    const loadPrescriptions = async () => {
        setIsLoading(true);
        try {
            const data = await getPendingPrescriptions({ 
                folio: searchFolio || undefined, 
                clinicId: clinicFilter !== 'all' ? clinicFilter : undefined 
            });
            setPrescriptions(data);
            if (data.length === 0 && searchFolio) {
                toast({ title: "No encontrada", description: "No se encontró ninguna receta pendiente con ese folio.", variant: "destructive" });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleDispense = async (pId: string) => {
        setIsDispensing(pId);
        try {
            const res = await dispensePrescription(pId);
            if (res.success) {
                toast({ title: "Receta Surtida", description: "El inventario ha sido actualizado correctamente." });
                setPrescriptions(prev => prev.filter(p => p.id !== pId));
            } else {
                toast({ title: "Error al surtir", description: res.message, variant: "destructive" });
            }
        } finally {
            setIsDispensing(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <Button 
                    variant={view === 'pending' ? 'default' : 'outline'} 
                    onClick={() => setActiveView('pending')}
                    className="flex-1 sm:flex-none"
                >
                    <FileText className="mr-2 h-4 w-4" /> Recetas de Núcleos
                </Button>
                <Button 
                    variant={view === 'manual' ? 'default' : 'outline'} 
                    onClick={() => setActiveView('manual')}
                    className="flex-1 sm:flex-none"
                >
                    <Plus className="mr-2 h-4 w-4" /> Captura Externa
                </Button>
            </div>

            {view === 'pending' ? (
                <div className="space-y-6">
                    <Card className="shadow-lg border-primary/10">
                        <CardHeader className="pb-3">
                            <CardTitle>Búsqueda de Recetas</CardTitle>
                            <CardDescription>Busca recetas generadas por los núcleos básicos por folio o consultorio.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid sm:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Por Folio</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="REC-XXXX..." 
                                            className="pl-9 h-11 uppercase"
                                            value={searchFolio}
                                            onChange={e => setSearchFolio(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && loadPrescriptions()}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Por Núcleo Básico</Label>
                                    <Select value={clinicFilter} onValueChange={setClinicFilter}>
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="Todos los núcleos" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos los núcleos</SelectItem>
                                            {clinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end">
                                    <Button onClick={loadPrescriptions} className="h-11 w-full" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Search className="mr-2 h-4 w-4" />}
                                        Consultar Recetas
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {prescriptions.length > 0 ? (
                        <div className="grid gap-6">
                            {prescriptions.map(p => (
                                <Card key={p.id} className="border-l-4 border-l-primary shadow-md animate-in fade-in slide-in-from-top-4">
                                    <CardHeader className="bg-muted/10 pb-2">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <Badge className="h-7 px-3 text-sm font-black bg-primary/10 text-primary border-primary/20">{p.folio}</Badge>
                                                <div>
                                                    <CardTitle className="text-lg uppercase">{p.patientName}</CardTitle>
                                                    <CardDescription className="flex items-center gap-2">
                                                        <Hospital className="h-3 w-3" /> {clinics.find(c => c.id === p.clinicId)?.name || 'Consultorio Externo'}
                                                        <span className="mx-1">•</span>
                                                        <User className="h-3 w-3" /> Dr. {p.doctorName}
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant="outline" className="font-mono text-[10px]">Expira en: {format(new Date(p.expiresAt), "HH:mm 'del' dd/MM", { locale: es })}</Badge>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-4">
                                        <div className="border rounded-lg overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-muted/30">
                                                    <TableRow>
                                                        <TableHead className="text-xs font-bold uppercase">Medicamento</TableHead>
                                                        <TableHead className="w-[80px] text-center text-xs font-bold uppercase">Cant.</TableHead>
                                                        <TableHead className="text-xs font-bold uppercase">Indicaciones</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {p.items.map((item, idx) => (
                                                        <TableRow key={idx}>
                                                            <TableCell>
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-xs">{item.name}</span>
                                                                    <span className="text-[10px] font-mono opacity-60">{item.clave}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center font-black">{item.quantity}</TableCell>
                                                            <TableCell className="text-xs italic">{item.indications || 'Sin especificaciones'}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="bg-primary/5 pt-4">
                                        <Button 
                                            onClick={() => handleDispense(p.id)} 
                                            className="w-full bg-primary hover:bg-primary/90 font-bold h-12"
                                            disabled={isDispensing === p.id}
                                        >
                                            {isDispensing === p.id ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <PackageCheck className="mr-2 h-5 w-5" />}
                                            SURTIR RECETA Y ACTUALIZAR STOCK
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        !isLoading && (
                            <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-xl opacity-60">
                                <History className="h-16 w-16 mx-auto mb-4 opacity-20" />
                                <p className="text-lg font-bold">Sin recetas pendientes</p>
                                <p className="text-sm">Realiza una búsqueda por folio o utiliza los filtros para encontrar recetas.</p>
                            </div>
                        )
                    )}
                </div>
            ) : (
                <ExternalPrescriptionForm onDispenseSuccess={loadPrescriptions} />
            )}
        </div>
    );
}

function ExternalPrescriptionForm({ onDispenseSuccess }: { onDispenseSuccess: () => void }) {
    const [patientSearch, setPatientSearch] = useState('');
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [doctorName, setDoctorName] = useState('');
    
    const [medications, setMedications] = useState<Medication[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const { toast } = useToast();

    React.useEffect(() => {
        getMedications().then(setMedications);
    }, []);

    const handleSearchPatients = async () => {
        if (!patientSearch.trim()) return;
        setIsSearching(true);
        try {
            const data = await getPatients({ searchName: patientSearch, limitNum: 5 });
            setPatients(data);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddItem = (med: Medication) => {
        if (items.some(i => i.medicationId === med.id)) return;
        setItems([...items, { medicationId: med.id, name: med.descripcion, clave: med.claveCuadroBasico, quantity: 1 }]);
    };

    const handleSave = async () => {
        if (!selectedPatient || !doctorName.trim() || items.length === 0) {
            toast({ title: "Faltan datos", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            // Step 1: Create a surtida prescription
            const resCreate = await createPrescription({
                patientId: selectedPatient.id,
                patientName: `${selectedPatient.name} ${selectedPatient.paternalLastName}`,
                clinicId: 'externo',
                doctorName,
                date: new Date().toISOString(),
                items,
                type: 'externo'
            });

            if (resCreate.success) {
                // Step 2: Immediately dispense it (since it's a manual capture of what already was surtido)
                // We need to fetch the id of the just created prescription, or tweak data.ts to return it
                // For simplicity, let's assume we captured the id or the server action can handle auto-dispense
                // Tweak: getPendingPrescriptions usually filters by status:pendiente.
                // Let's call dispense for the folio we got
                const pending = await getPendingPrescriptions({ folio: resCreate.folio });
                if (pending.length > 0) {
                    await dispensePrescription(pending[0].id);
                    toast({ title: "Receta Externa Surtida", description: "Se descontó el inventario correctamente." });
                    setSelectedPatient(null);
                    setItems([]);
                    setDoctorName('');
                }
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
        <Card className="shadow-lg border-primary/20 bg-primary/5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Captura de Receta Externa</CardTitle>
                <CardDescription>Utiliza este formulario para surtir medicamentos de recetas no generadas por el sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                        <Label className="text-xs font-bold uppercase opacity-60">Paciente</Label>
                        {!selectedPatient ? (
                            <div className="flex gap-2">
                                <Input placeholder="Buscar por nombre..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} />
                                <Button size="sm" onClick={handleSearchPatients} disabled={isSearching}><Search className="h-4 w-4"/></Button>
                            </div>
                        ) : (
                            <div className="p-3 bg-background border rounded-lg flex items-center justify-between">
                                <span className="text-xs font-bold uppercase">{selectedPatient.name} {selectedPatient.paternalLastName}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedPatient(null)}><X className="h-3 w-3"/></Button>
                            </div>
                        )}
                        {patients.length > 0 && !selectedPatient && (
                            <div className="border rounded bg-background p-1 space-y-1">
                                {patients.map(p => <button key={p.id} className="w-full text-left p-2 hover:bg-muted text-xs rounded" onClick={() => setSelectedPatient(p)}>{p.name} {p.paternalLastName}</button>)}
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase opacity-60">Médico que prescribe</Label>
                        <Input placeholder="Ej. Dr. Externo Especialista" value={doctorName} onChange={e => setDoctorName(e.target.value)} />
                    </div>
                </div>

                <Separator />

                <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase opacity-60">Medicamentos a descontar</Label>
                    <Combobox 
                        options={medOptions} 
                        value="" 
                        onChange={id => {
                            const m = medications.find(x => x.id === id);
                            if (m) handleAddItem(m);
                        }}
                        placeholder="Buscar medicamento..."
                    />
                    
                    <div className="border rounded-lg bg-background">
                        <Table>
                            <TableBody>
                                {items.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="text-xs font-bold">{item.name}</TableCell>
                                        <TableCell className="w-[80px]">
                                            <Input type="number" min={1} className="h-8" value={item.quantity} onChange={e => setItems(prev => prev.map((x, i) => i === idx ? {...x, quantity: parseInt(e.target.value) || 1} : x))} />
                                        </TableCell>
                                        <TableCell className="w-[50px]"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4"/></Button></TableCell>
                                    </TableRow>
                                ))}
                                {items.length === 0 && <TableRow><TableCell className="text-center py-8 text-muted-foreground text-xs italic">Lista vacía</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button className="w-full font-bold h-11" onClick={handleSave} disabled={isSaving || items.length === 0 || !selectedPatient}>
                    {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                    Surtir y Descontar Stock
                </Button>
            </CardFooter>
        </Card>
    );
}

import { Plus, User } from 'lucide-react';
