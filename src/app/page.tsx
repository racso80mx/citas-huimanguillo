'use client';
import React, { useState, useTransition, useMemo, useEffect } from 'react';
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
import type { DailyAvailability, Colonia } from '@/lib/definitions';
import { getAnnouncements, getColonias, getAppointments, getSlotsConfiguration, getWeekendBookingConfig } from '@/lib/data';

import { useToast } from '@/hooks/use-toast';
import { Bell, Clock, MapPin } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSaturday, isSunday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function generateTimeSlots(): string[] {
  const slots = [];
  for (let hour = 8; hour < 13; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
    slots.push(`${String(hour).padStart(2, '0')}:20`);
    slots.push(`${String(hour).padStart(2, '0')}:40`);
  }
  return slots;
}
const ALL_TIME_SLOTS = generateTimeSlots();

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedColonia, setSelectedColonia] = useState<Colonia | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | undefined>();

  const [availability, setAvailability] = useState<DailyAvailability[]>([]);
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [colonias, setColonias] = useState<Colonia[]>([]);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const fetchAvailability = async (year: number, month: number) => {
      const startDate = startOfMonth(new Date(year, month));
      const endDate = endOfMonth(new Date(year, month));

      const [allAppointments, currentSlotsConfig, weekendConfig] = await Promise.all([
        getAppointments(),
        getSlotsConfiguration(),
        getWeekendBookingConfig(),
      ]);

      const availabilityResult: DailyAvailability[] = [];
      const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

      for (const day of daysInMonth) {
        const isWeekend = isSaturday(day) || isSunday(day);
        if (isWeekend && !weekendConfig.enabled) {
          availabilityResult.push({
            date: day.toISOString().split('T')[0],
            availableSlots: 0,
            availabilityByConsultorio: {},
            takenTimesByConsultorio: {},
          });
          continue;
        }

        const dateString = day.toISOString().split('T')[0];
        const appointmentsOnDate = allAppointments.filter(
          (app) => app.date.split('T')[0] === dateString
        );

        let totalAvailableSlots = 0;
        const availabilityByConsultorio: { [key: number]: number } = {};
        const takenTimesByConsultorio: { [key: number]: string[] } = {};

        for (const consultorioId in currentSlotsConfig) {
          const id = parseInt(consultorioId);
          const maxSlots = currentSlotsConfig[id] || 0;
          const bookedAppointments = appointmentsOnDate.filter(
            (app) => app.consultorio === id
          );
          
          const available = Math.max(0, maxSlots - bookedAppointments.length);
          availabilityByConsultorio[id] = available;
          totalAvailableSlots += available;

          takenTimesByConsultorio[id] = bookedAppointments.map(app => app.time);
        }

        availabilityResult.push({
          date: dateString,
          availableSlots: totalAvailableSlots,
          availabilityByConsultorio: availabilityByConsultorio,
          takenTimesByConsultorio,
        });
      }
      setAvailability(availabilityResult);
  }

  useEffect(() => {
    async function fetchInitialData() {
        startTransition(async () => {
            const today = new Date();
            try {
                const [announcementsData, coloniasData] = await Promise.all([
                    getAnnouncements(),
                    getColonias(),
                ]);
                setAnnouncements(announcementsData);
                setColonias(coloniasData);
                await fetchAvailability(today.getFullYear(), today.getMonth());
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
                toast({
                    title: "Error de Carga",
                    description: "No se pudieron cargar los datos iniciales. Por favor, recarga la página.",
                    variant: "destructive",
                });
            }
        });
    }
    fetchInitialData();
  }, []);

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
    startTransition(async () => {
      await fetchAvailability(
        month.getFullYear(),
        month.getMonth()
      );
    });
  };

  const refreshData = () => {
    startTransition(async () => {
      try {
        const [newAnnouncements, newColonias] = await Promise.all([
            getAnnouncements(),
            getColonias(),
        ]);
        await fetchAvailability(currentMonth.getFullYear(), currentMonth.getMonth());
        setAnnouncements(newAnnouncements);
        setColonias(newColonias);
        setSelectedDate(undefined);
        setSelectedColonia(undefined);
        setSelectedTime(undefined);
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

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        toast({
          title: 'Fecha no válida',
          description: 'No puedes seleccionar una fecha en el pasado.',
          variant: 'destructive',
        });
        return;
      }
    }
    setSelectedDate(date);
    setSelectedColonia(undefined); // Reset selection
    setSelectedTime(undefined); // Reset selection
  };

  const handleColoniaSelect = (coloniaId: string) => {
      const colonia = colonias.find(c => c.id === coloniaId);
      setSelectedColonia(colonia);
      setSelectedTime(undefined); // Reset time when colonia changes
  }


  const selectedDayAvailability = useMemo(() => {
    if (!selectedDate) return null;
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return availability.find((d) => d.date === dateString) || null;
  }, [selectedDate, availability]);

  const availableTimeSlots = useMemo(() => {
    if (!selectedDayAvailability || !selectedColonia) return [];
    const consultorio = selectedColonia.nucleo;
    const takenTimes = selectedDayAvailability.takenTimesByConsultorio[consultorio] || [];
    return ALL_TIME_SLOTS.filter(slot => !takenTimes.includes(slot));
  }, [selectedDayAvailability, selectedColonia]);


  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="text-primary mb-4">
           <Image
            src={logoBase64}
            alt="Logo Hospital Huimanguillo"
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
          Selecciona un día, tu colonia, un horario y registra tus datos.
        </p>
      </div>

      <Card className="w-full max-w-5xl mx-auto shadow-xl border-border/60">
        <CardContent className="p-4 md:p-6 lg:p-8">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="flex flex-col gap-8">
              <div>
                <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
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

              {selectedDate && selectedDayAvailability && (
                <div>
                  <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                    2. Selecciona tu colonia
                  </h3>
                   <Card className="bg-card">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" />
                            Colonias con citas para el {format(selectedDate, 'PPP', { locale: es })}
                        </CardTitle>
                        <CardDescription>Al seleccionar tu colonia, se te asignará el núcleo básico correspondiente.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                         <Select onValueChange={handleColoniaSelect} value={selectedColonia?.id}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona tu colonia..." />
                            </SelectTrigger>
                            <SelectContent>
                                {colonias.map(colonia => {
                                    const consultorioId = colonia.nucleo;
                                    const slots = selectedDayAvailability.availabilityByConsultorio[consultorioId] ?? 0;
                                    const isDisabled = slots === 0;

                                    return (
                                        <SelectItem key={colonia.id} value={colonia.id} disabled={isDisabled}>
                                            <div className="flex justify-between w-full">
                                                <span>{colonia.nombre} (Núcleo {consultorioId})</span>
                                                <span className={`font-bold ml-4 ${isDisabled ? 'text-destructive' : 'text-green-600'}`}>
                                                    {slots} citas
                                                </span>
                                            </div>
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                         </Select>
                    </CardContent>
                   </Card>
                </div>
              )}
                 {selectedColonia && (
                <div>
                  <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                    3. Selecciona una hora
                  </h3>
                   <Card className="bg-card">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                           <Clock className="h-5 w-5 text-primary" />
                           Horarios para Núcleo Básico {selectedColonia.nucleo}
                        </CardTitle>
                        <CardDescription>Selecciona un horario disponible.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-2">
                       {availableTimeSlots.length > 0 ? availableTimeSlots.map(time => (
                           <button key={time}
                           onClick={() => setSelectedTime(time)}
                           className={`w-full p-2 border rounded-md text-center transition-colors ${selectedTime === time ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
                           >
                               {time}
                           </button>
                       )) : <p className="col-span-3 text-center text-muted-foreground">No hay horarios disponibles en esta colonia para la fecha seleccionada.</p>}
                    </CardContent>
                   </Card>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-8">
              <div>
                <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                  4. Completa tus datos
                </h3>
                <BookingForm
                  selectedDate={selectedDate}
                  selectedConsultorio={selectedColonia?.nucleo}
                  selectedColoniaName={selectedColonia?.nombre}
                  selectedTime={selectedTime}
                  onBookingSuccess={refreshData}
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
