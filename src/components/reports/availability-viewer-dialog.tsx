'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { CalendarDays, Info, CheckCircle2, AlertCircle, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Label } from '../ui/label';

type ReportType = 'clinic' | 'x-ray' | 'ultrasound' | 'laboratorio' | 'vacunas';

type AvailabilityViewerDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  entity: any;
};

export function AvailabilityViewerDialog({ isOpen, onClose, reportType: initialReportType, entity }: AvailabilityViewerDialogProps) {
  const [selectedService, setSelectedService] = useState<ReportType>(initialReportType);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [availability, setAvailability] = useState<DailyAvailability[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isPending, startTransition] = useTransition();
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);

  const fetchAvailability = React.useCallback(async (date: Date, service: ReportType) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const startDate = startOfMonth(new Date(year, month));
    const endDate = endOfMonth(new Date(year, month));
    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

    try {
      let appointments: any[] = [];
      let settings: any = null;
      const holidays = await getHolidays();

      // Fetch data based on selected service
      if (service === 'laboratorio') {
        const [appData, settsData] = await Promise.all([getLabAppointments(), getLabSettings()]);
        appointments = appData;
        settings = settsData;
      } else if (service === 'x-ray') {
        const [appData, settsData] = await Promise.all([getXRayAppointments(), getXRaySettings()]);
        appointments = appData;
        settings = settsData;
      } else if (service === 'ultrasound') {
        const [appData, settsData] = await Promise.all([getUltrasoundAppointments(), getUltrasoundSettings()]);
        appointments = appData;
        settings = settsData;
      } else if (service === 'vacunas') {
        const [appData, settsData] = await Promise.all([getVaccineAppointments(), getVaccineSettings()]);
        appointments = appData;
        settings = settsData;
      } else if (service === 'clinic') {
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
        
        if (service === 'clinic') {
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
  }, [entity]);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingInitial(true);
      startTransition(async () => {
        await fetchAvailability(currentMonth, selectedService);
        setIsLoadingInitial(false);
      });
    }
  }, [isOpen, currentMonth, selectedService, fetchAvailability]);

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Consulta de Disponibilidad
          </DialogTitle>
          <DialogDescription>
            Verifica los espacios libres para agendar nuevas citas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-4">
          <div className="space-y-2">
            <Label>Servicio a consultar:</Label>
            <Select value={selectedService} onValueChange={(v: ReportType) => setSelectedService(v)}>
              <SelectTrigger className="w-full h-11 border-primary/40">
                <SelectValue placeholder="Selecciona un servicio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="laboratorio">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <span>Laboratorio Clínico</span>
                  </div>
                </SelectItem>
                <SelectItem value="x-ray">Rayos X</SelectItem>
                <SelectItem value="ultrasound">Ultrasonidos</SelectItem>
                <SelectItem value="vacunas">Vacunación</SelectItem>
                <SelectItem value="clinic">Núcleo Básico (Actual)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-center">
            <AvailabilityCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              availability={availability}
              onMonthChange={handleMonthChange}
              isLoading={isPending || isLoadingInitial}
            />
          </div>

          {selectedDate && selectedDayAvailability && (
            <div className="w-full space-y-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  <span className="text-sm font-semibold">Citas para el {format(selectedDate, 'dd/MM/yyyy')}:</span>
                </div>
                <Badge 
                  variant={selectedDayAvailability.availableSlots > 0 ? "secondary" : "destructive"}
                  className={cn(
                    "text-lg px-3 py-1 font-bold",
                    selectedDayAvailability.availableSlots > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  )}
                >
                  {selectedDayAvailability.availableSlots === 0 ? (
                    <span className="flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Agotado</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      {selectedDayAvailability.availableSlots} Libres
                    </span>
                  )}
                </Badge>
              </div>
            </div>
          )}
          
          {!selectedDate && !isLoadingInitial && (
            <p className="text-xs text-muted-foreground italic text-center border-t pt-4">
              Selecciona un día en el calendario para ver el detalle de citas disponibles en {selectedService === 'laboratorio' ? 'Laboratorio' : 'este servicio'}.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
