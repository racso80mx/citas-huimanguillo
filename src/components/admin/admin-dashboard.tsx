'use client';
import { useState, useEffect, useTransition } from 'react';
import type { Appointment } from '@/lib/definitions';
import {
  getAppointments,
  deleteAppointment,
} from '@/lib/actions';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppointmentList } from '../appointment-list';
import {
  LogOut,
  Download,
  Loader2,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
} from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Calendar } from '../ui/calendar';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { cn, downloadExcel } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AnnouncementsManager } from './announcements-manager';
import { SlotsManager } from './slots-manager';
import { WeekendBookingManager } from './weekend-booking-manager';

type AdminDashboardProps = {
  onLogout: () => void;
};

type FilterType = 'today' | 'week' | 'month' | 'range';

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<
    Appointment[]
  >([]);
  const [isPending, startTransition] = useTransition();
  const [activeFilter, setActiveFilter] = useState<FilterType>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const { toast } = useToast();

  const fetchData = () => {
    startTransition(async () => {
      const appointments = await getAppointments();
      setAllAppointments(appointments);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allAppointments, activeFilter, dateRange]);

  const applyFilters = () => {
    let filtered: Appointment[] = [];
    const now = new Date();

    if (activeFilter === 'today') {
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      filtered = allAppointments.filter((app) => {
        const appDate = parseISO(app.date);
        return appDate >= todayStart && appDate <= todayEnd;
      });
    } else if (activeFilter === 'week') {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      filtered = allAppointments.filter((app) => {
        const appDate = parseISO(app.date);
        return appDate >= weekStart && appDate <= weekEnd;
      });
    } else if (activeFilter === 'month') {
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      filtered = allAppointments.filter((app) => {
        const appDate = parseISO(app.date);
        return appDate >= monthStart && appDate <= monthEnd;
      });
    } else if (activeFilter === 'range' && dateRange?.from && dateRange?.to) {
      const rangeStart = startOfDay(dateRange.from);
      const rangeEnd = endOfDay(dateRange.to);
      filtered = allAppointments.filter((app) => {
        const appDate = parseISO(app.date);
        return appDate >= rangeStart && appDate <= rangeEnd;
      });
    } else {
      // Default to today if range is not fully selected
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      filtered = allAppointments.filter((app) => {
        const appDate = parseISO(app.date);
        return appDate >= todayStart && appDate <= todayEnd;
      });
    }
    setFilteredAppointments(filtered);
  };
  
  const handleSetDateRange = (range: DateRange | undefined) => {
      setDateRange(range);
      if(range?.from && range?.to) {
        setActiveFilter('range');
      }
  }

  const handleDownload = () => {
    if (filteredAppointments.length === 0) {
      toast({
        title: 'No hay datos para descargar',
        description: 'No hay citas en el filtro actual para exportar.',
        variant: 'destructive',
      });
      return;
    }
    downloadExcel(filteredAppointments, `citas_${activeFilter}`);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteAppointment(id);
      if (result.success) {
        toast({
          title: 'Cita Eliminada',
          description: 'La cita ha sido eliminada y el cupo liberado.',
        });
        fetchData(); // Refresca los datos
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo eliminar la cita.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-3xl font-bold font-headline">
              Panel de Administración
            </CardTitle>
            <CardDescription>
              Visualiza y gestiona las citas agendadas.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnnouncementsManager />
        <SlotsManager />
        <WeekendBookingManager />
      </div>


      <Card className="w-full max-w-7xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold font-headline">
            Reporte de Citas
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2 pt-4">
            <Button
              variant={activeFilter === 'today' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('today')}
            >
              Hoy
            </Button>
            <Button
              variant={activeFilter === 'week' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('week')}
            >
              Esta Semana
            </Button>
            <Button
              variant={activeFilter === 'month' ? 'default' : 'outline'}
              onClick={() => setActiveFilter('month')}
            >
              Este Mes
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={activeFilter === 'range' ? 'default' : 'outline'}
                  className={cn('w-[260px] justify-start text-left font-normal')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'LLL dd, y')} -{' '}
                        {format(dateRange.to, 'LLL dd, y')}
                      </>
                    ) : (
                      format(dateRange.from, 'LLL dd, y')
                    )
                  ) : (
                    <span>Seleccionar rango</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={handleSetDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleDownload}
              variant="secondary"
              className="ml-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-4 text-muted-foreground">Cargando citas...</span>
            </div>
          ) : (
            <AppointmentList
              appointments={filteredAppointments}
              onDelete={handleDelete}
              isAdmin
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
