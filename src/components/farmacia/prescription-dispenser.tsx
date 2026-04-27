'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
    Search, 
    Loader2, 
    FileText, 
    Hospital, 
    History, 
    PackageCheck,
    X,
    Plus,
    User,
    Trash2,
    Pill,
    Calendar as CalendarIcon,
    Download,
    Filter,
    ClipboardList,
    RefreshCw,
    ShieldCheck,
    UserRound
} from 'lucide-react';
import { 
    getPendingPrescriptions, 
    dispensePrescription, 
    getClinics, 
    getMedications, 
    createPrescription, 
    getPatients,
    getPrescriptionHistory
} from '@/lib/actions';
import type { Prescription, Clinic, Medication, Patient } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    format, 
    startOfDay, 
    endOfDay, 
    startOfWeek, 
    endOfWeek, 
    startOfMonth, 
    endOfMonth, 
    parseISO, 
    isWithinInterval 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Combobox } from '../ui/combobox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '../ui/calendar';
import { DateRange } from 'react-day-picker';

export function PrescriptionDispenser() {
    const [view, setActiveView] = useState<'pending' | 'manual'>('pending');
    const [searchFolio, setSearchFolio] = useState('');
    const [clinicFilter, setClinicFilter] = useState('all');
    const [clinics, setClinics] = useState<Clinic[]>([]);
    
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDispensing, setIsDispensing] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    
    const { toast } = useToast();

    // Fetch filters data
    useEffect(() => {
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
                setRefreshTrigger(prev => prev + 1); // Trigger history update
            } else {
                toast({ title: "Error al surtir", description: res.message, variant: "destructive" });
            }
        } finally {
            setIsDispensing(null);
        }
    };

    return (
        <div className="space-y-10">
            <div className="flex gap-2">
                <Button 
                    variant={view === 'pending' ? 'default' : 'outline'} 
                    onClick={() => setActiveView('pending')}
                    className="flex-1 sm:flex-none h-11"
                >
                    <FileText className="mr-2 h-4 w-4" /> Recetas de Núcleos
                </Button>
                <Button 
                    variant={view === 'manual' ? 'default' : 'outline'} 
                    onClick={() => setActiveView('manual')}
                    className="flex-1 sm:flex-none h-11"
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
                                                        {p.doctorLicense && <span className="text-[10px] bg-muted px-1.5 rounded ml-2">CED: {p.doctorLicense}</span>}
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
                                                                    <span className="font-bold text-xs uppercase">{item.name}</span>
                                                                    <div className="flex items-center gap-2 text-[10px] font-mono text-primary font-bold">
                                                                        <span>LOTE: {item.lote || 'N/A'}</span>
                                                                        <span className="opacity-40 text-muted-foreground">| {item.clave}</span>
                                                                    </div>
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
                <ExternalPrescriptionForm onDispenseSuccess={() => { loadPrescriptions(); setRefreshTrigger(prev => prev + 1); }} />
            )}

            <PrescriptionHistory refreshTrigger={refreshTrigger} clinics={clinics} />
        </div>
    );
}

