
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
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DailyAvailability, Colonia, Clinic, Holiday, SpecialActionDay, ServiceType, Specialty } from '@/lib/definitions';
import { PatientType, BookingMode } from '@/lib/definitions';
import { getAppointments, getClinics, getHolidays, getSpecialActionDays, getServiceTypes, verifyCitasMedicasPassword } from '@/lib/actions';

import { useToast } from '@/hooks/use-toast';
import { Bell, Clock, MapPin, UserCheck, Ticket, Stethoscope, Hospital, Baby } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSaturday, isSunday, startOfToday } from 'date-fns';
import { es } from 'date-fns/locale';
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
    initialSpecialActionDays,
    initialServiceTypes,
    initialSpecialties
}: PageContentProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [selectedServiceTypeId, setSelectedServiceTypeId] = React.useState<string | undefined>();
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [patientType, setPatientType] = React.useState<PatientType>(PatientType.General);
  const [isDoubleSlot, setIsDoubleSlot] = React.useState(false);
  const [selectedClinicId, setSelectedClinicId] = React.useState<string | undefined>();
  const [selectedTime, setSelectedTime] = React.useState<string | undefined>();
  
  const [availability, setAvailability] = React.useState<DailyAvailability[]>([]);
  const [announcements] = React.useState<string[]>(initialAnnouncements);
  const [colonias] = React.useState<Colonia[]>(initialColonias);
  const [clinics, setClinics] = React.useState<Clinic[]>(initialClinics);
  const [serviceTypes] = React.useState<ServiceType[]>(initialServiceTypes);
  const [specialties] = React.useState<Specialty[]>(initialSpecialties);
  
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
      const [allAppointments, freshHolidays, freshSpecialActionDays] = await Promise.all([
        getAppointments(), getHolidays(), getSpecialActionDays()
      ]);
      
      const availabilityResult: DailyAvailability[] = [];
      const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

      for (const day of daysInMonth) {
        const dateString = day.toISOString().split('T')[0];
        const appointmentsOnDate = allAppointments.filter(a => a.date.split('T')[0] === dateString);
        let totalAvailableSlots = 0;
        const availabilityByClinic: { [key: string]: number } = {};
        const takenTimesByClinic: { [key: string]: any[] } = {};

        for (const clinic of clinics) {
            const isSpecialDay = isSaturday(day) || isSunday(day) || freshHolidays.some(h => h.date === dateString);
            
            let availableSlotsForClinic = 0;
            let takenInfo: any[] = [];

            if (!clinic.unavailableDates?.includes(dateString) && (!isSpecialDay || clinic.weekendBookingEnabled)) {
                const booked = appointmentsOnDate.filter(a => a.clinicId === clinic.id);
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
    setSelectedTime(undefined);
  };

  const handleClinicSelect = (clinicId: string) => {
    setSelectedClinicId(clinicId);
    setSelectedTime(undefined);
  };

  const fetchData = useCallback(() => {
     startTransition(() => {
         fetchAvailability(currentMonth.getFullYear(), currentMonth.getMonth());
     });
  }, [currentMonth, fetchAvailability]);

  const selectedClinic = useMemo(() => clinics.find(c => c.id === selectedClinicId), [selectedClinicId, clinics]);
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
            return { value: clinic.id, label: `${clinic.name} (${slots} disponibles)`, disabled: slots === 0 };
        }).sort((a,b) => a.label.localeCompare(b.label));
  }, [clinics, selectedDayAvailability, selectedServiceTypeId]);

  const availableTimeSlots = React.useMemo(() => {
    if (!selectedClinic || !selectedDayAvailability || selectedClinic.bookingMode !== BookingMode.Time) return [];
    const booked = selectedDayAvailability.takenTimesByClinic[selectedClinic.id] || [];
    const customSchedule = selectedClinic.customSchedules?.find(s => s.date === format(selectedDate!, 'yyyy-MM-dd'));
    const endTime = customSchedule ? customSchedule.endTime : selectedClinic.endTime;
    const allSlots = generateDynamicTimeSlots(selectedClinic.startTime, endTime, selectedClinic.consultationDuration || 30);
    
    return allSlots.filter(s => !booked.some(a => a.time === s));
  }, [selectedClinic, selectedDayAvailability, selectedDate, generateDynamicTimeSlots]);

  const availableTokens = React.useMemo(() => {
    if (!selectedClinic || !selectedDayAvailability || selectedClinic.bookingMode !== BookingMode.Token) return [];
    const booked = selectedDayAvailability.takenTimesByClinic[selectedClinic.id] || [];
    const totalSlots = selectedClinic.dailySlots;
    const allTokens = Array.from({ length: totalSlots }, (_, i) => `Ficha ${i + 1}`);
    return allTokens.filter(t => !booked.some(a => a.time === t));
  }, [selectedClinic, selectedDayAvailability]);

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
                    <h3 className="text-2xl font-semibold font-headline mb-4">1. Tipo de Consulta</h3>
                    <Select onValueChange={setSelectedServiceTypeId} value={selectedServiceTypeId}>
                        <SelectTrigger><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger>
                        <SelectContent>
                            {serviceTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {selectedServiceTypeId && (
                    <AvailabilityCalendar selectedDate={selectedDate} onDateSelect={handleDateSelect} availability={availability} onMonthChange={handleMonthChange} isLoading={isPending} />
                )}
                {selectedDate && (
                    <div className="space-y-4">
                        <h3 className="text-2xl font-semibold font-headline">2. Tipo de Paciente</h3>
                        <Select onValueChange={(v: PatientType) => setPatientType(v)} value={patientType}>
                            <SelectTrigger><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={PatientType.General}>General</SelectItem>
                                <SelectItem value={PatientType.Embarazada}>Embarazada</SelectItem>
                                <SelectItem value={PatientType.TerceraEdad}>Tercera Edad</SelectItem>
                                <SelectItem value={PatientType.Cronico}>Crónico</SelectItem>
                                <SelectItem value={PatientType.RecienNacido}>Recién Nacido</SelectItem>
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
                {selectedDate && (
                    <div>
                        <h3 className="text-2xl font-semibold font-headline mb-4">3. Selecciona tu Unidad</h3>
                        <Select onValueChange={handleClinicSelect} value={selectedClinicId}>
                            <SelectTrigger><SelectValue placeholder="Selecciona un núcleo..." /></SelectTrigger>
                            <SelectContent>
                                {clinicOptions.map(opt => <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
            <div className="space-y-8">
                {selectedClinicId && selectedClinic && (
                    <div>
                        <h3 className="text-2xl font-semibold font-headline mb-4">4. Horario / Turno</h3>
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
                                {availableTimeSlots.length === 0 && <p className="col-span-3 text-center text-muted-foreground italic">No hay horarios disponibles.</p>}
                            </div>
                        ) : (
                            <Select onValueChange={setSelectedTime} value={selectedTime}>
                                <SelectTrigger><SelectValue placeholder="Selecciona una ficha disponible..." /></SelectTrigger>
                                <SelectContent>
                                    {availableTokens.map(token => <SelectItem key={token} value={token}>{token}</SelectItem>)}
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
                        selectedColoniaName={undefined}
                        selectedTime={selectedTime}
                        patientType={patientType}
                        isDoubleSlot={isDoubleSlot}
                        onBookingSuccess={() => fetchData()}
                        announcements={announcements}
                        requireColonia={false}
                    />
                )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
