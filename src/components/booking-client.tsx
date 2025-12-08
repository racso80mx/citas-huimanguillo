'use client';
import React, { useState, useTransition, useMemo, useEffect } from 'react';
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
import { getAvailability, getAnnouncements, getColonias } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Bell, UserCheck, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type BookingClientProps = {
  initialAvailability: DailyAvailability[];
  initialAnnouncements: string[];
};

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


export function BookingClient({
  initialAvailability,
  initialAnnouncements,
}: BookingClientProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedColonia, setSelectedColonia] = useState<Colonia | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | undefined>();

  const [availability, setAvailability] = useState<DailyAvailability[]>(initialAvailability);
  const [announcements, setAnnouncements] = useState<string[]>(initialAnnouncements);
  const [colonias, setColonias] = useState<Colonia[]>([]);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchInitialData() {
      const coloniasData = await getColonias();
      setColonias(coloniasData);
    }
    fetchInitialData();
  }, [])

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
    startTransition(async () => {
      const newAvailability = await getAvailability(
        month.getFullYear(),
        month.getMonth()
      );
      setAvailability(newAvailability);
    });
  };

  const refreshData = () => {
    startTransition(async () => {
      const [newAvailability, newAnnouncements, newColonias] = await Promise.all([
        getAvailability(currentMonth.getFullYear(), currentMonth.getMonth()),
        getAnnouncements(),
        getColonias(),
      ]);
      setAvailability(newAvailability);
      setAnnouncements(newAnnouncements);
      setColonias(newColonias);
      setSelectedDate(undefined);
      setSelectedColonia(undefined);
      setSelectedTime(undefined);
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
    <>
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
    </>
  );
}