function ExternalPrescriptionForm({ onDispenseSuccess }: { onDispenseSuccess: () => void }) {
    const [patientSearch, setPatientSearch] = useState('');
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    
    // Medical Directory state
    const [allDoctors, setAllDoctors] = useState<Clinic[]>([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [manualDoctor, setManualDoctor] = useState({ name: '', license: '', unit: '' });
    const [isManualDoctor, setIsManualDoctor] = useState(false);
    
    const [medications, setMedications] = useState<Medication[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingInitial, setIsLoadingInitial] = useState(false);

    const { toast } = useToast();

    useEffect(() => {
        setIsLoadingInitial(true);
        Promise.all([getMedications(), getClinics()]).then(([medData, docData]) => {
            setMedications(medData);
            setAllDoctors(docData);
            setIsLoadingInitial(false);
        });
    }, []);

    const selectedDoctor = useMemo(() => {
        return allDoctors.find(d => d.id === selectedDoctorId) || null;
    }, [allDoctors, selectedDoctorId]);

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
        setItems([...items, { medicationId: med.id, name: med.descripcion, clave: med.claveCuadroBasico, quantity: 1, lote: med.lote }]);
    };

    const handleSave = async () => {
        const docName = isManualDoctor ? manualDoctor.name : selectedDoctor?.doctorName;
        const docLicense = isManualDoctor ? manualDoctor.license : selectedDoctor?.professionalLicense;
        const unit = isManualDoctor ? manualDoctor.unit : selectedDoctor?.name;

        if (!selectedPatient || !docName || !unit || items.length === 0) {
            toast({ title: "Faltan datos", description: "Verifica médico, paciente e insumos.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            const resCreate = await createPrescription({
                patientId: selectedPatient.id,
                patientName: `${selectedPatient.name} ${selectedPatient.paternalLastName}`,
                clinicId: isManualDoctor ? 'externo' : (selectedDoctor?.id || 'externo'),
                doctorName: docName,
                doctorLicense: docLicense || '',
                unitName: unit || '',
                date: new Date().toISOString(),
                items,
                type: 'externo'
            });

            if (resCreate.success) {
                const pending = await getPendingPrescriptions({ folio: resCreate.folio });
                if (pending.length > 0) {
                    await dispensePrescription(pending[0].id);
                    toast({ title: "Receta Externa Surtida" });
                    setSelectedPatient(null);
                    setItems([]);
                    setManualDoctor({ name: '', license: '', unit: '' });
                    setSelectedDoctorId('');
                    onDispenseSuccess();
                }
            }
        } finally {
            setIsSaving(false);
        }
    };

    const doctorOptions = useMemo(() => {
        return allDoctors.map(d => ({
            value: d.id,
            label: `${d.doctorName} (${d.name})`,
            keywords: `${d.doctorName} ${d.name} ${d.professionalLicense}`,
            content: (
                <div className="flex flex-col gap-0.5 py-1">
                    <span className="font-bold text-sm uppercase">{d.doctorName}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{d.name} • CED: {d.professionalLicense || 'S/C'}</span>
                </div>
            )
        }));
    }, [allDoctors]);

    const medOptions = useMemo(() => {
        return medications.map(m => ({
            value: m.id,
            label: `${m.descripcion} [Lote: ${m.lote}]`,
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
                        <span className="flex items-center gap-1.5"><CalendarIcon className="h-3 w-3 text-primary" /> VENCE: {m.fechaCaducidad || 'N/A'}</span>
                    </div>
                </div>
            )
        }));
    }, [medications]);

    return (
        <Card className="shadow-lg border-primary/20 bg-primary/5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Captura de Receta Externa</CardTitle>
                <CardDescription>Surtido directo vinculando al personal del hospital o captura manual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Paciente Section */}
                <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase opacity-60">1. Paciente</Label>
                    {!selectedPatient ? (
                        <div className="flex gap-2">
                            <Input placeholder="Buscar por nombre..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchPatients()} />
                            <Button size="sm" onClick={handleSearchPatients} disabled={isSearching}><Search className="h-4 w-4"/></Button>
                        </div>
                    ) : (
                        <div className="p-3 bg-background border rounded-lg flex items-center justify-between shadow-sm">
                            <span className="text-xs font-bold uppercase">{selectedPatient.name} {selectedPatient.paternalLastName}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedPatient(null)}><X className="h-3 w-3"/></Button>
                        </div>
                    )}
                    {patients.length > 0 && !selectedPatient && (
                        <div className="border rounded bg-background p-1 space-y-1 max-h-32 overflow-y-auto shadow-inner">
                            {patients.map(p => <button key={p.id} className="w-full text-left p-2 hover:bg-muted text-xs rounded" onClick={() => setSelectedPatient(p)}>{p.name} {p.paternalLastName}</button>)}
                        </div>
                    )}
                </div>

                <Separator />

                {/* Médico Section */}
                <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase opacity-60">2. Médico que prescribe</Label>
                    {!isManualDoctor ? (
                        <div className="space-y-3">
                            <Combobox 
                                options={doctorOptions}
                                value={selectedDoctorId}
                                onChange={setSelectedDoctorId}
                                placeholder="Selecciona el médico del directorio..."
                                searchPlaceholder="Buscar médico o unidad..."
                                disabled={isLoadingInitial}
                            />
                            {selectedDoctor && (
                                <div className="grid sm:grid-cols-2 gap-4 p-3 rounded-lg border bg-background text-[10px] uppercase font-bold text-muted-foreground animate-in slide-in-from-left-2">
                                    <span>UNIDAD: <span className="text-foreground">{selectedDoctor.name}</span></span>
                                    <span className="text-right">CÉDULA: <span className="text-foreground">{selectedDoctor.professionalLicense || 'N/A'}</span></span>
                                </div>
                            )}
                            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setIsManualDoctor(true)}>Capturar médico manualmente (fuera del hospital)</Button>
                        </div>
                    ) : (
                        <div className="space-y-4 p-4 border rounded-xl bg-background shadow-inner">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase opacity-60">Nombre del Médico</Label>
                                    <Input placeholder="Ej. Dr. Juan Pérez" value={manualDoctor.name} onChange={e => setManualDoctor({...manualDoctor, name: e.target.value.toUpperCase()})} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase opacity-60">Cédula Profesional</Label>
                                    <Input placeholder="Cédula del médico" value={manualDoctor.license} onChange={e => setManualDoctor({...manualDoctor, license: e.target.value.toUpperCase()})} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase opacity-60">Unidad de procedencia</Label>
                                <Input placeholder="Ej. Urgencias, Centro de Salud Rural..." value={manualDoctor.unit} onChange={e => setManualDoctor({...manualDoctor, unit: e.target.value.toUpperCase()})} />
                            </div>
                            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setIsManualDoctor(false)}>Volver al Directorio Médico</Button>
                        </div>
                    )}
                </div>

                <Separator />

                {/* Insumos Section */}
                <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase opacity-60">3. Medicamentos a descontar</Label>
                    <Combobox 
                        options={medOptions} 
                        value="" 
                        onChange={id => {
                            const m = medications.find(x => x.id === id);
                            if (m) handleAddItem(m);
                        }}
                        placeholder="Busca por nombre o lote del medicamento..."
                        searchPlaceholder="Filtrar catálogo..."
                        disabled={isLoadingInitial}
                    />
                    
                    <div className="border rounded-lg bg-background shadow-inner">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase">Medicamento / Lote</TableHead>
                                    <TableHead className="w-[100px] text-center text-[10px] font-black uppercase">Cant.</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold uppercase leading-tight">{item.name}</span>
                                                <span className="text-[10px] font-mono text-primary font-bold mt-0.5">LOTE: {item.lote}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" min={1} className="h-8 text-center font-bold" value={item.quantity} onChange={e => setItems(prev => prev.map((x, i) => i === idx ? {...x, quantity: parseInt(e.target.value) || 1} : x))} />
                                        </TableCell>
                                        <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4"/></Button></TableCell>
                                    </TableRow>
                                ))}
                                {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground text-xs italic">Agrega medicamentos usando el buscador superior.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button className="w-full font-bold h-12 text-lg" onClick={handleSave} disabled={isSaving || items.length === 0 || !selectedPatient}>
                    {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                    SURTIR Y ACTUALIZAR INVENTARIO
                </Button>
            </CardFooter>
        </Card>
    );
}

