'use client';
import { Calendar } from '@/components/ui/calendar';
import type { DailyAvailability } from '@/lib/definitions';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

type AvailabilityCalendarProps = {
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  availability: DailyAvailability[];
  onMonthChange: (month: Date) => void;
  isLoading: boolean;
};

export function AvailabilityCalendar({
  selectedDate,
  onDateSelect,
  availability,
  onMonthChange,
  isLoading,
}: AvailabilityCalendarProps) {
  const disabledDays = availability
    .filter((d) => d.availableSlots === 0)
    .map((d) => parseISO(d.date));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  disabledDays.push({ before: today });

  const selectedDayInfo = selectedDate
    ? availability.find(
        (d) =>
          d.date === format(selectedDate, 'yyyy-MM-dd')
      )
    : null;

  const modifiers = {
    available: (date: Date) => {
      const dateString = format(date, 'yyyy-MM-dd');
      const dayAvailability = availability.find((d) => d.date === dateString);
      return dayAvailability ? dayAvailability.availableSlots > 0 : false;
    },
  };

  const modifiersStyles = {
    available: {
      color: 'hsl(var(--accent-foreground))',
      backgroundColor: 'hsl(var(--accent))',
    },
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative border rounded-md p-3 bg-card">
        <Calendar
          locale={es}
          mode="single"
          selected={selectedDate}
          onSelect={onDateSelect}
          onMonthChange={onMonthChange}
          disabled={disabledDays}
          modifiers={modifiers}
          modifiersStyles={modifiersStyles}
          className="p-0"
        />
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>
      {selectedDate && (
        <div className="text-center font-medium text-foreground bg-secondary p-3 rounded-md w-full">
          {selectedDayInfo && selectedDayInfo.availableSlots > 0 ? (
            <p className='text-green-700'>
              ¡Hay {selectedDayInfo.availableSlots} citas disponibles para el{' '}
              {format(selectedDate, 'PPP', { locale: es })}!
            </p>
          ) : (
            <p className='text-destructive-foreground/70'>
              No hay citas disponibles para el{' '}
              {format(selectedDate, 'PPP', { locale: es })}.
            </p>
          )}
        </div>
      )}
       {!selectedDate && (
        <div className="text-center font-medium text-muted-foreground p-3 rounded-md w-full">
          <p>Selecciona una fecha para ver la disponibilidad.</p>
        </div>
      )}
    </div>
  );
}
