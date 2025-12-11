'use client';
import React from 'react';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import { XRayBookingForm } from '@/components/rayos-x/x-ray-booking-form';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import type { DailyAvailability, XRayStudy, XRaySettings } from '@/lib/definitions';
import { getXRayAppointments } from '@/lib/data-client';
import { useToast } from '@/hooks/use-toast';
import { Clock, CalendarDays, Stethoscope } from 'lucide-react';
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

type XRayPageContentProps = {
  initialStudies: XRayStudy[];
  initialSettings: XRaySettings;
};

export default function XRayPageContent({
  initialStudies,
  initialSettings,
}: XRayPageContentProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = React.useState<string | undefined>();
  const [selectedStudy, setSelectedStudy] = React.useState<XRayStudy | undefined>();

  const [availability, setAvailability] = React.useState<DailyAvailability[]>([]);
  const [allStudies] = React.useState<XRayStudy[]>(initialStudies);
  const [settings] = React.useState<XRaySettings>(initialSettings);

  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToast();

  const generateTimeSlots = (): string[] => {
    const slots = [];
    const [startHour] = settings.startTime.split(':').map(Number);
    const [endHour] = settings.endTime.split(':').map(Number);

    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`);
      slots.push(`${String(hour).padStart(2, '0')}:30`);
    }
    return slots;
  };

  const allTimeSlots = React.useMemo(generateTimeSlots, [settings]);

  const fetchAvailability = React.useCallback(
    async (year: number, month: number) => {
      const startDate = startOfMonth(new Date(year, month));
      const endDate = endOfMonth(new Date(year, month));

      const allAppointments = await getXRayAppointments();

      const availabilityResult: DailyAvailability[] = [];
      const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

      for (const day of daysInMonth) {
        const dateString = day.toISOString().split('T')[0];
        const appointmentsOnDate = allAppointments.filter(
          (app) => app.date.split('T')[0] === dateString
        );
        const isWeekend = isSaturday(day) || isSunday(day);
        const maxSlots =
          isWeekend && settings.weekendBookingEnabled
            ? settings.dailySlots
            : isWeekend
            ? 0
            : settings.dailySlots;

        const available = Math.max(0, maxSlots - appointmentsOnDate.length);
        const takenTimes = appointmentsOnDate.map((app) => app.time);
        
        availabilityResult.push({
          date: dateString,
          availableSlots: available,
          availabilityByClinic: {},
          takenTimesByClinic: {'x-ray': takenTimes || []},
        });
      }
      setAvailability(availabilityResult);
    },
    [settings]
  );

  React.useEffect(() => {
    async function fetchInitialData() {
      startTransition(async () => {
        const today = new Date();
        try {
          await fetchAvailability(today.getFullYear(), today.getMonth());
        } catch (error) {
          console.error('Failed to fetch X-Ray data:', error);
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
  }, [fetchAvailability, toast]);

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
  };
  
  const handleStudyChange = (studyId: string) => {
    const study = allStudies.find(s => s.id === studyId);
    setSelectedStudy(study);
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

   const selectedDayAvailability = React.useMemo(() => {
    if (!selectedDate) return null;
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return availability.find((d) => d.date === dateString) || null;
  }, [selectedDate, availability]);

  const availableTimeSlots = React.useMemo(() => {
    if (!selectedDayAvailability || selectedDayAvailability.availableSlots <= 0) return [];
    const takenTimes = selectedDayAvailability.takenTimesByClinic['x-ray'] || [];
    return allTimeSlots.filter(slot => !takenTimes.includes(slot));
}, [selectedDayAvailability, allTimeSlots]);

  const availableStudies = allStudies.filter(s => s.available);


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
          Agenda tu Cita de Rayos X
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
                  <h3 className="text-2xl font-semibold font-headline text-foreground mb-4 flex items-center gap-2">
                    <Stethoscope className="h-6 w-6" />
                    2. Selecciona tu estudio
                  </h3>
                  <Select onValueChange={handleStudyChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona un estudio de Rayos X..." />
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
                    3. Selecciona una hora
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
                  <Stethoscope className="h-6 w-6" />
                  4. Completa tus datos
                </h3>
                <XRayBookingForm
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  selectedStudy={selectedStudy}
                  onBookingSuccess={refreshData}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
