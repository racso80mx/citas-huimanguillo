'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import { 
  getLabAppointments, getLabSettings, 
  getXRayAppointments, getXRaySettings,
  getUltrasoundAppointments, getUltrasoundSettings,
  getVaccineAppointments, getVaccineSettings,
  getAppointmentsForClinic,
  getHolidays 
} from '@/lib/actions';
import type { DailyAvailability, Holiday } from '@/lib/definitions';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSaturday, isSunday } from 'date-fns';
import { CalendarDays, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ReportType = 'clinic' | 'x-ray' | 'ultrasound' | 'laboratorio' | 'vacunas';

type AvailabilityViewerDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  entity: any;
};

export function AvailabilityViewerDialog({ isOpen, onClose, reportType, entity }: AvailabilityViewerDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [availability, setAvailability] = useState<DailyAvailability[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isPending, startTransition] = useTransition();
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  const fetchAvailability = React.useCallback(async (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDate = startOfMonth(new Date(year, month));
    const endDate = endOfMonth(new Date(year, month));
    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

    try {
      let appointments: any[] = [];
      let settings: any = null;
      const holidays = await getHolidays();

      // Fetch data based on report type
      if (reportType === 'laboratorio') {
        [appointments, settings] = await Promise.all([getLabAppointments(), getLabSettings()]);
      } else if (reportType === 'x-ray') {
        [appointments, settings] = await Promise.all([getXRayAppointments(), getXRaySettings()]);
      } else if (reportType === 'ultrasound') {
        [appointments, settings] = await Promise.all([getUltrasoundAppointments(), getUltrasoundSettings()]);
      } else if (reportType === 'vacunas') {
        [appointments, settings] = await Promise.all([getVaccineAppointments(), getVaccineSettings()]);
      } else if (reportType === 'clinic') {
        appointments = await getAppointmentsForClinic(entity.id);
        settings = entity;
      }

      const results: DailyAvailability[] = [];
      const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

      for (const day of daysInMonth) {
        const dateString = day.toISOString().split('T')[0];
        const appointmentsOnDate = appointments.filter(app => app.date.split('T')[0] === dateString);
        
        const isWeekend = isSaturday(day) || isSunday(day);
        const isHoliday = holidays.some(h => h.date === dateString);
        const isSpecialDay = isWeekend || isHoliday;

        let maxSlots = 0;
        
        if (reportType === 'clinic') {
            const dayOfWeekName = dayNames[day.getUTCDay()];
            const isDayOfAction = entity.daysOfAction?.includes(dayOfWeekName);
            const isUnavailableDate = entity.unavailableDates?.includes(dateString);
            const isWeekendAndNotEnabled = isSpecialDay && !entity.weekendBookingEnabled;

            if (!isDayOfAction && !isUnavailableDate && !isWeekendAndNotEnabled) {
                maxSlots = entity.dailySlots;
            }
        } else {
            maxSlots = (isSpecialDay && !settings?.weekendBookingEnabled) ? 0 : (settings?.dailySlots || 0);
        }

        const available = Math.max(0, maxSlots - appointmentsOnDate.length);
        
        results.push({
          date: dateString,
          availableSlots: available,
          availabilityByClinic: {},
          takenTimesByClinic: {},
        });
      }

      setAvailability(results);
    } catch (error) {
      console.error("Error fetching availability:", error);
    }
  }, [reportType, entity]);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingInitial(true);
      startTransition(async () => {
        await fetchAvailability(currentMonth);
        setIsLoadingInitial(false);
      });
    }
  }, [isOpen, currentMonth, fetchAvailability]);

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
  };

  const selectedDayAvailability = React.useMemo(() => {
    if (!selectedDate) return null;
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return availability.find((d) => d.date === dateString) || null;
  }, [selectedDate, availability]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Consulta de Disponibilidad
          </DialogTitle>
          <DialogDescription>
            Validación de cupos libres para {entity.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <AvailabilityCalendar
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            availability={availability}
            onMonthChange={handleMonthChange}
            isLoading={isPending || isLoadingInitial}
          />

          {selectedDate && selectedDayAvailability && (
            <div className="w-full space-y-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Estado para el {format(selectedDate, 'dd/MM/yyyy')}:</span>
                </div>
                <Badge 
                  variant={selectedDayAvailability.availableSlots > 0 ? "secondary" : "destructive"}
                  className={cn(
                    "font-bold",
                    selectedDayAvailability.availableSlots > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  )}
                >
                  {selectedDayAvailability.availableSlots === 0 ? (
                    <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Sin Cupo</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {selectedDayAvailability.availableSlots} Libres
                    </span>
                  )}
                </Badge>
              </div>
            </div>
          )}
          
          {!selectedDate && !isLoadingInitial && (
            <p className="text-xs text-muted-foreground italic text-center">
              Selecciona un día en el calendario para ver el detalle de citas disponibles.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
