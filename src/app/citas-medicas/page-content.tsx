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
import { Bell, CheckCircle2, XCircle, MapPin, Hospital, LayoutList, Clock, CalendarDays, CalendarPlus } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';

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
  const [selectedClinicId, setSelectedClinicId] = React.useState<string | undefined>();
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [selectedColoniaId, setSelectedColoniaId] = React.useState<string | undefined>();
  const [patientType, setPatientType] = React.useState<PatientType>(PatientType.General);
  const [isDoubleSlot, setIsDoubleSlot] = React.useState(false);
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
      if (!selectedClinicId) return;
      
      const startDate = startOfMonth(new Date(year, month));
      const endDate = endOfMonth(new Date(year, month));
      
      const [allAppointments, freshHolidays] = await Promise.all([
        getAppointments(), getHolidays()
      ]);
      
      const clinic = clinics.find(c => c.id === selectedClinicId);
      if (!clinic) return;

      const holidaySet = new Set(freshHolidays.map(h => h.date));
      const clinicAppointments = allAppointments.filter(app => app.clinicId === selectedClinicId);
      
      const dayMap = new Map<string, any[]>();
      clinicAppointments.forEach(app => {
          const d = app.date.split('T')[0];
          if (!dayMap.has(d)) dayMap.set(d, []);
          dayMap.get(d)!.push(app);
      });

      const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
      const availabilityResult: DailyAvailability[] = [];
      const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

      for (const day of daysInMonth) {
        const dateString = day.toISOString().split('T')[0];
        const dayBooked = dayMap.get(dateString) || [];
        const dayName = dayNames[day.getDay()];
        
        const isHoliday = holidaySet.has(dateString);
        const isWeekend = isSaturday(day) || isSunday(day);
        const isSpecialDay = isWeekend || isHoliday;
        
        let availableSlotsForClinic = 0;
        let takenInfo = dayBooked.map(a => ({ time: a.time, duration: a.duration }));

        const isDateBlocked = clinic.unavailableDates?.includes(dateString);
        const worksOnThisDay = !clinic.daysOfAction || clinic.daysOfAction.length === 0 || clinic.daysOfAction.includes(dayName);
        const isWeekendBlocked = isSpecialDay && !clinic.weekendBookingEnabled;

        const isBlocked = isDateBlocked || !worksOnThisDay || isWeekendBlocked;

        if (!isBlocked) {
            if (clinic.bookingMode === BookingMode.Time && clinic.consultationDuration) {
                const customSchedule = clinic.customSchedules?.find(s => s.date === dateString);
                const endTime = customSchedule ? customSchedule.endTime : clinic.endTime;
                
                const allSlots = generateDynamicTimeSlots(clinic.startTime, endTime, clinic.consultationDuration);
                const filteredSlots = allSlots.filter(s => s !== clinic.breakTime);
                availableSlotsForClinic = filteredSlots.filter(s => !dayBooked.some(a => a.time === s)).length;
            } else {
                availableSlotsForClinic = Math.max(0, clinic.dailySlots - dayBooked.length);
            }
        }

        availabilityResult.push({ 
            date: dateString, 
            availableSlots: availableSlotsForClinic, 
            availabilityByClinic: { [clinic.id]: availableSlotsForClinic }, 
            takenTimesByClinic: { [clinic.id]: takenInfo } 
        });
      }
      setAvailability(availabilityResult);
  }, [clinics, selectedClinicId, generateDynamicTimeSlots]);

  React.useEffect(() => {
    if (isAuthenticated && selectedClinicId) {
        startTransition(() => {
            fetchAvailability(currentMonth.getFullYear(), currentMonth.getMonth());
        });
    }
  }, [isAuthenticated, fetchAvailability, currentMonth, selectedClinicId]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date && date < startOfToday()) {
        toast({ title: 'Fecha no válida', description: 'No puedes seleccionar una fecha en el pasado.', variant: 'destructive' });
        return;
    }
    setSelectedDate(date);
    setSelectedTime(undefined);
  };

  const handleClinicSelect = (clinicId: string) => {
    setSelectedClinicId(clinicId);
    setSelectedDate(undefined);
    setSelectedColoniaId(undefined);
    setSelectedTime(undefined);
  };

  const handleColoniaSelect = (coloniaId: string) => {
      setSelectedColoniaId(coloniaId);
      setSelectedTime(undefined);
  };

  const selectedClinic = useMemo(() => clinics.find(c => c.id === selectedClinicId), [selectedClinicId, clinics]);
  const selectedColonia = useMemo(() => colonias.find(c => c.id === selectedColoniaId), [selectedColoniaId, colonias]);
  
  const clinicOptions = React.useMemo(() => {
    if (!selectedServiceTypeId) return [];
    return clinics
        .filter(c => c.serviceTypeId === selectedServiceTypeId)
        .map(clinic => ({ 
            value: clinic.id, 
            label: clinic.name,
            doctor: clinic.doctorName
        })).sort((a,b) => a.label.localeCompare(b.label));
  }, [clinics, selectedServiceTypeId]);

  const filteredColonias = React.useMemo(() => {
    if (!selectedClinicId) return [];
    return colonias.filter(c => c.clinicId === selectedClinicId).sort((a,b) => a.name.localeCompare(b.name));
  }, [colonias, selectedClinicId]);

  const availableTimeSlots = React.useMemo(() => {
    if (!selectedClinic || !selectedDate || selectedClinic.bookingMode !== BookingMode.Time) return [];
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const dayAvail = availability.find(d => d.date === dateString);
    if (!dayAvail) return [];

    const booked = dayAvail.takenTimesByClinic[selectedClinic.id] || [];
    const customSchedule = selectedClinic.customSchedules?.find(s => s.date === dateString);
    const endTime = customSchedule ? customSchedule.endTime : selectedClinic.endTime;
    const allSlots = generateDynamicTimeSlots(selectedClinic.startTime, endTime, selectedClinic.consultationDuration || 30);
    
    const slots = allSlots.filter(s => s !== selectedClinic.breakTime && !booked.some(a => a.time === s));

    if (patientType === PatientType.Embarazada && isDoubleSlot) {
        return slots.filter((slot) => {
            const slotIndex = allSlots.indexOf(slot);
            const nextSlot = allSlots[slotIndex + 1];
            return nextSlot && nextSlot !== selectedClinic.breakTime && !booked.some(a => a.time === nextSlot);
        });
    }
    return slots;
  }, [selectedClinic, availability, selectedDate, generateDynamicTimeSlots, patientType, isDoubleSlot]);

  const availableTokens = React.useMemo(() => {
    if (!selectedClinic || !selectedDate || selectedClinic.bookingMode !== BookingMode.Token) return [];
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    const dayAvail = availability.find(d => d.date === dateString);
    if (!dayAvail) return [];

    const booked = dayAvail.takenTimesByClinic[selectedClinic.id] || [];
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
  }, [selectedClinic, availability, selectedDate, patientType, isDoubleSlot]);

  const fetchData = () => {
    if (selectedClinicId) {
        fetchAvailability(currentMonth.getFullYear(), currentMonth.getMonth());
    }
  }

  if (!isAuthenticated) return <ModuleLoginForm title="Citas Médicas" onVerify={verifyCitasMedicasPassword} onSuccess={() => setIsAuthenticated(true)} />;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="text-center mb-10 flex flex-col items-center">
        <div className="text-primary mb-4"><Image src={logoBase64} alt="Logo" width={80} height={80} className="rounded-md" /></div>
        <h1 className="text-4xl lg:text-5xl font-bold font-headline">Agenda tu Cita Médica</h1>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
          {/* COLUMNA IZQUIERDA: CONFIGURACIÓN INICIAL */}
          <div className="lg:col-span-4 space-y-6">
              <Card className="shadow-lg border-primary/10 overflow-hidden">
                <CardContent className="p-6 space-y-8">
                    {/* 1. TIPO DE CONSULTA */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-black uppercase text-primary tracking-widest flex items-center gap-2">
                            <LayoutList className="h-5 w-5" /> 1. Categoría
                        </h3>
                        <Select onValueChange={setSelectedServiceTypeId} value={selectedServiceTypeId}>
                            <SelectTrigger className="h-12 text-base font-bold"><SelectValue placeholder="Elige el servicio..." /></SelectTrigger>
                            <SelectContent>
                                {serviceTypes.map(t => <SelectItem key={t.id} value={t.id} className="font-bold">{t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 2. CONSULTORIO */}
                    {selectedServiceTypeId && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <h3 className="text-lg font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <Hospital className="h-5 w-5" /> 2. Consultorio
                            </h3>
                            <div className="grid gap-2">
                                {clinicOptions.map(opt => (
                                    <button 
                                        key={opt.value}
                                        onClick={() => handleClinicSelect(opt.value)}
                                        className={cn(
                                            "w-full p-4 rounded-xl border-2 text-left transition-all group",
                                            selectedClinicId === opt.value 
                                                ? "bg-primary border-primary text-white shadow-md ring-2 ring-primary/20 scale-[1.02]" 
                                                : "bg-background border-muted hover:border-primary/40 hover:bg-muted/30"
                                        )}
                                    >
                                        <p className="font-black text-sm uppercase leading-none">{opt.label}</p>
                                        <p className={cn("text-[10px] mt-1 font-bold uppercase", selectedClinicId === opt.value ? "text-white/70" : "text-muted-foreground group-hover:text-primary")}>
                                            Dr. {opt.doctor}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 3. CALENDARIO */}
                    {selectedClinicId && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <h3 className="text-lg font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <CalendarDays className="h-5 w-5" /> 3. Selecciona Fecha
                            </h3>
                            <AvailabilityCalendar 
                                selectedDate={selectedDate} 
                                onDateSelect={handleDateSelect} 
                                availability={availability} 
                                onMonthChange={setCurrentMonth} 
                                isLoading={isPending} 
                            />
                        </div>
                    )}
                </CardContent>
              </Card>
          </div>

          {/* COLUMNA DERECHA: LOCALIDAD Y DATOS */}
          <div className="lg:col-span-8 space-y-6">
              {!selectedDate ? (
                  <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl opacity-20 bg-muted/5">
                      <CalendarPlus className="h-20 w-20 mb-4" />
                      <p className="text-2xl font-black uppercase tracking-widest">Espera de Selección</p>
                      <p className="font-bold">Completa los pasos del panel izquierdo para continuar.</p>
                  </div>
              ) : (
                  <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                      <Card className="shadow-xl border-primary/20">
                          <CardContent className="p-8 space-y-10">
                              <div className="grid md:grid-cols-2 gap-10">
                                  {/* 4. MUNICIPIO */}
                                  <div className="space-y-4">
                                      <h3 className="text-lg font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                          <MapPin className="h-5 w-5" /> 4. Tu Localidad
                                      </h3>
                                      <Select onValueChange={handleColoniaSelect} value={selectedColoniaId}>
                                          <SelectTrigger className="h-12 text-base font-bold border-primary/20"><SelectValue placeholder="Busca tu colonia..." /></SelectTrigger>
                                          <SelectContent>
                                              {filteredColonias.length > 0 ? (
                                                  filteredColonias.map(c => <SelectItem key={c.id} value={c.id} className="font-bold uppercase text-xs">{c.name}</SelectItem>)
                                              ) : (
                                                  <div className="p-4 text-center text-sm text-muted-foreground italic">No hay localidades vinculadas a este núcleo.</div>
                                              )}
                                          </SelectContent>
                                      </Select>
                                  </div>

                                  {/* 5. TIPO PACIENTE */}
                                  <div className="space-y-4">
                                      <h3 className="text-lg font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                          <Badge variant="outline" className="border-primary text-primary h-5 text-[10px]">P2</Badge> Tipo de Paciente
                                      </h3>
                                      <Select onValueChange={(v: PatientType) => setPatientType(v)} value={patientType}>
                                          <SelectTrigger className="h-12 text-base font-bold"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                              {Object.values(PatientType).map(t => <SelectItem key={t} value={t} className="font-bold">{t}</SelectItem>)}
                                          </SelectContent>
                                      </Select>
                                      {patientType === PatientType.Embarazada && (
                                          <div className="flex items-center space-x-2 p-3 bg-pink-50 border border-pink-100 rounded-xl animate-in slide-in-from-top-2">
                                              <Checkbox id="d-slot" checked={isDoubleSlot} onCheckedChange={(v) => setIsDoubleSlot(!!v)} />
                                              <Label htmlFor="d-slot" className="text-xs font-black text-pink-700 uppercase">Solicitar Horario Doble (Consecutivo)</Label>
                                          </div>
                                      )}
                                  </div>
                              </div>

                              <Separator className="opacity-50" />

                              {/* 6. HORARIOS */}
                              {selectedColoniaId && (
                                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                      <h3 className="text-lg font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                          <Clock className="h-5 w-5" /> 5. Elige tu Horario
                                      </h3>
                                      {selectedClinic?.bookingMode === BookingMode.Time ? (
                                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                              {availableTimeSlots.map(time => (
                                                  <Button 
                                                      key={time} 
                                                      variant={selectedTime === time ? 'default' : 'outline'}
                                                      onClick={() => setSelectedTime(time)}
                                                      className={cn("h-12 text-sm font-black transition-all", selectedTime === time ? "scale-105 shadow-md" : "")}
                                                  >
                                                      {time}
                                                  </Button>
                                              ))}
                                              {availableTimeSlots.length === 0 && <p className="col-span-full text-center py-10 bg-muted/10 border rounded-xl text-muted-foreground italic">No hay horarios disponibles para el criterio seleccionado.</p>}
                                          </div>
                                      ) : (
                                          <Select onValueChange={setSelectedTime} value={selectedTime}>
                                              <SelectTrigger className="h-12 font-black border-primary/30"><SelectValue placeholder="Selecciona una ficha disponible..." /></SelectTrigger>
                                              <SelectContent>
                                                  {availableTokens.map(token => <SelectItem key={token} value={token} className="font-bold">{token}</SelectItem>)}
                                                  {availableTokens.length === 0 && <p className="p-2 text-center text-muted-foreground italic">No hay fichas disponibles.</p>}
                                              </SelectContent>
                                          </Select>
                                      )}
                                  </div>
                              )}

                              {/* FORMULARIO FINAL */}
                              {selectedTime && (
                                  <div className="pt-4 animate-in fade-in slide-in-from-bottom-6">
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
                                  </div>
                              )}
                          </CardContent>
                      </Card>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
}
