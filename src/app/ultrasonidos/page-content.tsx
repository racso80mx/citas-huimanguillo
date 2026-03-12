'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import { UltrasoundBookingForm } from '@/components/ultrasonidos/ultrasound-booking-form';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import type { DailyAvailability, UltrasoundStudy, UltrasoundSettings, Holiday } from '@/lib/definitions';
import { PatientType } from '@/lib/definitions';
import { getUltrasoundAppointments, getHolidays, verifyUltrasoundPassword } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Clock, CalendarDays, Waves, UserCheck, Bell } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSaturday,
  isSunday,
  startOfToday,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { timeSlots30Min } from '@/lib/time-slots';
import { ModuleLoginForm } from '@/components/shared/module-login-form';

type UltrasoundPageContentProps = {
  initialStudies: UltrasoundStudy[];
  initialSettings: UltrasoundSettings;
  initialAnnouncements: string[];
  initialHolidays: Holiday[];
};

export default function UltrasoundPageContent({
  initialStudies,
  initialSettings,
  initialAnnouncements,
  initialHolidays,
}: UltrasoundPageContentProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = React.useState<string | undefined>();
  const [selectedStudy, setSelectedStudy] = React.useState<UltrasoundStudy | undefined>();
  const [patientType, setPatientType] = React.useState<PatientType>(PatientType.General);

  const [availability, setAvailability] = React.useState<DailyAvailability[]>([]);
  const [settings] = React.useState<UltrasoundSettings>(initialSettings);
  const [announcements] = React.useState<string[]>(initialAnnouncements);

  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToast();

  const generateTimeSlots = React.useCallback((): string[] => {
    if (!settings || !settings.startTime || !settings.endTime) return [];
    
    const startIndex = timeSlots30Min.findIndex(slot => slot.value === settings.startTime);
    const endIndex = timeSlots30Min.findIndex(slot => slot.value === settings.endTime);

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return [];

    const slotsInRange = timeSlots30Min.slice(startIndex, endIndex).map(slot => slot.value);
    
    return slotsInRange.slice(0, settings.dailySlots);
  }, [settings]);

  const allTimeSlots = React.useMemo(generateTimeSlots, [generateTimeSlots]);

  const fetchAvailability = React.useCallback(
    async (year: number, month: number) => {
      const startDate = startOfMonth(new Date(year, month));
      const endDate = endOfMonth(new Date(year, month));

      const [allAppointments, freshHolidays] = await Promise.all([
        getUltrasoundAppointments(),
        getHolidays()
      ]);

      const availabilityResult: DailyAvailability[] = [];
      const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

      for (const day of daysInMonth) {
        const dateString = day.toISOString().split('T')[0];
        const appointmentsOnDate = allAppointments.filter(
          (app) => app.date.split('T')[0] === dateString
        );
        const isWeekend = isSaturday(day) || isSunday(day);
        const isHoliday = freshHolidays.some(h => h.date === dateString);
        const isSpecialDay = isWeekend || isHoliday;
        
        let maxSlotsForDay = 0;
        if (!isSpecialDay || (isSpecialDay && settings.weekendBookingEnabled)) {
            maxSlotsForDay = allTimeSlots.length;
        }
        
        const available = Math.max(0, maxSlotsForDay - appointmentsOnDate.length);
        const takenTimes = appointmentsOnDate.map((app) => app.time);
        
        availabilityResult.push({
          date: dateString,
          availableSlots: available,
          availabilityByClinic: {},
          takenTimesByClinic: {'ultrasound': takenTimes || []},
        });
      }
      setAvailability(availabilityResult);
    },
    [settings, allTimeSlots]
  );

  React.useEffect(() => {
    if (isAuthenticated) {
        async function fetchInitialData() {
            startTransition(async () => {
                const today = new Date();
                try {
                await fetchAvailability(today.getFullYear(), today.getMonth());
                } catch (error) {
                console.error('Failed to fetch Ultrasound data:', error);
                toast({
                    title: 'Error de Carga',
                    description:
                    'No se pudieron cargar los datos de disponibilidad. Por favor, recarga la página.',
                    variant: 'destructive',
                });
                }
            });
        }
        fetchInitialData();
    }
  }, [fetchAvailability, toast, isAuthenticated]);

  const selectedDayAvailability = React.useMemo(() => {
    if (!selectedDate) return null;
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return availability.find((d) => d.date === dateString) || null;
  }, [selectedDate, availability]);

  const availableTimeSlots = React.useMemo(() => {
    if (!selectedDayAvailability) return [];
    if (selectedDayAvailability.availableSlots <= 0) return [];
    const takenTimes = selectedDayAvailability.takenTimesByClinic['ultrasound'] || [];
    return allTimeSlots.filter(slot => !takenTimes.includes(slot));
  }, [selectedDayAvailability, allTimeSlots]);

  if (!isAuthenticated) {
    return <ModuleLoginForm title="Ultrasonidos" onVerify={verifyUltrasoundPassword} onSuccess={() => setIsAuthenticated(true)} />;
  }

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
    startTransition(async () => {
      await fetchAvailability(month.getFullYear(), month.getMonth());
    });
  };

  const refreshData = () => {
    startTransition(async () => {
      try {
        await fetchAvailability(
          currentMonth.getFullYear(),
          currentMonth.getMonth()
        );
        setSelectedDate(undefined);
        setSelectedTime(undefined);
        setSelectedStudy(undefined);
        setPatientType(PatientType.General);
      } catch (error) {
        console.error('Failed to refresh data:', error);
        toast({
          title: 'Error al Refrescar',
          description: 'No se pudieron actualizar los datos.',
          variant: 'destructive',
        });
      }
    });
  };

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
    setSelectedTime(undefined);
    setSelectedStudy(undefined);
    setPatientType(PatientType.General);
  };
  
  const handleStudyChange = (studyId: string) => {
    const study = initialStudies.find(s => s.id === studyId);
    setSelectedStudy(study);
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const availableStudies = initialStudies.filter(s => s.available);


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
          Agenda tu Cita de Ultrasonido
        </h1>
        <p className="text-lg text-muted-foreground mt-2 max-w-2xl mx-auto">
          Selecciona un día, el estudio que necesites, un horario y registra
          tus datos.
        </p>
      </div>

      <Card className="w-full max-w-6xl mx-auto shadow-xl border-border/60">
        <CardContent className="p-4 md:p-6 lg:p-8">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="flex flex-col gap-8">
              <div>
                <h3 className="text-2xl font-semibold font-headline text-foreground mb-4 flex items-center gap-2">
                  <CalendarDays className="h-6 w-6" />
                  1. Selecciona un día
                </h3>
                <AvailabilityCalendar
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  availability={availability}
                  onMonthChange={handleMonthChange}
                  isLoading={isPending}
                />
              </div>

              {selectedDate && (
                 <div>
                    <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                        2. Indica tu tipo de paciente
                    </h3>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <UserCheck className="h-5 w-5 text-primary" />
                                Tipo de Paciente
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Select onValueChange={(value: PatientType) => setPatientType(value)} value={patientType}>
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
                        </CardContent>
                    </Card>
                </div>
              )}

              {selectedDate && (
                <div>
                  <h3 className="text-2xl font-semibold font-headline text-foreground mb-4 flex items-center gap-2">
                    <Waves className="h-6 w-6" />
                    3. Selecciona tu estudio
                  </h3>
                  <Select onValueChange={handleStudyChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona un estudio de Ultrasonido..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStudies.map(study => (
                        <SelectItem key={study.id} value={study.id}>{study.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedStudy && (
                    <Card className="mt-4 bg-accent/30">
                        <CardHeader>
                            <CardTitle className="text-lg">Indicaciones para el estudio</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">{selectedStudy.indications}</p>
                        </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-8">
              {selectedDate && selectedStudy && (
                <div>
                  <h3 className="text-2xl font-semibold font-headline text-foreground mb-4 flex items-center gap-2">
                    <Clock className="h-6 w-6" />
                    4. Selecciona una hora
                  </h3>
                  <Card className="bg-card">
                    <CardHeader>
                      <CardTitle className="text-xl flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        Horarios Disponibles
                      </CardTitle>
                      <CardDescription>
                        Selecciona un horario para el{' '}
                        {format(selectedDate, 'PPP', { locale: es })}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-2">
                      {availableTimeSlots.length > 0 ? (
                        availableTimeSlots.map((time) => (
                          <button
                            key={time}
                            onClick={() => handleTimeSelect(time)}
                            className={`w-full p-2 border rounded-md text-center transition-colors ${
                              selectedTime === time
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background hover:bg-accent'
                            }`}
                          >
                            {time}
                          </button>
                        ))
                      ) : (
                        <p className="col-span-3 text-center text-muted-foreground">
                          No hay horarios disponibles para la fecha
                          seleccionada.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              <div>
                <h3 className="text-2xl font-semibold font-headline text-foreground mb-4 flex items-center gap-2">
                  <Waves className="h-6 w-6" />
                  5. Completa tus datos
                </h3>
                <UltrasoundBookingForm
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  selectedStudy={selectedStudy}
                  patientType={patientType}
                  onBookingSuccess={refreshData}
                  announcements={announcements}
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
