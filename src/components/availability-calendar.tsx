'use client';
import { Calendar } from '@/components/ui/calendar';
import type { DailyAvailability } from '@/lib/definitions';
import { format, parseISO, startOfToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';
import { Skeleton } from './ui/skeleton';

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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const disabledDays = useMemo(() => {
    const disabledByAvailability = availability
      .filter((d) => d.availableSlots === 0)
      .map((d) => parseISO(d.date));

    // Only add the 'before' rule on the client side to prevent hydration mismatch
    if (isClient) {
        return [{ before: startOfToday() }, ...disabledByAvailability];
    }
    
    return disabledByAvailability;

  }, [availability, isClient]);

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
    selected: {
        ring: '2px',
        ringColor: 'hsl(var(--primary))',
        ringOffset: '2px',
        ringOffsetColor: 'hsl(var(--background))',
    }
  };

  // Prevent rendering the full calendar on the server or on the initial client render
  // to avoid hydration mismatch caused by `new Date()`. Show a placeholder instead.
  if (!isClient) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative border rounded-md p-3 bg-card flex items-center justify-center">
            <Skeleton className="h-[320px] w-[280px]" />
        </div>
         <div className="text-center font-medium text-muted-foreground p-3 rounded-md w-full">
          <p>Selecciona una fecha para ver la disponibilidad.</p>
        </div>
      </div>
    );
  }

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
       {!selectedDate && (
        <div className="text-center font-medium text-muted-foreground p-3 rounded-md w-full">
          <p>Selecciona una fecha para ver la disponibilidad.</p>
        </div>
      )}
    </div>
  );
}
