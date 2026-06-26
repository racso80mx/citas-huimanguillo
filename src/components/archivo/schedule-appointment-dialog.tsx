'use client';
import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import { BookingForm } from '@/components/booking-form';
import { useToast } from '@/hooks/use-toast';
import { getHolidays, getServiceTypes, getAppointments, getSpecialActionDays } from '@/lib/actions';
import { CheckCircle2, XCircle, Loader2, MapPin, Info } from 'lucide-react';
import type { DailyAvailability, Clinic, Patient, Holiday, ServiceType, Colonia } from '@/lib/definitions';
import { PatientType, BookingMode } from '@/lib/definitions';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSaturday, isSunday, startOfToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';

type ScheduleAppointmentDialogProps = {
    patient: Patient;
    isOpen: boolean;
    onClose: () => void;
    onBookingSuccess: () => void;
    clinics: Clinic[];
    colonias: Colonia[];
    isDoctorBypass?: boolean;
};

export function ScheduleAppointmentDialog({ patient, isOpen, onClose, onBookingSuccess, clinics, colonias, isDoctorBypass = false }: ScheduleAppointmentDialogProps) {
    const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
    const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string | undefined>();
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [patientType, setPatientType] = useState<PatientType>(PatientType.General);
    const [isDoubleSlot, setIsDoubleSlot] = useState(false);
    const [selectedClinicId, setSelectedClinicId] = useState<string | undefined>();
    const [selectedColoniaId, setSelectedColoniaId] = useState<string | undefined>();
    const [manualColonia, setManualColonia] = useState('');
    const [selectedTime, setSelectedTime] = useState<string | undefined>();
    
    const [availability, setAvailability] = useState<DailyAvailability[]>([]);
    
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const isSpecialized = useMemo(() => {
        const type = serviceTypes.find(t => t.id === selectedServiceTypeId);
        return type?.name.toUpperCase().includes('ESPECIALIZADA');
    }, [selectedServiceTypeId, serviceTypes]);

    useEffect(() => {
        if (isOpen) {
            getServiceTypes().then(types => {
                setServiceTypes(types);
                // Pre-select specialized
                const specialized = types.find(t => t.name.toUpperCase().includes('ESPECIALIZADA'));
                if (specialized) setSelectedServiceTypeId(specialized.id);
            });
            if (patient.age && patient.age > 60) setPatientType(PatientType.TerceraEdad);
            
            // Pre-fill manual locality from patient record
            if (patient.coloniaName) {
                setManualColonia(patient.coloniaName.toUpperCase());
            }
        }
    }, [isOpen, patient]);

    const generateDynamicTimeSlots = (startTimeStr: string, endTimeStr: string, duration: number): string[] => {
        if (!startTimeStr || !endTimeStr || !duration) return [];
        const slots: string[] = [];
        try {
            const start = new Date(`1970-01-01T${startTimeStr}:00`);
            const end = new Date(`1970-01-01T${endTimeStr}:00`);
            let current = start;
            while (current < end) {
                slots.push(current.toTimeString().substring(0, 5));
                current = new Date(current.getTime() + duration * 60000);
            }
        } catch (e) {}
        return slots;
    };

    const fetchAvailability = React.useCallback(async (year: number, month: number) => {
        const startDate = startOfMonth(new Date(year, month));
        const endDate = endOfMonth(new Date(year, month));

        const [allAppointments, freshHolidays, freshSpecialActionDays] = await Promise.all([
            getAppointments(),
            getHolidays(),
            getSpecialActionDays()
        ]);
        
        const holidaySet = new Set(freshHolidays.map(h => h.date));
        const groupedApps = new Map<string, Map<string, any[]>>();
        allAppointments.forEach(app => {
            const d = app.date.split('T')[0];
            if (!groupedApps.has(d)) groupedApps.set(d, new Map());
            const dayMap = groupedApps.get(d)!;
            if (!dayMap.has(app.clinicId)) dayMap.set(app.clinicId, []);
            dayMap.get(app.clinicId)!.push(app);
        });

        const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const availabilityResult: DailyAvailability[] = [];
        const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

        for (const day of daysInMonth) {
            const dateString = day.toISOString().split('T')[0];
            const dayMap = groupedApps.get(dateString);
            const dayName = dayNames[day.getDay()];
            
            let totalAvailableSlots = 0;
            const availabilityByClinic: { [key: string]: number } = {};
            const takenTimesByClinic: { [key: string]: any[] } = {};

            const isHoliday = holidaySet.has(dateString);
            const isWeekend = isSaturday(day) || isSunday(day);
            const isSpecialDay = isWeekend || isHoliday;

            for (const clinic of clinics) {
                const worksOnThisDay = !clinic.daysOfAction || clinic.daysOfAction.length === 0 || clinic.daysOfAction.includes(dayName);
                const isDateBlocked = clinic.unavailableDates?.includes(dateString);
                const isWeekendBlocked = isSpecialDay && !clinic.weekendBookingEnabled;

                const isSpecialActionDay = freshSpecialActionDays.some(sad => 
                    sad.date === dateString && 
                    (sad.clinicType === clinic.serviceTypeId || 
                     serviceTypes.find(t => t.id === clinic.serviceTypeId)?.name === sad.clinicType)
                );

                const isBlocked = !isDoctorBypass && (isDateBlocked || !worksOnThisDay || isWeekendBlocked || isSpecialActionDay);

                let availableSlotsForClinic = 0;
                let takenInfo: any[] = [];

                if (!isBlocked) {
                    const booked = dayMap?.get(clinic.id) || [];
                    if (clinic.bookingMode === BookingMode.Time && clinic.consultationDuration) {
                        const customSchedule = clinic.customSchedules?.find(s => s.date === dateString);
                        const endTime = customSchedule ? customSchedule.endTime : clinic.endTime;
                        const slots = generateDynamicTimeSlots(clinic.startTime, endTime, clinic.consultationDuration);
                        availableSlotsForClinic = slots.filter(s => !booked.some(a => a.time === s)).length;
                    } else {
                        availableSlotsForClinic = Math.max(0, (clinic.dailySlots || 15) - booked.length);
                    }
                    takenInfo = booked.map(a => ({ time: a.time, duration: a.duration }));
                }
                availabilityByClinic[clinic.id] = availableSlotsForClinic;
                totalAvailableSlots += availableSlotsForClinic;
                takenTimesByClinic[clinic.id] = takenInfo;
            }
            availabilityResult.push({ date: dateString, availableSlots: totalAvailableSlots, availabilityByClinic, takenTimesByClinic });
        }
        setAvailability(availabilityResult);
    }, [clinics, isDoctorBypass, serviceTypes]);

    useEffect(() => {
        if (isOpen) {
            startTransition(() => {
                fetchAvailability(currentMonth.getFullYear(), currentMonth.getMonth());
            });
        }
    }, [isOpen, currentMonth, fetchAvailability]);

    const handleDateSelect = (date: Date | undefined) => {
        if (date && !isDoctorBypass && date < startOfToday()) {
            toast({ title: 'Fecha no válida', description: 'No puedes agendar en el pasado.', variant: 'destructive' });
            return;
        }
        setSelectedDate(date);
        setSelectedClinicId(undefined);
        setSelectedColoniaId(undefined);
        setSelectedTime(undefined);
    };

    const handleClinicSelect = (clinicId: string) => {
        setSelectedClinicId(clinicId);
        setSelectedColoniaId(undefined);
        
        // Try to auto-select locality if it matches patient record
        if (patient.coloniaName) {
            const match = colonias.find(c => 
                c.clinicId === clinicId && 
                c.name.toUpperCase() === patient.coloniaName?.toUpperCase()
            );
            if (match) {
                setSelectedColoniaId(match.id);
            }
        }
        
        setSelectedTime(undefined);
    };

    const handleColoniaSelect = (coloniaId: string) => {
        setSelectedColoniaId(coloniaId);
        setManualColonia('');
        setSelectedTime(undefined);
    }

    const handleMonthChange = (month: Date) => {
        setCurrentMonth(month);
    };

    const selectedClinic = useMemo(() => clinics.find(c => c.id === selectedClinicId), [selectedClinicId, clinics]);
    const selectedColonia = useMemo(() => colonias.find(c => c.id === selectedColoniaId), [selectedColoniaId, colonias]);
    
    const selectedDayAvailability = useMemo(() => {
        if (!selectedDate) return null;
        const dateString = format(selectedDate, 'yyyy-MM-dd');
        return availability.find((d) => d.date === dateString) || null;
    }, [selectedDate, availability]);

    const clinicOptions = useMemo(() => {
        if (!selectedDayAvailability || !selectedServiceTypeId) return [];
        return clinics
            .filter(c => c.serviceTypeId === selectedServiceTypeId)
            .map(clinic => {
                const slots = selectedDayAvailability.availabilityByClinic[clinic.id] ?? 0;
                return { 
                    value: clinic.id, 
                    label: clinic.name, 
                    disabled: !isDoctorBypass && slots === 0,
                    slots: slots
                };
            }).sort((a,b) => a.label.localeCompare(b.label));
    }, [clinics, selectedDayAvailability, selectedServiceTypeId, isDoctorBypass]);

    const filteredColonias = useMemo(() => {
        if (!selectedClinicId) return [];
        return colonias.filter(c => c.clinicId === selectedClinicId).sort((a,b) => a.name.localeCompare(b.name));
    }, [colonias, selectedClinicId]);

    const availableTimeSlots = useMemo(() => {
        if (!selectedClinic || !selectedDayAvailability || selectedClinic.bookingMode !== BookingMode.Time) return [];
        const booked = selectedDayAvailability.takenTimesByClinic[selectedClinic.id] || [];
        const customSchedule = selectedClinic.customSchedules?.find(s => s.date === format(selectedDate!, 'yyyy-MM-dd'));
        const endTime = customSchedule ? customSchedule.endTime : selectedClinic.endTime;
        const allSlots = generateDynamicTimeSlots(selectedClinic.startTime, endTime, selectedClinic.consultationDuration || 30);
        
        const slots = allSlots.filter(s => !booked.some(a => a.time === s));

        if (patientType === PatientType.Embarazada && isDoubleSlot) {
            return slots.filter((slot) => {
                const slotIndex = allSlots.indexOf(slot);
                const nextSlot = allSlots[slotIndex + 1];
                return nextSlot && !booked.some(a => a.time === nextSlot);
            });
        }
        return slots;
    }, [selectedClinic, selectedDayAvailability, selectedDate, patientType, isDoubleSlot]);

    const availableTokens = useMemo(() => {
        if (!selectedClinic || !selectedDayAvailability || selectedClinic.bookingMode !== BookingMode.Token) return [];
        const booked = selectedDayAvailability.takenTimesByClinic[selectedClinic.id] || [];
        const totalSlots = (selectedClinic.dailySlots || 15) + (selectedClinic.waitlistSlots || 0);
        const allTokens = Array.from({ length: totalSlots }, (_, i) => `Ficha ${i + 1}`);
        const freeTokens = allTokens.filter(t => !booked.some(a => a.time === t));

        if (patientType === PatientType.Embarazada && isDoubleSlot) {
            return freeTokens.filter((token) => {
                const tokenNum = parseInt(token.split(' ')[1]);
                const nextToken = `Ficha ${tokenNum + 1}`;
                return freeTokens.includes(nextToken);
            });
        }
        return freeTokens;
    }, [selectedClinic, selectedDayAvailability, patientType, isDoubleSlot]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-6xl">
                <DialogHeader>
                    <DialogTitle>Asignar Cita Médica</DialogTitle>
                    <DialogDescription>
                        Cita para: <span className="font-bold">{patient.name || 'Paciente'} {patient.paternalLastName || ''}</span>.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[80vh]">
                    <div className="grid md:grid-cols-2 gap-8 p-4">
                        <div className="space-y-6">
                            <Card>
                                <CardHeader><CardTitle className="text-lg">1. Categoría</CardTitle></CardHeader>
                                <CardContent>
                                    <Select onValueChange={setSelectedServiceTypeId} value={selectedServiceTypeId}>
                                        <SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                                        <SelectContent>
                                            {serviceTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>
                            {selectedServiceTypeId && (
                                <AvailabilityCalendar 
                                    selectedDate={selectedDate} 
                                    onDateSelect={handleDateSelect} 
                                    availability={availability} 
                                    onMonthChange={handleMonthChange} 
                                    isLoading={isPending} 
                                />
                            )}
                            {selectedDate && (
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">2. Tipo de Paciente</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <Select onValueChange={(v: PatientType) => setPatientType(v)} value={patientType}>
                                            <SelectTrigger className="h-11"><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger>
                                            <SelectContent>
                                                {Object.values(PatientType).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        {patientType === PatientType.Embarazada && (
                                            <div className="flex items-center space-x-2 p-3 bg-pink-50 border border-pink-100 rounded-lg animate-in slide-in-from-top-2">
                                                <Checkbox id="diag-double" checked={isDoubleSlot} onCheckedChange={(v) => setIsDoubleSlot(!!v)} />
                                                <Label htmlFor="diag-double" className="text-xs font-bold text-pink-700 uppercase">Horario Doble (Consecutivo)</Label>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                        <div className="space-y-6">
                            {selectedDate && (
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">3. Consultorio</CardTitle></CardHeader>
                                    <CardContent>
                                        <Select onValueChange={handleClinicSelect} value={selectedClinicId}>
                                            <SelectTrigger className="h-11"><SelectValue placeholder="Elige el consultorio..." /></SelectTrigger>
                                            <SelectContent>
                                                {clinicOptions.map(o => (
                                                    <SelectItem 
                                                        key={o.value} 
                                                        value={o.value} 
                                                        disabled={o.disabled}
                                                        className={cn(
                                                            "font-bold h-12",
                                                            o.slots > 0 ? "text-emerald-700 bg-emerald-50/20" : "text-rose-500 opacity-60 bg-rose-50/5"
                                                        )}
                                                    >
                                                        <div className="flex items-center justify-between w-full min-w-[200px] gap-4">
                                                            <div className="flex items-center gap-2">
                                                                {o.slots > 0 ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                                                <span>{o.label}</span>
                                                            </div>
                                                            <Badge variant={o.slots > 0 ? "secondary" : "destructive"} className="text-[9px] font-black uppercase">
                                                                {o.slots > 0 ? `${o.slots} LIBRES` : "AGOTADO"}
                                                            </Badge>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </CardContent>
                                </Card>
                            )}
                            
                            {selectedClinicId && (
                                <Card className="animate-in fade-in">
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <MapPin className="h-5 w-5 text-primary" /> 4. Localidad
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase opacity-60">Seleccionar del Catálogo</Label>
                                            <Select onValueChange={handleColoniaSelect} value={selectedColoniaId}>
                                                <SelectTrigger className="h-11 border-primary/40">
                                                    <SelectValue placeholder="Busca la colonia..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {filteredColonias.length > 0 ? (
                                                        filteredColonias.map(c => <SelectItem key={c.id} value={c.id} className="font-bold uppercase text-xs">{c.name}</SelectItem>)
                                                    ) : (
                                                        <div className="p-4 text-center text-sm text-muted-foreground italic">No hay localidades vinculadas a este consultorio.</div>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2 border-t pt-4">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-black uppercase text-primary">Captura Manual (Especializada o Libre):</Label>
                                                {patient.coloniaName && <Badge variant="outline" className="text-[9px] bg-primary/5">Dato actual: {patient.coloniaName}</Badge>}
                                            </div>
                                            <Input 
                                                placeholder="ESCRIBE EL NOMBRE DE LA LOCALIDAD O PROCEDENCIA..." 
                                                value={manualColonia} 
                                                onChange={(e) => {
                                                    setManualColonia(e.target.value.toUpperCase());
                                                    if (e.target.value) setSelectedColoniaId(undefined);
                                                }}
                                                className="h-11 font-black uppercase border-primary/30"
                                            />
                                            <p className="text-[10px] text-muted-foreground italic">* En consulta especializada el municipio no es obligatorio en catálogo.</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {(selectedColoniaId || manualColonia || isSpecialized) && selectedClinic && (
                                <Card className="animate-in fade-in">
                                    <CardHeader><CardTitle className="text-lg">5. Horario</CardTitle></CardHeader>
                                    <CardContent>
                                        {selectedClinic?.bookingMode === BookingMode.Time ? (
                                            <div className="grid grid-cols-3 gap-2">
                                                {availableTimeSlots.map(t => <Button key={t} variant={selectedTime === t ? 'default' : 'outline'} onClick={() => setSelectedTime(t)} size="sm" className="font-bold">{t}</Button>)}
                                                {availableTimeSlots.length === 0 && <p className="col-span-3 text-center text-muted-foreground italic text-xs">No hay espacios disponibles.</p>}
                                            </div>
                                        ) : (
                                            <Select onValueChange={setSelectedTime} value={selectedTime}>
                                                <SelectTrigger className="h-11 font-bold"><SelectValue placeholder="Seleccionar ficha..." /></SelectTrigger>
                                                <SelectContent>{availableTokens.map(t => <SelectItem key={t} value={t} className="font-bold">{t}</SelectItem>)}</SelectContent>
                                            </Select>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                            {selectedTime && selectedClinic && (
                                <div className="animate-in zoom-in-95 duration-500">
                                    <BookingForm
                                        initialPatientData={patient.id ? patient : undefined}
                                        selectedDate={selectedDate}
                                        selectedClinic={selectedClinic}
                                        selectedColoniaName={selectedColonia?.name || manualColonia}
                                        selectedTime={selectedTime}
                                        patientType={patientType}
                                        isDoubleSlot={isDoubleSlot}
                                        onBookingSuccess={() => { onBookingSuccess(); onClose(); }}
                                        announcements={[]}
                                        requireColonia={!isSpecialized}
                                        isDoctorBypass={isDoctorBypass}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
