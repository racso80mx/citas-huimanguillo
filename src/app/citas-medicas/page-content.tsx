'use client';
import { useState, useCallback, useEffect, useTransition, useMemo } from 'react';
import React from 'react';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import { BookingForm } from '@/components/booking-form';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DailyAvailability, Colonia, Clinic, Holiday, SpecialActionDay, ServiceType, Specialty } from '@/lib/definitions';
import { PatientType, BookingMode } from '@/lib/definitions';
import { getAppointments, getClinics, getHolidays, getServiceTypes, verifyCitasMedicasPassword, getColonias } from '@/lib/actions';

import { useToast } from '@/hooks/use-toast';
import { Bell, CheckCircle2, XCircle, MapPin } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSaturday, isSunday, startOfToday } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ModuleLoginForm } from '@/components/shared/module-login-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type PageContentProps = {
    initialAnnouncements: string[];
    initialColonias: Colonia[];
    initialClinics: Clinic[];
    initialHolidays: Holiday[];
    initialSpecialActionDays: SpecialActionDay[];
    initialServiceTypes: ServiceType[];
    initialSpecialties: Specialty[];
};

export default function PageContent({ 
    initialAnnouncements, 
    initialColonias, 
    initialClinics, 
    initialHolidays, 
    initialServiceTypes,
}: PageContentProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [selectedServiceTypeId, setSelectedServiceTypeId] = React.useState<string | undefined>();
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [patientType, setPatientType] = React.useState<PatientType>(PatientType.General);
  const [isDoubleSlot, setIsDoubleSlot] = React.useState(false);
  const [selectedClinicId, setSelectedClinicId] = React.useState<string | undefined>();
  const [selectedColoniaId, setSelectedColoniaId] = React.useState<string | undefined>();
  const [selectedTime, setSelectedTime] = React.useState<string | undefined>();
  
  const [availability, setAvailability] = React.useState<DailyAvailability[]>([]);
  const [announcements] = React.useState<string[]>(initialAnnouncements);
  const [colonias] = React.useState<Colonia[]>(initialColonias);
  const [clinics] = React.useState<Clinic[]>(initialClinics);
  const [serviceTypes] = React.useState<ServiceType[]>(initialServiceTypes);
  
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToast();

  const generateDynamicTimeSlots = React.useCallback((startTimeStr: string, endTimeStr: string, duration: number): string[] => {
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
  }, []);

  const fetchAvailability = React.useCallback(async (year: number, month: number) => {
      const startDate = startOfMonth(new Date(year, month));
      const endDate = endOfMonth(new Date(year, month));
      
      const [allAppointments, freshHolidays] = await Promise.all([
        getAppointments(), getHolidays()
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

      const availabilityResult: DailyAvailability[] = [];
      const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

      for (const day of daysInMonth) {
        const dateString = day.toISOString().split('T')[0];
        const dayMap = groupedApps.get(dateString);
        
        let totalAvailableSlots = 0;
        const availabilityByClinic: { [key: string]: number } = {};
        const takenTimesByClinic: { [key: string]: any[] } = {};

        for (const clinic of clinics) {
            const isHoliday = holidaySet.has(dateString);
            const isSpecialDay = isSaturday(day) || isSunday(day) || isHoliday;
            
            let availableSlotsForClinic = 0;
            let takenInfo: any[] = [];

            const isBlocked = clinic.unavailableDates?.includes(dateString) || (isSpecialDay && !clinic.weekendBookingEnabled);

            if (!isBlocked) {
                const booked = dayMap?.get(clinic.id) || [];
                if (clinic.bookingMode === BookingMode.Time && clinic.consultationDuration) {
                    const customSchedule = clinic.customSchedules?.find(s => s.date === dateString);
                    const endTime = customSchedule ? customSchedule.endTime : clinic.endTime;
                    const slots = generateDynamicTimeSlots(clinic.startTime, endTime, clinic.consultationDuration);
                    availableSlotsForClinic = slots.filter(s => !booked.some(a => a.time === s)).length;
                } else {
                    availableSlotsForClinic = Math.max(0, clinic.dailySlots - booked.length);
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
  }, [clinics, generateDynamicTimeSlots]);

  React.useEffect(() => {
    if (isAuthenticated) {
        startTransition(() => {
            fetchAvailability(currentMonth.getFullYear(), currentMonth.getMonth());
        });
    }
  }, [isAuthenticated, fetchAvailability, currentMonth]);

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date && date < startOfToday()) {
        toast({ title: 'Fecha no válida', description: 'No puedes seleccionar una fecha en el pasado.', variant: 'destructive' });
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
    setSelectedTime(undefined);
  };

  const handleColoniaSelect = (coloniaId: string) => {
      setSelectedColoniaId(coloniaId);
      setSelectedTime(undefined);
  };

  const fetchData = useCallback(() => {
     startTransition(() => {
         fetchAvailability(currentMonth.getFullYear(), currentMonth.getMonth());
     });
  }, [currentMonth, fetchAvailability]);

  const selectedClinic = useMemo(() => clinics.find(c => c.id === selectedClinicId), [selectedClinicId, clinics]);
  const selectedColonia = useMemo(() => colonias.find(c => c.id === selectedColoniaId), [selectedColoniaId, colonias]);
  
  const selectedDayAvailability = React.useMemo(() => {
    if (!selectedDate) return null;
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return availability.find((d) => d.date === dateString) || null;
  }, [selectedDate, availability]);

  const clinicOptions = React.useMemo(() => {
    if (!selectedDayAvailability || !selectedServiceTypeId) return [];
    return clinics
        .filter(c => c.serviceTypeId === selectedServiceTypeId)
        .map(clinic => {
            const slots = selectedDayAvailability.availabilityByClinic[clinic.id] ?? 0;
            return { 
                value: clinic.id, 
                label: clinic.name, 
                disabled: slots === 0,
                slots: slots
            };
        }).sort((a,b) => a.label.localeCompare(b.label));
  }, [clinics, selectedDayAvailability, selectedServiceTypeId]);

  const filteredColonias = React.useMemo(() => {
    if (!selectedClinicId) return [];
    return colonias.filter(c => c.clinicId === selectedClinicId).sort((a,b) => a.name.localeCompare(b.name));
  }, [colonias, selectedClinicId]);

  const availableTimeSlots = React.useMemo(() => {
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
  }, [selectedClinic, selectedDayAvailability, selectedDate, generateDynamicTimeSlots, patientType, isDoubleSlot]);

  const availableTokens = React.useMemo(() => {
    if (!selectedClinic || !selectedDayAvailability || selectedClinic.bookingMode !== BookingMode.Token) return [];
    const booked = selectedDayAvailability.takenTimesByClinic[selectedClinic.id] || [];
    const totalSlots = selectedClinic.dailySlots;
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

  if (!isAuthenticated) return <ModuleLoginForm title="Citas Médicas" onVerify={verifyCitasMedicasPassword} onSuccess={() => setIsAuthenticated(true)} />;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="text-primary mb-4"><Image src={logoBase64} alt="Logo" width={80} height={80} className="rounded-md" /></div>
        <h1 className="text-4xl lg:text-5xl font-bold font-headline">Agenda tu Cita Médica</h1>
      </div>

      <Card className="w-full max-w-5xl mx-auto shadow-xl">
        <CardContent className="p-4 md:p-8 grid md:grid-cols-2 gap-8">
            <div className="space-y-8">
                <div>
                    <h3 className="text-2xl font-semibold font-headline mb-4 flex items-center gap-2">
                        <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">1</span>
                        Tipo de Consulta
                    </h3>
                    <Select onValueChange={setSelectedServiceTypeId} value={selectedServiceTypeId}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger>
                        <SelectContent>
                            {serviceTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {selectedServiceTypeId && (
                    <div className="animate-in fade-in zoom-in-95">
                        <AvailabilityCalendar selectedDate={selectedDate} onDateSelect={handleDateSelect} availability={availability} onMonthChange={handleMonthChange} isLoading={isPending} />
                    </div>
                )}
                {selectedDate && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <h3 className="text-2xl font-semibold font-headline flex items-center gap-2">
                            <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">2</span>
                            Tipo de Paciente
                        </h3>
                        <Select onValueChange={(v: PatientType) => setPatientType(v)} value={patientType}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger>
                            <SelectContent>
                                {Object.values(PatientType).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {patientType === PatientType.Embarazada && (
                            <div className="flex items-center space-x-2 p-3 bg-pink-50 border border-pink-100 rounded-lg animate-in slide-in-from-top-2">
                                <Checkbox id="double-slot" checked={isDoubleSlot} onCheckedChange={(v) => setIsDoubleSlot(!!v)} />
                                <Label htmlFor="double-slot" className="text-xs font-bold text-pink-700 uppercase">Solicitar Horario Doble (Consecutivo)</Label>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="space-y-8">
                {selectedDate && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <h3 className="text-2xl font-semibold font-headline mb-4 flex items-center gap-2">
                            <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">3</span>
                            Selecciona tu Unidad
                        </h3>
                        <Select onValueChange={handleClinicSelect} value={selectedClinicId}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Selecciona un núcleo..." /></SelectTrigger>
                            <SelectContent>
                                {clinicOptions.map(opt => (
                                    <SelectItem 
                                        key={opt.value} 
                                        value={opt.value} 
                                        disabled={opt.disabled}
                                        className={cn(
                                            "flex items-center justify-between font-bold h-12",
                                            opt.slots > 0 ? "text-emerald-700 bg-emerald-50/20 hover:bg-emerald-100/50" : "text-rose-500 opacity-60 bg-rose-50/5"
                                        )}
                                    >
                                        <div className="flex items-center justify-between w-full min-w-[200px] gap-4">
                                            <div className="flex items-center gap-2">
                                                {opt.slots > 0 ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                                <span>{opt.label}</span>
                                            </div>
                                            <Badge variant={opt.slots > 0 ? "secondary" : "destructive"} className="text-[9px] font-black uppercase">
                                                {opt.slots > 0 ? `${opt.slots} libres` : "AGOTADO"}
                                            </Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {selectedClinicId && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <h3 className="text-2xl font-semibold font-headline mb-4 flex items-center gap-2">
                            <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">4</span>
                            Selecciona tu Municipio / Localidad
                        </h3>
                        <Select onValueChange={handleColoniaSelect} value={selectedColoniaId}>
                            <SelectTrigger className="h-11 border-primary/40"><SelectValue placeholder="Busca tu colonia..." /></SelectTrigger>
                            <SelectContent>
                                {filteredColonias.length > 0 ? (
                                    filteredColonias.map(c => <SelectItem key={c.id} value={c.id} className="font-bold uppercase text-xs">{c.name}</SelectItem>)
                                ) : (
                                    <div className="p-4 text-center text-sm text-muted-foreground italic">No hay localidades vinculadas.</div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {selectedColoniaId && selectedClinic && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                        <h3 className="text-2xl font-semibold font-headline mb-4 flex items-center gap-2">
                            <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">5</span>
                            Horario / Turno
                        </h3>
                        {selectedClinic.bookingMode === BookingMode.Time ? (
                            <div className="grid grid-cols-3 gap-2">
                                {availableTimeSlots.map(time => (
                                    <Button 
                                        key={time} 
                                        variant={selectedTime === time ? 'default' : 'outline'}
                                        onClick={() => setSelectedTime(time)}
                                        className="font-bold"
                                    >
                                        {time}
                                    </Button>
                                ))}
                                {availableTimeSlots.length === 0 && <p className="col-span-3 text-center text-muted-foreground italic">No hay horarios disponibles para esta configuración.</p>}
                            </div>
                        ) : (
                            <Select onValueChange={setSelectedTime} value={selectedTime}>
                                <SelectTrigger className="h-11 border-primary/40"><SelectValue placeholder="Selecciona una ficha disponible..." /></SelectTrigger>
                                <SelectContent>
                                    {availableTokens.map(token => <SelectItem key={token} value={token} className="font-bold">{token}</SelectItem>)}
                                    {availableTokens.length === 0 && <p className="p-2 text-center text-muted-foreground italic">No hay fichas disponibles.</p>}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                )}
                
                {selectedTime && selectedClinic && (
                    <BookingForm
                        selectedDate={selectedDate}
                        selectedClinic={selectedClinic}
                        selectedColoniaName={selectedColonia?.name}
                        selectedTime={selectedTime}
                        patientType={patientType}
                        isDoubleSlot={isDoubleSlot}
                        onBookingSuccess={() => fetchData()}
                        announcements={announcements}
                        requireColonia={true}
                    />
                )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
