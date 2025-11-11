'use client';
import React, { useState, useTransition, useMemo } from 'react';
import { BookingForm } from '@/components/booking-form';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import type { DailyAvailability } from '@/lib/definitions';
import { getAvailability } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Bell, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type BookingClientProps = {
  initialAvailability: DailyAvailability[];
  initialAnnouncements: string[];
};

export function BookingClient({
  initialAvailability,
  initialAnnouncements,
}: BookingClientProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedConsultorio, setSelectedConsultorio] = useState<
    number | undefined
  >();
  const [availability, setAvailability] =
    useState<DailyAvailability[]>(initialAvailability);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

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

  const refreshAvailability = () => {
    handleMonthChange(currentMonth);
    setSelectedDate(undefined);
    setSelectedConsultorio(undefined);
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
    setSelectedConsultorio(undefined); // Reset clinic selection when date changes
  };

  const selectedDayAvailability = useMemo(() => {
    if (!selectedDate) return null;
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return availability.find((d) => d.date === dateString) || null;
  }, [selectedDate, availability]);

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
                    2. Selecciona un consultorio
                  </h3>
                   <Card className="bg-card">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <UserCheck className="h-5 w-5 text-primary" />
                            Disponibilidad para el {format(selectedDate, 'PPP', { locale: es })}
                        </CardTitle>
                        <CardDescription>Selecciona un núcleo básico con citas disponibles.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                         {Object.entries(selectedDayAvailability.availabilityByConsultorio).map(([consultorioId, slots]) => {
                             const id = parseInt(consultorioId);
                             return (
                                <button key={id}
                                 onClick={() => setSelectedConsultorio(id)}
                                 disabled={slots === 0}
                                 className={`w-full p-3 border rounded-md text-left transition-colors flex justify-between items-center ${selectedConsultorio === id ? 'bg-primary text-primary-foreground ring-2 ring-ring ring-offset-2' : 'bg-background hover:bg-accent'} disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed`}
                                >
                                 <span>Núcleo Básico {id}</span>
                                 <span className={`font-bold ${selectedConsultorio === id ? 'text-primary-foreground' : slots > 0 ? 'text-green-600' : 'text-destructive'}`}>{slots} citas disponibles</span>
                                </button>
                             )
                         })}
                    </CardContent>
                   </Card>
                </div>
              )}
            </div>

            <div className="flex flex-col">
              <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                3. Completa tus datos
              </h3>
              <BookingForm
                selectedDate={selectedDate}
                selectedConsultorio={selectedConsultorio}
                onBookingSuccess={refreshAvailability}
              />
               {initialAnnouncements && initialAnnouncements.length > 0 && (
                <Card className="shadow-lg mt-8">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl font-headline">
                      <Bell className="h-5 w-5 text-primary" />
                      Avisos Importantes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                      {initialAnnouncements.map((announcement, index) => (
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