function PrescriptionHistory({ refreshTrigger, clinics }: { refreshTrigger: number, clinics: Clinic[] }) {
    const [history, setHistory] = useState<Prescription[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'range'>('today');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [searchTerm, setSearchTerm] = useState('');
    
    const { toast } = useToast();

    const loadHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const now = new Date();
            let startDate: string | undefined;
            let endDate: string | undefined;

            switch (filterType) {
                case 'today':
                    startDate = startOfDay(now).toISOString();
                    endDate = endOfDay(now).toISOString();
                    break;
                case 'week':
                    startDate = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
                    endDate = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
                    break;
                case 'month':
                    startDate = startOfMonth(now).toISOString();
                    endDate = endOfMonth(now).toISOString();
                    break;
                case 'range':
                    if (dateRange?.from) {
                        startDate = startOfDay(dateRange.from).toISOString();
                        endDate = endOfDay(dateRange.to || dateRange.from).toISOString();
                    }
                    break;
            }

            if (filterType === 'range' && !startDate) {
                setHistory([]);
                return;
            }

            const data = await getPrescriptionHistory({ startDate, endDate });
            setHistory(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [filterType, dateRange]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory, refreshTrigger]);

    const filteredHistory = useMemo(() => {
        if (!searchTerm) return history;
        const term = searchTerm.toUpperCase();
        return history.filter(p => 
            p.folio.toUpperCase().includes(term) || 
            p.patientName.toUpperCase().includes(term)
        );
    }, [history, searchTerm]);

    const handleDownloadExcel = async () => {
        if (filteredHistory.length === 0) return;
        const xlsx = await import('xlsx');
        
        const data = filteredHistory.flatMap(p => 
            p.items.map(item => ({
                'Folio': p.folio,
                'Fecha Surtido': format(parseISO(p.date), 'dd/MM/yyyy HH:mm'),
                'Paciente': p.patientName,
                'Médico': p.doctorName,
                'Cédula': p.doctorLicense || 'N/A',
                'Unidad/Origen': p.unitName || clinics.find(c => c.id === p.clinicId)?.name || 'Externo',
                'Clave': item.clave,
                'Medicamento': item.name,
                'Lote': item.lote,
                'Cant.': item.quantity,
                'Indicaciones': item.indications || ''
            }))
        );

        const ws = xlsx.utils.json_to_sheet(data);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Historial Surtido');
        xlsx.writeFile(wb, `historial_surtido_${filterType}.xlsx`);
    };

    const handleDownloadPDF = async () => {
        if (filteredHistory.length === 0) return;
        const { jsPDF } = await import('jspdf');
        await import('jspdf-autotable');
        const doc = new jsPDF('landscape') as any;

        doc.setFontSize(18);
        doc.text('Reporte de Medicamentos Surtidos', 14, 15);
        doc.setFontSize(10);
        doc.text(`Filtro: ${filterType.toUpperCase()} | Fecha: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);

        const tableBody = filteredHistory.flatMap(p => 
            p.items.map(item => [
                p.folio,
                format(parseISO(p.date), 'dd/MM/yy HH:mm'),
                p.patientName,
                item.name,
                item.lote,
                item.quantity,
                p.unitName || clinics.find(c => c.id === p.clinicId)?.name || 'EXTERNO'
            ])
        );

        doc.autoTable({
            startY: 30,
            head: [['Folio', 'Fecha/Hora', 'Paciente', 'Insumo', 'Lote', 'Cant.', 'Unidad Origen']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [0, 102, 51], fontSize: 9 },
            styles: { fontSize: 8 }
        });

        doc.save(`reporte_surtido_${filterType}.pdf`);
    };

    return (
        <Card className="shadow-xl border-primary/20">
            <CardHeader className="bg-primary/5 pb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <ClipboardList className="h-6 w-6 text-primary" />
                        <div>
                            <CardTitle className="text-xl">Historial de Medicamentos Surtidos</CardTitle>
                            <CardDescription>Consulta el registro de insumos entregados a pacientes.</CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={filteredHistory.length === 0}>
                            <Download className="mr-2 h-4 w-4" /> Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={filteredHistory.length === 0} className="text-red-700 border-red-200 hover:bg-red-50">
                            <FileText className="mr-2 h-4 w-4" /> PDF
                        </Button>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 mt-6">
                    <div className="flex items-center gap-1 bg-background p-1 border rounded-lg shadow-sm">
                        <Button variant={filterType === 'today' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('today')}>Hoy</Button>
                        <Button variant={filterType === 'week' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('week')}>Semana</Button>
                        <Button variant={filterType === 'month' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterType('month')}>Mes</Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={filterType === 'range' ? 'secondary' : 'ghost'} size="sm" className="gap-2">
                                    <CalendarIcon className="h-3.5 w-3.5" /> {filterType === 'range' ? 'Rango' : ''}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="range" selected={dateRange} onSelect={(r) => { setDateRange(r); setFilterType('range'); }} numberOfMonths={2} locale={es} />
                            </PopoverContent>
                        </Popover>
                    </div>
                    
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar por folio o paciente..." 
                            className="pl-9 h-10"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <Button variant="outline" onClick={loadHistory} disabled={isLoading} className="h-10">
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-40 gap-3">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-sm font-medium text-muted-foreground">Cargando historial...</p>
                        </div>
                    ) : filteredHistory.length > 0 ? (
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-[120px] font-bold">FOLIO</TableHead>
                                    <TableHead className="w-[140px] font-bold">FECHA SURTIDO</TableHead>
                                    <TableHead className="font-bold">PACIENTE</TableHead>
                                    <TableHead className="font-bold">INSUMOS</TableHead>
                                    <TableHead className="w-[180px] font-bold">ORIGEN / MÉDICO</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredHistory.map(p => (
                                    <TableRow key={p.id} className="hover:bg-muted/30">
                                        <TableCell className="font-mono text-xs font-bold text-primary">{p.folio}</TableCell>
                                        <TableCell className="text-xs">
                                            {format(parseISO(p.date), 'dd/MM/yyyy', { locale: es })}
                                            <span className="block text-[10px] text-muted-foreground">{format(parseISO(p.date), 'HH:mm')} hrs</span>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold uppercase">{p.patientName}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1.5 py-1">
                                                {p.items.map((item, idx) => (
                                                    <div key={idx} className="flex items-start gap-2 border-b border-dashed last:border-0 pb-1 mb-1">
                                                        <Badge variant="outline" className="h-5 px-1.5 font-black shrink-0">{item.quantity}</Badge>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold uppercase leading-tight">{item.name}</span>
                                                            <span className="text-[9px] font-mono text-primary/70">LOTE: {item.lote}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-[10px]">
                                            <div className="flex flex-col">
                                                <span className="font-bold uppercase">{p.unitName || clinics.find(c => c.id === p.clinicId)?.name || 'EXTERNO'}</span>
                                                <span className="text-muted-foreground italic">Dr. {p.doctorName}</span>
                                                {p.doctorLicense && <span className="text-primary/70 font-bold">CED: {p.doctorLicense}</span>}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-32 opacity-40">
                            <History className="h-16 w-16 mx-auto mb-4" />
                            <p className="font-bold">No hay registros surtidos</p>
                            <p className="text-sm">Ajusta los filtros o realiza una búsqueda.</p>
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
