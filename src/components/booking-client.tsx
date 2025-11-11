'use client';
import React, { useState, useTransition } from 'react';
import { BookingForm } from '@/components/booking-form';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { DailyAvailability } from '@/lib/definitions';
import { getAvailability } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Bell } from 'lucide-react';

type BookingClientProps = {
  initialAvailability: DailyAvailability[];
  initialAnnouncements: string[];
};

export function BookingClient({ initialAvailability, initialAnnouncements }: BookingClientProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
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
  };
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
        const today = new Date();
        today.setHours(0,0,0,0);
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
  }

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

              {initialAnnouncements && initialAnnouncements.length > 0 && (
                <Card className="shadow-lg">
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
            <div className="flex flex-col">
              <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                2. Completa tus datos
              </h3>
              <BookingForm
                selectedDate={selectedDate}
                onBookingSuccess={refreshAvailability}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
