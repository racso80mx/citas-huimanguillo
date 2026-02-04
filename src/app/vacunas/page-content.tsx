'use client';
import React from 'react';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import type { DailyAvailability, Vaccine, VaccineSettings, Colonia, Clinic } from '@/lib/definitions';
import { getVaccineAppointments } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Clock, CalendarDays, ShieldPlus, Baby, MapPin } from 'lucide-react';
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
import { VaccineBookingForm } from '@/components/vacunas/vaccine-booking-form';
import { VaccineSelector } from '@/components/vacunas/vaccine-selector';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';

type VaccinePageContentProps = {
  initialVaccines: Vaccine[];
  initialSettings: VaccineSettings;
  initialColonias: Colonia[];
  initialClinics: Clinic[];
};

export default function VaccinePageContent({
  initialVaccines,
  initialSettings,
  initialColonias,
  initialClinics,
}: VaccinePageContentProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = React.useState<string | undefined>();
  const [selectedVaccines, setSelectedVaccines] = React.useState<Vaccine[]>([]);
  const [isNewborn, setIsNewborn] = React.useState(false);
  const [selectedColoniaId, setSelectedColoniaId] = React.useState<string | undefined>();

  const [availability, setAvailability] = React.useState<DailyAvailability[]>([]);
  const [allVaccines] = React.useState<Vaccine[]>(initialVaccines);
  const [settings] = React.useState<VaccineSettings>(initialSettings);
  const [colonias] = React.useState<Colonia[]>(initialColonias);
  const [clinics] = React.useState<Clinic[]>(initialClinics);

  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToast();

  const generateTimeSlots = (): string[] => {
    if (!settings) return [];
    const slots = [];
    const [startHour, startMinute] = settings.startTime.split(':').map(Number);
    const [endHour, endMinute] = settings.endTime.split(':').map(Number);

    let currentHour = startHour;
    let currentMinute = startMinute;

    while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
      slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`);
      
      currentMinute += 10; // 10 minute intervals
      if (currentMinute >= 60) {
        currentHour++;
        currentMinute -= 60;
      }
    }
    return slots.slice(0, settings.dailySlots);
  };
  
  const allTimeSlots = React.useMemo(generateTimeSlots, [settings]);

  const fetchAvailability = React.useCallback(
    async (year: number, month: number) => {
      const calculateSlotsInTimeRange = (startTime: string, endTime: string): number => {
        if (!startTime || !endTime) return 0;
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);
        const startDate = new Date(0);
        startDate.setHours(startHour, startMinute, 0, 0);
        const endDate = new Date(0);
        endDate.setHours(endHour, endMinute, 0, 0);
        const diffMinutes = (endDate.getTime() - startDate.getTime()) / 60000;
        return Math.floor(diffMinutes / 10); // 10 minute intervals
      };

      const startDate = startOfMonth(new Date(year, month));
      const endDate = endOfMonth(new Date(year, month));

      const allAppointments = await getVaccineAppointments();

      const availabilityResult: DailyAvailability[] = [];
      const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

      for (const day of daysInMonth) {
        const dateString = day.toISOString().split('T')[0];
        const appointmentsOnDate = allAppointments.filter(
          (app) => app.date.split('T')[0] === dateString
        );
        const isWeekend = isSaturday(day) || isSunday(day);
        
        let maxSlotsForDay = 0;
        if (!isWeekend || (isWeekend && settings.weekendBookingEnabled)) {
            const slotsInTimeRange = calculateSlotsInTimeRange(settings.startTime, settings.endTime);
            maxSlotsForDay = Math.min(settings.dailySlots, slotsInTimeRange);
        }

        const available = Math.max(0, maxSlotsForDay - appointmentsOnDate.length);
        const takenTimes = appointmentsOnDate.map((app) => app.time);
        
        availabilityResult.push({
          date: dateString,
          availableSlots: available,
          availabilityByClinic: {}, // Not used here
          takenTimesByClinic: {'vaccine': takenTimes || []},
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
          console.error('Failed to fetch Vaccine data:', error);
          toast({
            title: 'Error de Carga',
            description: 'No se pudieron cargar los datos de disponibilidad. Por favor, recarga la página.',
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
        setSelectedVaccines([]);
        setIsNewborn(false);
        setSelectedColoniaId(undefined);
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
    setSelectedVaccines([]);
  };
  
  const handleVaccineChange = (vaccines: Vaccine[]) => {
    setSelectedVaccines(vaccines);
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };
  
  const handleColoniaSelect = (coloniaId: string) => {
      setSelectedColoniaId(coloniaId);
  }

   const selectedDayAvailability = React.useMemo(() => {
    if (!selectedDate) return null;
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return availability.find((d) => d.date === dateString) || null;
  }, [selectedDate, availability]);

  const availableTimeSlots = React.useMemo(() => {
    if (!selectedDayAvailability || selectedDayAvailability.availableSlots <= 0) return [];
    const takenTimes = selectedDayAvailability.takenTimesByClinic['vaccine'] || [];
    return allTimeSlots.filter(slot => !takenTimes.includes(slot));
}, [selectedDayAvailability, allTimeSlots]);
  
  const coloniaOptions = React.useMemo(() => {
    return colonias.map(colonia => {
        const clinic = clinics.find(c => c.id === colonia.clinicId);
        return {
            value: colonia.id,
            label: `${colonia.name} (${clinic?.name})`,
            keywords: `${colonia.name} ${clinic?.name}`,
        };
    });
  }, [colonias, clinics]);

  const selectedColonia = colonias.find(c => c.id === selectedColoniaId);
  const selectedClinic = clinics.find(c => c.id === selectedColonia?.clinicId);

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
          Agenda tu Cita de Vacunación
        </h1>
        <p className="text-lg text-muted-foreground mt-2 max-w-2xl mx-auto">
          Selecciona un día, la vacuna que necesites, un horario y registra tus datos.
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
                  <>
                    <div>
                         <h3 className="text-2xl font-semibold font-headline text-foreground mb-4 flex items-center gap-2">
                            <Baby className="h-6 w-6" />
                            2. ¿Es para un recién nacido?
                        </h3>
                        <Card>
                            <CardContent className="p-6">
                                 <div className="flex items-center space-x-2">
                                    <Switch id="newborn-switch" checked={isNewborn} onCheckedChange={setIsNewborn} />
                                    <Label htmlFor="newborn-switch" className="text-base">Sí, es un recién nacido (sin CURP)</Label>
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">Si se activa, no se pedirá CURP ni se validará la colonia.</p>
                            </CardContent>
                        </Card>
                    </div>

                    {!isNewborn && (
                        <div>
                            <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                                3. Selecciona tu colonia
                            </h3>
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        <MapPin className="h-5 w-5 text-primary" />
                                        Colonia de Residencia
                                    </CardTitle>
                                    <CardDescription>Selecciona tu colonia para verificar que perteneces al área de atención.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Combobox
                                        options={coloniaOptions}
                                        value={selectedColoniaId || ''}
                                        onChange={handleColoniaSelect}
                                        placeholder="Busca y selecciona tu colonia..."
                                        searchPlaceholder="Escribe el nombre de tu colonia..."
                                        noResultsText="No se encontró la colonia."
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    )}
                  </>
              )}

              {selectedDate && (isNewborn || selectedColoniaId) && (
                 <div>
                    <h3 className="text-2xl font-semibold font-headline text-foreground mb-4 flex items-center gap-2">
                        <ShieldPlus className="h-6 w-6" />
                        {isNewborn ? '3.' : '4.'} Selecciona la(s) Vacuna(s)
                    </h3>
                    <VaccineSelector
                      allVaccines={allVaccines}
                      onSelectionChange={handleVaccineChange}
                      selectedVaccines={selectedVaccines}
                    />
                  </div>
              )}
            </div>

            <div className="flex flex-col gap-8">
              {selectedDate && (isNewborn || selectedColoniaId) && selectedVaccines.length > 0 && (
                <div>
                  <h3 className="text-2xl font-semibold font-headline text-foreground mb-4 flex items-center gap-2">
                    <Clock className="h-6 w-6" />
                    {isNewborn ? '4.' : '5.'} Selecciona una hora
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
                    <CardContent className="grid grid-cols-4 gap-2">
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
                        <p className="col-span-4 text-center text-muted-foreground">
                          No hay horarios disponibles para la fecha seleccionada.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              <div>
                <h3 className="text-2xl font-semibold font-headline text-foreground mb-4 flex items-center gap-2">
                  <ShieldPlus className="h-6 w-6" />
                  {isNewborn ? '5.' : '6.'} Completa los datos
                </h3>
                <VaccineBookingForm
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  selectedVaccines={selectedVaccines}
                  isNewborn={isNewborn}
                  clinicId={selectedClinic?.id}
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
