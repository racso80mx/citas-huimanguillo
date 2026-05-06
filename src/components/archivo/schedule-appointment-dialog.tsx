'use client';
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import { BookingForm } from '@/components/booking-form';
import { useToast } from '@/hooks/use-toast';
import { getAppointmentsForCalendar, getAnnouncements, getHolidays, getSpecialActionDays } from '@/lib/actions';
import { Stethoscope, Hospital, MapPin, Clock, Ticket, UserCheck, Bell } from 'lucide-react';
import type { DailyAvailability, Colonia, Clinic, Patient, Holiday, SpecialActionDay } from '@/lib/definitions';
import { PatientType, ClinicType, BookingMode } from '@/lib/definitions';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSaturday, isSunday, startOfToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

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
    const [selectedClinicType, setSelectedClinicType] = React.useState<ClinicType | undefined>();
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
    const [patientType, setPatientType] = React.useState<PatientType>(PatientType.General);
    const [selectedClinicId, setSelectedClinicId] = React.useState<string | undefined>();
    const [selectedColoniaId, setSelectedColoniaId] = React.useState<string | undefined>();
    const [selectedTime, setSelectedTime] = React.useState<string | undefined>();
    
    const [availability, setAvailability] = React.useState<DailyAvailability[]>([]);
    const [announcements, setAnnouncements] = React.useState<string[]>([]);
    
    const [currentMonth, setCurrentMonth] = React.useState(new Date());
    const [isPending, startTransition] = React.useTransition();
    const { toast } = useToast();

    React.useEffect(() => {
        if (isOpen && clinics.length === 1) {
            const singleClinic = clinics[0];
            setSelectedClinicType(singleClinic.clinicType as ClinicType);
            setSelectedClinicId(singleClinic.id);
        }
    }, [isOpen, clinics]);

    React.useEffect(() => {
        async function fetchInitialAnnouncements() {
            setAnnouncements(await getAnnouncements());
        }
        fetchInitialAnnouncements();
    }, []);

    const generateDynamicTimeSlots = (startTimeStr: string, endTimeStr: string, duration: number): string[] => {
        if (!startTimeStr || !endTimeStr || !duration) return [];
        const slots: string[] = [];
        const start = new Date(`1970-01-01T${startTimeStr}:00`);
        const end = new Date(`1970-01-01T${endTimeStr}:00`);

        let current = start;
        while (current < end) {
            slots.push(current.toTimeString().substring(0, 5));
            current = new Date(current.getTime() + duration * 60000);
        }
        return slots;
    };

    const fetchAvailability = React.useCallback(async (year: number, month: number) => {
        const startDate = startOfMonth(new Date(year, month));
        const endDate = endOfMonth(new Date(year, month));

        const [monthAppointments, holidays, specialActionDays] = await Promise.all([
            getAppointmentsForCalendar(month, year),
            getHolidays(),
            getSpecialActionDays()
        ]);
        
        const appsByDateMap = new Map<string, any[]>();
        monthAppointments.forEach(app => {
            const dateKey = app.date.split('T')[0];
            if (!appsByDateMap.has(dateKey)) appsByDateMap.set(dateKey, []);
            appsByDateMap.get(dateKey)!.push(app);
        });

        const availabilityResult: DailyAvailability[] = [];
        const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });
        const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

        const timeToMinutes = (t: string) => {
            if (!t || t.includes('Espera') || t.includes('Ficha')) return -1;
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };

        for (const day of daysInMonth) {
            const dateString = day.toISOString().split('T')[0];
            const appointmentsOnDate = appsByDateMap.get(dateString) || [];

            let totalAvailableSlots = 0;
            const availabilityByClinic: { [key: string]: number } = {};
            const takenTimesByClinic: { [key: string]: any[] } = {};

            const isHoliday = holidays.some(h => h.date === dateString);
            const isWeekend = isSaturday(day) || isSunday(day);
            const isSpecialDay = isWeekend || isHoliday;

            for (const clinic of clinics) {
                const dayOfWeekName = dayNames[day.getUTCDay()];
                
                // Check for Special Action Days (Regionalized blocking)
                const isBlockedBySpecialAction = !isDoctorBypass && specialActionDays.some(
                    s => s.date === dateString && s.clinicType === clinic.clinicType
                );

                const isDayOfAction = clinic.daysOfAction?.includes(dayOfWeekName);
                const isUnavailableDate = clinic.unavailableDates?.includes(dateString);
                const isWeekendAndNotEnabled = isSpecialDay && !clinic.weekendBookingEnabled;
    
                let availableSlotsForClinic = 0;
                let takenInfo: any[] = [];
    
                const isBlocked = !isDoctorBypass && (isDayOfAction || isWeekendAndNotEnabled || isBlockedBySpecialAction);

                if (!isBlocked && !isUnavailableDate) {
                    const bookedAppointments = appointmentsOnDate.filter(
                        (app) => app.clinicId === clinic.id
                    );

                    if (clinic.bookingMode === BookingMode.Time && clinic.consultationDuration) {
                        const duration = clinic.consultationDuration;
                        
                        // Respect custom end time
                        const customSchedule = clinic.customSchedules?.find(s => s.date === dateString);
                        const effectiveEndTime = customSchedule ? customSchedule.endTime : clinic.endTime;

                        const candidateSlots = generateDynamicTimeSlots(clinic.startTime, effectiveEndTime, duration);
                        
                        const unblockedSlots = candidateSlots.filter(slot => {
                            if (slot === clinic.breakTime) return false;
                            const slotStart = timeToMinutes(slot);
                            const slotEnd = slotStart + duration;

                            return !bookedAppointments.some(app => {
                                if (app.time.includes('Espera')) return false;
                                const appStart = timeToMinutes(app.time);
                                const appEnd = appStart + (app.duration || 30);
                                return Math.max(slotStart, appStart) < Math.min(slotEnd, appEnd);
                            });
                        });

                        availableSlotsForClinic = isDoctorBypass ? candidateSlots.length : unblockedSlots.length;
                        const takenWaitlist = bookedAppointments.filter(a => a.time.includes('Espera')).map(a => a.time);
                        const availableWaitlist = (clinic.waitlistSlots || 0) - takenWaitlist.length;
                        availableSlotsForClinic += Math.max(0, availableWaitlist);
                    } else {
                        const totalSlotsForClinic = clinic.dailySlots + (clinic.waitlistSlots || 0);
                        availableSlotsForClinic = isDoctorBypass ? totalSlotsForClinic : Math.max(0, totalSlotsForClinic - bookedAppointments.length);
                    }
                    
                    takenInfo = bookedAppointments.map(app => ({ time: app.time, duration: app.duration }));
                }
    
                availabilityByClinic[clinic.id] = availableSlotsForClinic;
                totalAvailableSlots += availableSlotsForClinic;
                takenTimesByClinic[clinic.id] = takenInfo;
            }

            availabilityResult.push({
              date: dateString,
              availableSlots: totalAvailableSlots,
              availabilityByClinic,
              takenTimesByClinic,
            });
        }
        setAvailability(availabilityResult);
    }, [clinics, isDoctorBypass]);

    React.useEffect(() => {
        async function fetchInitialData() {
            startTransition(async () => {
                const today = new Date();
                try {
                    await fetchAvailability(today.getFullYear(), today.getMonth());
                } catch (error) {
                    console.error("Failed to fetch initial data:", error);
                    toast({
                        title: "Error de Carga",
                        description: "No se pudieron cargar los datos de disponibilidad. Por favor, recarga la página.",
                        variant: "destructive",
                    });
                }
            });
        }
        fetchInitialData();
    }, [fetchAvailability, toast]);

    const handleMonthChange = (month: Date) => {
        setCurrentMonth(month);
        startTransition(async () => {
            await fetchAvailability(month.getFullYear(), month.getMonth());
        });
    };

    const handleRefresh = (reset = true) => {
        startTransition(async () => {
            await fetchAvailability(currentMonth.getFullYear(), currentMonth.getMonth());
            if (reset) {
                onBookingSuccess();
            } else {
                setSelectedTime(undefined);
            }
        });
    }

    const handleClinicTypeSelect = (value: ClinicType) => {
        setSelectedClinicType(value);
        setSelectedDate(undefined);
        setSelectedClinicId(undefined);
        setSelectedColoniaId(undefined);
        setSelectedTime(undefined);
    }

    const handleDateSelect = (date: Date | undefined) => {
        if (date && !isDoctorBypass && date < startOfToday()) {
            toast({ title: 'Fecha no válida', description: 'No puedes seleccionar una fecha en el pasado.', variant: 'destructive' });
            return;
        }
        setSelectedDate(date);
        if (clinics.length !== 1) {
            setSelectedClinicId(undefined);
        }
        setSelectedColoniaId(undefined);
        setSelectedTime(undefined);
    };
    
    const handleClinicSelect = (clinicId: string) => { setSelectedClinicId(clinicId); setSelectedColoniaId(undefined); setSelectedTime(undefined); }
    const handleColoniaSelect = (coloniaId: string) => { setSelectedColoniaId(coloniaId); setSelectedTime(undefined); }
    const handleTimeSelect = (time: string) => { setSelectedTime(time); }

    const selectedClinic = React.useMemo(() => clinics.find(c => c.id === selectedClinicId), [selectedClinicId, clinics]);
    const selectedColonia = React.useMemo(() => colonias.find(c => c.id === selectedColoniaId), [selectedColoniaId, colonias]);
    const selectedDayAvailability = React.useMemo(() => {
        if (!selectedDate) return null;
        const dateString = format(selectedDate, 'yyyy-MM-dd');
        return availability.find((d) => d.date === dateString) || null;
    }, [selectedDate, availability]);

    const clinicOptions = React.useMemo(() => {
        if (!selectedDayAvailability || !selectedClinicType) return [];
        const filteredClinics = clinics.filter(c => c.clinicType === selectedClinicType);
        return filteredClinics.map(clinic => ({
            value: clinic.id,
            label: `${clinic.name} (${selectedDayAvailability.availabilityByClinic[clinic.id] ?? 0} citas disponibles)`,
            disabled: !isDoctorBypass && (selectedDayAvailability.availabilityByClinic[clinic.id] ?? 0) === 0,
        })).sort((a,b) => a.label.localeCompare(b.label));
    }, [clinics, selectedDayAvailability, selectedClinicType, isDoctorBypass]);

    const coloniaOptions = React.useMemo(() => {
        if (!selectedClinicId) return [];
        return colonias.filter(c => c.clinicId === selectedClinicId).map(colonia => ({
            value: colonia.id,
            label: colonia.name,
            keywords: colonia.name
        })).sort((a,b) => a.label.localeCompare(b.label));
    }, [colonias, selectedClinicId]);

    const clinicHasColonias = React.useMemo(() => coloniaOptions.length > 0, [coloniaOptions]);
    
    const allTimeSlots = React.useMemo(() => {
        if (!selectedClinic || selectedClinic.bookingMode !== BookingMode.Time || !selectedClinic.consultationDuration || !selectedDate) return [];
        
        const dateString = format(selectedDate, 'yyyy-MM-dd');
        const customSchedule = selectedClinic.customSchedules?.find(s => s.date === dateString);
        const effectiveEndTime = customSchedule ? customSchedule.endTime : selectedClinic.endTime;

        const regularSlots = generateDynamicTimeSlots(selectedClinic.startTime, effectiveEndTime, selectedClinic.consultationDuration);
        const waitlistSlots = Array.from({ length: selectedClinic.waitlistSlots || 0 }, (_, i) => `Espera ${i + 1}`);
        return [...regularSlots, ...waitlistSlots];
    }, [selectedClinic, selectedDate]);

    const availableTimeSlots = React.useMemo(() => {
        if (!selectedDayAvailability || !selectedClinic || selectedClinic.bookingMode !== BookingMode.Time) return [];
        
        const takenInfo = selectedDayAvailability.takenTimesByClinic[selectedClinic.id] || [];
        const duration = selectedClinic.consultationDuration || 30;

        const timeToMinutes = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };

        const now = new Date();
        const isToday = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        return allTimeSlots.filter(candidate => {
            if (candidate === selectedClinic.breakTime) return false;
            
            if (isDoctorBypass) return true; 

            if (candidate.includes('Espera')) {
                return !takenInfo.some(ti => ti.time === candidate);
            }

            const candStart = timeToMinutes(candidate);
            const candEnd = candStart + duration;

            if (isToday && candStart < currentMinutes) return false;

            const hasCollision = takenInfo.some(ti => {
                if (ti.time.includes('Espera')) return false;
                const appStart = timeToMinutes(ti.time);
                const appEnd = appStart + (appStart === -1 ? 0 : (ti.duration || 30));
                return Math.max(candStart, appStart) < Math.min(candEnd, appEnd);
            });

            return !hasCollision;
        });
    }, [selectedDayAvailability, selectedClinic, allTimeSlots, selectedDate, isDoctorBypass]);

    const availableTokens = React.useMemo(() => {
        if (!selectedDayAvailability || !selectedClinic || selectedClinic.bookingMode !== BookingMode.Token) return [];
        const totalSlots = selectedClinic.dailySlots;
        const allPossibleTokens = Array.from({ length: totalSlots }, (_, i) => `Ficha ${i + 1}`);
        const waitlistTokens = Array.from({ length: selectedClinic.waitlistSlots || 0 }, (_, i) => `Espera ${i + 1}`);
        const allOptions = [...allPossibleTokens, ...waitlistTokens];
        
        if (isDoctorBypass) return allOptions;

        const takenTimes = (selectedDayAvailability.takenTimesByClinic?.[selectedClinic.id] || []).map(ti => ti.time);
        return allOptions.filter(token => !takenTimes.includes(token));
    }, [selectedDayAvailability, selectedClinic, isDoctorBypass]);
    
    const isTokenBooking = selectedClinic?.bookingMode === BookingMode.Token;
    const isTimeBooking = selectedClinic?.bookingMode === BookingMode.Time;
    const showColoniaStep = selectedClinicId && clinicHasColonias;
    const showTimeAndFormStep = (selectedClinic && !clinicHasColonias) || selectedColoniaId;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-6xl">
                <DialogHeader>
                    <DialogTitle>Agendar Cita {patient.name ? `para: ${patient.name} ${patient.paternalLastName}` : '(Paciente Nuevo)'}</DialogTitle>
                    <DialogDescription>Sigue los pasos para registrar una nueva cita médica. {isDoctorBypass && <span className="text-green-600 font-bold">(Modo Médico Activado - Urgencia)</span>}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[80vh]">
                    <div className="p-4">
                        <div className="grid md:grid-cols-2 gap-8 items-start">
                            <div className="flex flex-col gap-8">
                                <Card><CardHeader><CardTitle className="text-xl flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" />Tipo de Consulta</CardTitle><CardDescription>Elige el tipo de consulta que necesitas.</CardDescription></CardHeader>
                                    <CardContent>
                                        <Select onValueChange={handleClinicTypeSelect} value={selectedClinicType} disabled={clinics.length === 1}><SelectTrigger><SelectValue placeholder="Selecciona un tipo de consulta" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={ClinicType.ConsultaExterna}>Consulta Externa</SelectItem>
                                                <SelectItem value={ClinicType.Especializada}>Consulta Externa Especializada</SelectItem>
                                                <SelectItem value={ClinicType.Psicologia}>Psicología</SelectItem>
                                                <SelectItem value={ClinicType.Nutricion}>Nutrición</SelectItem>
                                                <SelectItem value={ClinicType.Odontologia}>Odontología</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </CardContent>
                                </Card>
                                {selectedClinicType && <AvailabilityCalendar selectedDate={selectedDate} onDateSelect={handleDateSelect} availability={availability} onMonthChange={handleMonthChange} isLoading={isPending} />}
                                {selectedDate && <Card><CardHeader><CardTitle className="text-xl flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" />Tipo de Paciente</CardTitle><CardDescription>Esto nos ayuda a dirigir tu cita correctamente.</CardDescription></CardHeader><CardContent><Select onValueChange={(value: PatientType) => setPatientType(value)} value={patientType}><SelectTrigger><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger><SelectContent><SelectItem value={PatientType.General}>General</SelectItem><SelectItem value={PatientType.Cronico}>Paciente Crónico</SelectItem><SelectItem value={PatientType.Embarazada}>Embarazada</SelectItem><SelectItem value={PatientType.TerceraEdad}>Tercera Edad</SelectItem><SelectItem value={PatientType.RecienNacido}>Recién Nacido (sin CURP)</SelectItem></SelectContent></Select></CardContent></Card>}
                                {selectedDate && selectedDayAvailability && (
                                    <Card className="bg-card">
                                        <CardHeader>
                                            <CardTitle className="text-xl flex items-center gap-2">
                                                <Hospital className="h-5 w-5 text-primary" />
                                                Núcleos con citas para el {format(selectedDate, 'PPP', { locale: es })}
                                            </CardTitle>
                                            <CardDescription>Elige el núcleo básico al que perteneces.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <Select onValueChange={handleClinicSelect} value={selectedClinicId} disabled={clinics.length === 1}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona un núcleo..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {clinicOptions.map(opt => (
                                                        <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled} className={cn(!opt.disabled ? "font-bold text-green-700" : "text-red-600")}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </CardContent>
                                    </Card>
                                )}
                                {showColoniaStep && <Card className="bg-card"><CardHeader><CardTitle className="text-xl flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />Municipio de residencia</CardTitle><CardDescription>Busca y selecciona tu municipio.</CardDescription></CardHeader><CardContent><Combobox options={coloniaOptions} value={selectedColoniaId || ''} onChange={handleColoniaSelect} placeholder="Busca y selecciona tu municipio..." searchPlaceholder="Escribe para buscar..." noResultsText="No se encontraron municipios para este núcleo." /></CardContent></Card>}
                            </div>
                            <div className="flex flex-col gap-8">
                                {showTimeAndFormStep && (
                                    <>
                                        {isTimeBooking && <Card className="bg-card"><CardHeader><CardTitle className="text-xl flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Horarios para {selectedClinic?.name}</CardTitle><CardDescription>Selecciona un horario disponible o lista de espera.</CardDescription></CardHeader><CardContent className="grid grid-cols-3 gap-2">{availableTimeSlots.length > 0 ? availableTimeSlots.map(time => (<button key={time} onClick={() => handleTimeSelect(time)} className={cn("w-full p-2 border rounded-md text-center transition-colors font-medium", selectedTime === time ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent', time.startsWith('Espera') && 'border-yellow-500 text-yellow-700')}>{time}</button>)) : <p className="col-span-3 text-center text-muted-foreground">No hay espacios disponibles.</p>}</CardContent></Card>}
                                        {isTokenBooking && <Card className="bg-card"><CardHeader><CardTitle className="text-xl flex items-center gap-2"><Ticket className="h-5 w-5 text-primary" />Fichas Disponibles</CardTitle><CardDescription>Este núcleo asigna fichas. Hay {availableTokens.length} espacios disponibles.</CardDescription></CardHeader><CardContent><Select onValueChange={(value) => setSelectedTime(value)} value={selectedTime}><SelectTrigger><SelectValue placeholder="Selecciona una ficha..." /></SelectTrigger><SelectContent>{availableTokens.length > 0 ? (availableTokens.map(token => (<SelectItem key={token} value={String(token)} className={token.startsWith('Espera') ? 'text-yellow-700' : ''}>{token}</SelectItem>))) : (<p className="p-4 text-sm text-muted-foreground">No hay espacios disponibles.</p>)}</SelectContent></Select></CardContent></Card>}
                                    </>
                                )}
                                <BookingForm
                                    initialPatientData={patient.id ? patient : null}
                                    selectedDate={selectedDate}
                                    selectedClinic={selectedClinic}
                                    selectedColoniaName={selectedColonia?.name}
                                    selectedTime={selectedTime}
                                    patientType={patientType}
                                    onBookingSuccess={handleRefresh}
                                    announcements={announcements}
                                    requireColonia={clinicHasColonias}
                                    isDoctorBypass={isDoctorBypass}
                                />
                                {announcements && announcements.length > 0 && <Card className="shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2 text-xl font-headline"><Bell className="h-5 w-5 text-primary" />Avisos Importantes</CardTitle></CardHeader><CardContent><ul className="space-y-2 text-muted-foreground list-disc pl-5">{announcements.map((announcement, index) => (<li key={index}>{announcement}</li>))}</ul></CardContent></Card>}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
