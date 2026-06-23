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
import type { DailyAvailability, Colonia, Clinic, Holiday, SpecialActionDay, Specialty } from '@/lib/definitions';
import { PatientType, BookingMode } from '@/lib/definitions';
import { getAppointments, getClinics, getHolidays, getSpecialActionDays, verifyCitasMedicasPassword } from '@/lib/actions';

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
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

type PageContentProps = {
    initialAnnouncements: string[];
    initialColonias: Colonia[];
    initialClinics: Clinic[];
    initialHolidays: Holiday[];
    initialSpecialActionDays: SpecialActionDay[];
    initialSpecialties: Specialty[];
};

export default function PageContent({ 
    initialAnnouncements, 
    initialColonias, 
    initialClinics, 
    initialHolidays, 
    initialSpecialActionDays,
    initialSpecialties
}: PageContentProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [selectedClinicType, setSelectedClinicType] = React.useState<string | undefined>();
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [patientType, setPatientType] = React.useState<PatientType>(PatientType.General);
  const [isDoubleSlot, setIsDoubleSlot] = React.useState(false);
  const [selectedClinicId, setSelectedClinicId] = React.useState<string | undefined>();
  const [selectedColoniaId, setSelectedColoniaId] = React.useState<string | undefined>();
  const [selectedTime, setSelectedTime] = React.useState<string | undefined>();
  
  const [availability, setAvailability] = React.useState<DailyAvailability[]>([]);
  const [announcements] = React.useState<string[]>(initialAnnouncements);
  const [colonias] = React.useState<Colonia[]>(initialColonias);
  const [clinics, setClinics] = React.useState<Clinic[]>(initialClinics);
  const [holidays, setHolidays] = React.useState<Holiday[]>(initialHolidays);
  const [specialActionDays, setSpecialActionDays] = React.useState<SpecialActionDay[]>(initialSpecialActionDays);
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

      const [allAppointments, freshClinics, freshHolidays, freshSpecialActionDays] = await Promise.all([
        getAppointments(),
        getClinics(),
        getHolidays(),
        getSpecialActionDays()
      ]);
      setClinics(freshClinics);
      setHolidays(freshHolidays);
      setSpecialActionDays(freshSpecialActionDays);
      
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
        const appointmentsOnDate = allAppointments.filter(
          (app) => app.date.split('T')[0] === dateString
        );

        let totalAvailableSlots = 0;
        const availabilityByClinic: { [key: string]: number } = {};
        const takenTimesByClinic: { [key: string]: any[] } = {};

        const isHoliday = freshHolidays.some(h => h.date === dateString);
        const isWeekend = isSaturday(day) || isSunday(day);
        const isSpecialDay = isWeekend || isHoliday;

        for (const clinic of freshClinics) {
            const dayOfWeekName = dayNames[day.getUTCDay()];
            
            const isBlockedBySpecialAction = freshSpecialActionDays.some(
                s => s.date === dateString && s.clinicType === clinic.clinicType
            );

            const isDayOfAction = clinic.daysOfAction?.includes(dayOfWeekName);
            const isUnavailableDate = clinic.unavailableDates?.includes(dateString);
            const isSpecialDayAndNotEnabled = isSpecialDay && !clinic.weekendBookingEnabled;

            let availableSlotsForClinic = 0;
            let takenInfo: any[] = [];

            if (!isDayOfAction && !isUnavailableDate && !isSpecialDayAndNotEnabled && !isBlockedBySpecialAction) {
                const bookedAppointments = appointmentsOnDate.filter(
                    (app) => app.clinicId === clinic.id
                );

                if (clinic.bookingMode === BookingMode.Time && clinic.consultationDuration) {
                    const duration = clinic.consultationDuration;
                    
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

                    availableSlotsForClinic = unblockedSlots.length;
                    const takenWaitlist = bookedAppointments.filter(a => a.time.includes('Espera')).map(a => a.time);
                    const availableWaitlist = (clinic.waitlistSlots || 0) - takenWaitlist.length;
                    availableSlotsForClinic += Math.max(0, availableWaitlist);

                } else {
                    const totalSlotsForClinic = clinic.dailySlots + (clinic.waitlistSlots || 0);
                    availableSlotsForClinic = Math.max(0, totalSlotsForClinic - bookedAppointments.length);
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
  }, [generateDynamicTimeSlots]);

  React.useEffect(() => {
    if (isAuthenticated) {
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
    }
  }, [fetchAvailability, toast, isAuthenticated]);

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
    startTransition(async () => {
      await fetchAvailability(
        month.getFullYear(),
        month.getMonth()
      );
    });
  };

  const refreshData = (reset = true) => {
    startTransition(async () => {
      try {
        await fetchAvailability(currentMonth.getFullYear(), currentMonth.getMonth());
        if (reset) {
            setSelectedClinicType(undefined);
            setSelectedDate(undefined);
            setSelectedClinicId(undefined);
            setSelectedColoniaId(undefined);
            setSelectedTime(undefined);
            setPatientType(PatientType.General);
            setIsDoubleSlot(false);
        } else {
            setSelectedTime(undefined);
        }
      } catch (error) {
          console.error("Failed to refresh data:", error);
           toast({
              title: "Error al Refrescar",
              description: "No se pudieron actualizar los datos.",
              variant: "destructive",
          });
      }
    });
  };

  const handleClinicTypeSelect = (value: string) => {
    setSelectedClinicType(value);
    setSelectedDate(undefined);
    setSelectedClinicId(undefined);
    setSelectedColoniaId(undefined);
    setSelectedTime(undefined);
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      if (date < startOfToday()) {
        toast({
          title: 'Fecha no válida',
          description: 'No puedes seleccionar una fecha en el pasado.',
          variant: 'destructive',
        });
        return;
      }
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
  }

  const handleColoniaSelect = (coloniaId: string) => {
      setSelectedColoniaId(coloniaId);
      setSelectedTime(undefined);
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  }

  const selectedClinic = React.useMemo(() => {
    if (!selectedClinicId) return undefined;
    return clinics.find(c => c.id === selectedClinicId);
  }, [selectedClinicId, clinics]);

  const selectedColonia = React.useMemo(() => {
    if (!selectedColoniaId) return undefined;
    return colonias.find(c => c.id === selectedColoniaId);
  }, [selectedColoniaId, colonias]);


  const selectedDayAvailability = React.useMemo(() => {
    if (!selectedDate) return null;
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return availability.find((d) => d.date === dateString) || null;
  }, [selectedDate, availability]);

  const clinicOptions = React.useMemo(() => {
    if (!selectedDayAvailability || !selectedClinicType) return [];

    const filteredClinics = clinics.filter(c => c.clinicType === selectedClinicType);

    const options = filteredClinics.map(clinic => {
        const slots = selectedDayAvailability.availabilityByClinic[clinic.id] ?? 0;
        const isDisabled = slots === 0;
        return {
            value: clinic.id,
            label: `${clinic.name} (${slots} citas disponibles)`,
            disabled: isDisabled,
        };
    }).sort((a,b) => a.label.localeCompare(b.label));

    return options;

  }, [clinics, selectedDayAvailability, selectedClinicType]);

  const coloniaOptions = React.useMemo(() => {
    if (!selectedClinicId) return [];

    return colonias
        .filter(c => c.clinicId === selectedClinicId)
        .map(colonia => ({
            value: colonia.id,
            label: colonia.name,
            keywords: colonia.name
        }))
        .sort((a,b) => a.label.localeCompare(b.label));

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
  }, [selectedClinic, selectedDate, generateDynamicTimeSlots]);


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

    return allTimeSlots.filter((candidate, index) => {
        if (candidate === selectedClinic.breakTime) return false;
        
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

        if (hasCollision) return false;

        if (isDoubleSlot) {
            const nextCandidate = allTimeSlots[index + 1];
            if (!nextCandidate || nextCandidate.includes('Espera') || nextCandidate === selectedClinic.breakTime) return false;
            
            const nextStart = timeToMinutes(nextCandidate);
            const nextEnd = nextStart + duration;
            
            const hasNextCollision = takenInfo.some(ti => {
                if (ti.time.includes('Espera')) return false;
                const appStart = timeToMinutes(ti.time);
                const appEnd = appStart + (appStart === -1 ? 0 : (ti.duration || 30));
                return Math.max(nextStart, appStart) < Math.min(nextEnd, appEnd);
            });
            
            if (hasNextCollision) return false;
        }

        return true;
    });
  }, [selectedDayAvailability, selectedClinic, allTimeSlots, selectedDate, isDoubleSlot]);

  const availableTokens = React.useMemo(() => {
    if (!selectedDayAvailability || !selectedClinic || selectedClinic.bookingMode !== BookingMode.Token) return [];
    
    const totalSlots = selectedClinic.dailySlots;
    const allPossibleTokens = Array.from({ length: totalSlots }, (_, i) => `Ficha ${i + 1}`);
    const waitlistTokens = Array.from({ length: selectedClinic.waitlistSlots || 0 }, (_, i) => `Espera ${i + 1}`);
    
    const allOptions = [...allPossibleTokens, ...waitlistTokens];

    const takenTimes = (selectedDayAvailability.takenTimesByClinic?.[selectedClinic.id] || []).map(ti => ti.time);
    
    return allOptions.filter((token, index) => {
        if (takenTimes.includes(token)) return false;
        if (isDoubleSlot && !token.includes('Espera')) {
            const nextToken = allOptions[index + 1];
            if (!nextToken || nextToken.includes('Espera') || takenTimes.includes(nextToken)) return false;
        }
        return true;
    });
  }, [selectedDayAvailability, selectedClinic, isDoubleSlot]);

  if (!isAuthenticated) {
    return (
        <ModuleLoginForm 
            title="Citas Médicas" 
            onVerify={verifyCitasMedicasPassword} 
            onSuccess={() => setIsAuthenticated(true)} 
        />
    );
  }

  const isTokenBooking = selectedClinic?.bookingMode === BookingMode.Token;
  const isTimeBooking = selectedClinic?.bookingMode === BookingMode.Time;
  
  const showColoniaStep = selectedClinicId && clinicHasColonias;
  const showTimeAndFormStep = (selectedClinic && !clinicHasColonias) || selectedColoniaId;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="text-primary mb-4">
           <Image
            src={logoBase64}
            alt="Logo CitaMedicaFacil"
            width={80}
            height={80}
            className="rounded-md"
          />
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold font-headline text-foreground">
          Agenda tu Cita Médica
        </h1>
        <p className="text-lg text-muted-foreground mt-2 max-w-2xl mx-auto">
          Un servicio simple y rápido para la comunidad de Huimanguillo.
          Sigue los pasos para registrar tus datos.
        </p>
      </div>

      <Card className="w-full max-w-5xl mx-auto shadow-xl border-border/60">
        <CardContent className="p-4 md:p-6 lg:p-8">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="flex flex-col gap-8">
              <div>
                <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                    Selecciona un tipo de cita
                </h3>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Stethoscope className="h-5 w-5 text-primary" />
                            Tipo de Consulta
                        </CardTitle>
                        <CardDescription>Elige el tipo de consulta que necesitas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Select onValueChange={handleClinicTypeSelect} value={selectedClinicType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un tipo de consulta" />
                            </SelectTrigger>
                            <SelectContent>
                                {specialties.map(spec => (
                                    <SelectItem key={spec.id} value={spec.name}>{spec.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>
              </div>
              
              {selectedClinicType && (
                <div>
                    <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                    Selecciona un día
                    </h3>
                    <AvailabilityCalendar
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                    availability={availability}
                    onMonthChange={handleMonthChange}
                    isLoading={isPending}
                    />
                </div>
              )}

              {selectedDate && (
                  <div className="space-y-4">
                      <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                          Indica tu tipo de paciente
                      </h3>
                      <Card>
                          <CardHeader>
                              <CardTitle className="text-xl flex items-center gap-2">
                                  <UserCheck className="h-5 w-5 text-primary" />
                                  Tipo de Paciente
                              </CardTitle>
                              <CardDescription>Esto nos ayuda a dirigir tu cita correctamente.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                              <Select 
                                onValueChange={(value: PatientType) => {
                                    setPatientType(value);
                                    if (value !== PatientType.Embarazada) setIsDoubleSlot(false);
                                }} 
                                value={patientType}
                              >
                                  <SelectTrigger>
                                      <SelectValue placeholder="Selecciona un tipo" />
                                  </SelectTrigger>
                                  <SelectContent>
                                  <SelectItem value={PatientType.General}>General</SelectItem>
                                  <SelectItem value={PatientType.Cronico}>Paciente Crónico</SelectItem>
                                  <SelectItem value={PatientType.Embarazada}>Embarazada</SelectItem>
                                  <SelectItem value={PatientType.TerceraEdad}>Tercera Edad</SelectItem>
                                  <SelectItem value={PatientType.RecienNacido}>Recién Nacido (sin CURP)</SelectItem>
                                  </SelectContent>
                              </Select>

                              {patientType === PatientType.Embarazada && (
                                <div className="flex items-center space-x-2 p-3 bg-pink-50 border border-pink-100 rounded-lg animate-in fade-in zoom-in duration-200">
                                    <Checkbox 
                                        id="embarazada-check" 
                                        checked={isDoubleSlot} 
                                        onCheckedChange={(checked) => {
                                            setIsDoubleSlot(!!checked);
                                            setSelectedTime(undefined); 
                                        }} 
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                        <Label htmlFor="embarazada-check" className="text-sm font-black text-pink-700 flex items-center gap-2 cursor-pointer">
                                            <Baby className="h-4 w-4" /> Cita Embarazada (2 horarios)
                                        </Label>
                                        <p className="text-[10px] text-pink-600 font-medium">Asigna dos espacios consecutivos para una atención completa.</p>
                                    </div>
                                </div>
                              )}
                          </CardContent>
                      </Card>
                  </div>
              )}
                  
              {selectedDate && selectedDayAvailability && (
                  <div>
                  <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                      Selecciona tu núcleo básico
                  </h3>
                  <Card className="bg-card">
                      <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                              <Hospital className="h-5 w-5 text-primary" />
                              Núcleos con citas para el {format(selectedDate, 'PPP', { locale: es })}
                          </CardTitle>
                          <CardDescription>Elige el núcleo básico al que perteneces.</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <Select key={selectedDate?.toISOString() ?? 'no-date'} onValueChange={handleClinicSelect} value={selectedClinicId || ''}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un núcleo..." />
                            </SelectTrigger>
                            <SelectContent>
                                {clinicOptions.length > 0 ? clinicOptions.map(opt => (
                                    <SelectItem 
                                        key={opt.value} 
                                        value={opt.value} 
                                        disabled={opt.disabled}
                                        className={cn(
                                            !opt.disabled ? "font-bold text-green-700" : "text-red-600"
                                        )}
                                    >
                                        {opt.label}
                                    </SelectItem>
                                )) : <div className="p-4 text-center text-sm text-muted-foreground">No hay núcleos disponibles para esta fecha y tipo de consulta.</div>}
                            </SelectContent>
                          </Select>
                      </CardContent>
                  </Card>
                  </div>
              )}
              
              {showColoniaStep && (
                <div>
                  <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                      Selecciona tu municipio
                  </h3>
                  <Card className="bg-card">
                      <CardHeader>
                          <CardTitle className="text-xl flex items-center gap-2">
                              <MapPin className="h-5 w-5 text-primary" />
                              Municipio de residencia
                          </CardTitle>
                          <CardDescription>Busca y selecciona tu municipio.</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <Combobox
                              options={coloniaOptions}
                              value={selectedColoniaId || ''}
                              onChange={handleColoniaSelect}
                              placeholder="Busca y selecciona tu municipio..."
                              searchPlaceholder="Escribe para buscar..."
                              noResultsText="No se encontraron municipios para este núcleo."
                          />
                      </CardContent>
                  </Card>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-8">
              {showTimeAndFormStep && (
                <>
                 {isTimeBooking && (
                  <div>
                      <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                          Selecciona una hora o lista de espera
                      </h3>
                      <Card className="bg-card">
                          <CardHeader>
                              <CardTitle className="text-xl flex items-center gap-2">
                              <Clock className="h-5 w-5 text-primary" />
                              Horarios para {selectedClinic?.name}
                              </CardTitle>
                              <CardDescription>
                                  {isDoubleSlot ? "Se mostrarán solo los espacios con 2 horarios seguidos disponibles." : "Selecciona un horario disponible o un turno en espera."}
                              </CardDescription>
                          </CardHeader>
                          <CardContent className="grid grid-cols-3 gap-2">
                          {availableTimeSlots.length > 0 ? availableTimeSlots.map(time => (
                              <button key={time}
                              onClick={() => handleTimeSelect(time)}
                              className={`w-full p-2 border rounded-md text-center transition-colors ${selectedTime === time ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'} ${time.startsWith('Espera') ? 'border-yellow-500 text-yellow-700' : ''}`}
                              >
                                  {time}
                              </button>
                          )) : <p className="col-span-3 text-center text-muted-foreground italic py-4">No hay horarios disponibles {isDoubleSlot ? 'con espacios consecutivos' : ''}.</p>}
                          </CardContent>
                      </Card>
                  </div>
                 )}
                 {isTokenBooking && (
                    <div>
                        <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                            Selecciona una Ficha o Espera
                        </h3>
                        <Card className="bg-card">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Ticket className="h-5 w-5 text-primary" />
                                    Fichas Disponibles
                                </CardTitle>
                                <CardDescription>
                                    Este núcleo asigna fichas. Hay {availableTokens.length} espacios disponibles.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Select onValueChange={(value) => setSelectedTime(value)} value={selectedTime}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona una ficha..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableTokens.length > 0 ? (
                                            availableTokens.map(token => (
                                                <SelectItem key={token} value={String(token)} className={token.startsWith('Espera') ? 'text-yellow-700' : ''}>
                                                    {token}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <p className="p-4 text-sm text-muted-foreground">No hay espacios disponibles.</p>
                                        )}
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>
                    </div>
                  )}
                </>
              )}

              <div>
                <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                  Completa tus datos
                </h3>
                <BookingForm
                  selectedDate={selectedDate}
                  selectedClinic={selectedClinic}
                  selectedColoniaName={selectedColonia?.name}
                  selectedTime={selectedTime}
                  patientType={patientType}
                  isDoubleSlot={isDoubleSlot}
                  onBookingSuccess={refreshData}
                  announcements={announcements}
                  requireColonia={clinicHasColonias}
                />
              </div>
              {announcements && announcements.length > 0 && (
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl font-headline">
                      <Bell className="h-5 w-5 text-primary" />
                      Avisos Importantes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                      {announcements.map((announcement, index) => (
                        <li key={index}>{announcement}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}