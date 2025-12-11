'use client';
import React from 'react';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import { LabBookingForm } from '@/components/laboratorio/lab-booking-form';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import type { DailyAvailability, LabStudy, LabSettings } from '@/lib/definitions';
import { getLabAppointments } from '@/lib/data-client';
import { useToast } from '@/hooks/use-toast';
import { FlaskConical, CalendarDays, Microscope } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSaturday,
  isSunday,
  startOfToday,
} from 'date-fns';
import { LabStudiesSelector } from '@/components/laboratorio/lab-studies-selector';

type LabPageContentProps = {
  initialStudies: LabStudy[];
  initialSettings: LabSettings;
};

export default function LabPageContent({
  initialStudies,
  initialSettings,
}: LabPageContentProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [selectedStudies, setSelectedStudies] = React.useState<LabStudy[]>([]);

  const [availability, setAvailability] = React.useState<DailyAvailability[]>([]);
  const [allStudies] = React.useState<LabStudy[]>(initialStudies);
  const [settings] = React.useState<LabSettings>(initialSettings);

  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToast();

  const fetchAvailability = React.useCallback(
    async (year: number, month: number) => {
      const startDate = startOfMonth(new Date(year, month));
      const endDate = endOfMonth(new Date(year, month));

      const allAppointments = await getLabAppointments();

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
        
        availabilityResult.push({
          date: dateString,
          availableSlots: available,
          availabilityByClinic: {}, // Not used in labs
          takenTimesByClinic: {}, // Not used in labs
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
          console.error('Failed to fetch initial lab data:', error);
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
        setSelectedStudies([]);
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
  };
  
  const handleStudiesChange = (studies: LabStudy[]) => {
      setSelectedStudies(studies);
  }

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
          Agenda tus Estudios de Laboratorio
        </h1>
        <p className="text-lg text-muted-foreground mt-2 max-w-2xl mx-auto">
          Selecciona un día, los estudios que necesites y registra tus datos. La recepción de muestras es en un horario general.
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
                    <FlaskConical className="h-6 w-6" />
                    2. Selecciona tus estudios
                  </h3>
                  <LabStudiesSelector
                    allStudies={allStudies}
                    selectedStudies={selectedStudies}
                    onSelectionChange={handleStudiesChange}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-8">
              <div>
                <h3 className="text-2xl font-semibold font-headline text-foreground mb-4 flex items-center gap-2">
                  <Microscope className="h-6 w-6" />
                  3. Completa tus datos
                </h3>
                <LabBookingForm
                  selectedDate={selectedDate}
                  selectedStudies={selectedStudies}
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
