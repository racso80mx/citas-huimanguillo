'use client';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import type { Appointment, Clinic, LabAppointment, XRayAppointment, UltrasoundAppointment, VaccineAppointment } from '@/lib/definitions';
import {
  getAppointmentsForClinic,
  getLabAppointments,
  getXRayAppointments,
  getUltrasoundAppointments,
  getVaccineAppointments,
} from '@/lib/data-client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LogOut,
  Loader2,
  Calendar as CalendarIcon,
  Download,
  CalendarDays,
  CalendarRange,
} from 'lucide-react';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
  isWithinInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';
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
import { AppointmentList } from '../appointment-list';
import { LabAppointmentList } from '../laboratorio/lab-appointment-list';
import { XRayAppointmentList } from '../rayos-x/x-ray-appointment-list';
import { UltrasoundAppointmentList } from '../ultrasonidos/ultrasound-appointment-list';
import { VaccineAppointmentList } from '../vacunas/vaccine-appointment-list';

type ReportType = 'clinic' | 'x-ray' | 'ultrasound' | 'laboratorio' | 'vacunas';

type ReportsDashboardProps = {
  entity: any;
  onLogout: () => void;
  reportType: ReportType;
};

type FilterType = 'today' | 'week' | 'month' | 'range';

export function ReportsDashboard({ entity, onLogout, reportType }: ReportsDashboardProps) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isDataLoading, startDataTransition] = useTransition();
  const [activeFilter, setActiveFilter] = useState<FilterType>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const { toast } = useToast();

  const fetchData = useCallback(() => {
    startDataTransition(async () => {
      try {
        let appointmentsData;
        if (reportType === 'clinic') {
            appointmentsData = await getAppointmentsForClinic(entity.id);
        } else if (reportType === 'x-ray') {
            appointmentsData = await getXRayAppointments();
        } else if (reportType === 'ultrasound') {
            appointmentsData = await getUltrasoundAppointments();
        } else if (reportType === 'laboratorio') {
            appointmentsData = await getLabAppointments();
        } else if (reportType === 'vacunas') {
            appointmentsData = await getVaccineAppointments();
        }
        setAppointments(appointmentsData || []);
      } catch (error) {
        console.error('Error fetching data for reports dashboard', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos de las citas.',
          variant: 'destructive',
        });
      }
    });
  }, [entity.id, reportType, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const appointmentsToDisplay = useMemo(() => {
    if (!appointments || appointments.length === 0) {
      return [];
    }

    let filterFn: (app: any) => boolean;
    const now = new Date();

    switch (activeFilter) {
      case 'week':
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        filterFn = (app) => {
          const appDate = parseISO(app.date);
          return appDate >= weekStart && appDate <= weekEnd;
        };
        break;
      case 'month':
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        filterFn = (app) => {
          const appDate = parseISO(app.date);
          return appDate >= monthStart && appDate <= monthEnd;
        };
        break;
      case 'range':
        if (dateRange?.from && dateRange.to) {
          const rangeStart = startOfDay(dateRange.from);
          const rangeEnd = endOfDay(dateRange.to);
          filterFn = (app) => {
            const appDate = parseISO(app.date);
            return appDate >= rangeStart && appDate <= rangeEnd;
          };
        } else {
          return [];
        }
        break;
      case 'today':
      default:
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        filterFn = (app) => {
          const appDate = parseISO(app.date);
          return appDate >= todayStart && appDate <= todayEnd;
        };
        break;
    }
    return appointments
      .filter(filterFn)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, activeFilter, dateRange]);

  const handleSetDateRange = (range: DateRange | undefined) => {
    setDateRange(range);
    setActiveFilter('range');
  };

  const handleDownload = () => {
    if (appointmentsToDisplay.length === 0) {
      toast({
        title: 'No hay datos',
        description: 'No hay citas para descargar en el filtro actual.',
        variant: 'destructive',
      });
      return;
    }
    let filename = '';
    if (reportType === 'clinic') filename = `reporte_${entity.name}_${activeFilter}`;
    if (reportType === 'x-ray') filename = `reporte_rayos_x_${activeFilter}`;
    if (reportType === 'ultrasound') filename = `reporte_ultrasonidos_${activeFilter}`;
    if (reportType === 'laboratorio') filename = `reporte_laboratorio_${activeFilter}`;
    if (reportType === 'vacunas') filename = `reporte_vacunas_${activeFilter}`;

    downloadExcel(appointmentsToDisplay, filename);
  };

  const summaryCounts = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    return {
      today: appointments.filter(app => isWithinInterval(parseISO(app.date), { start: todayStart, end: todayEnd })).length,
      week: appointments.filter(app => isWithinInterval(parseISO(app.date), { start: weekStart, end: weekEnd })).length,
      month: appointments.filter(app => isWithinInterval(parseISO(app.date), { start: monthStart, end: monthEnd })).length,
    }
  }, [appointments]);

  const renderAppointmentList = () => {
    switch(reportType) {
        case 'clinic':
            return <AppointmentList appointments={appointmentsToDisplay as Appointment[]} clinics={[]} onEditSuccess={fetchData} />;
        case 'laboratorio':
            return <LabAppointmentList appointments={appointmentsToDisplay as LabAppointment[]} onEditSuccess={fetchData} />;
        case 'x-ray':
            return <XRayAppointmentList appointments={appointmentsToDisplay as XRayAppointment[]} onEditSuccess={fetchData} />;
        case 'ultrasound':
            return <UltrasoundAppointmentList appointments={appointmentsToDisplay as UltrasoundAppointment[]} onEditSuccess={fetchData} />;
        case 'vacunas':
            return <VaccineAppointmentList appointments={appointmentsToDisplay as VaccineAppointment[]} onEditSuccess={fetchData} />;
        default:
            return <p>Tipo de reporte no reconocido.</p>
    }
  }


  return (
    <div className="space-y-8 container mx-auto px-4 py-8 md:py-12">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-3xl font-bold font-headline">
              Reportes de Citas: {entity.name}
            </CardTitle>
            <CardDescription>
              Bienvenido, {entity.doctorName}. Visualiza y gestiona las
              citas.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Citas del Día</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryCounts.today}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Citas de la Semana</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryCounts.week}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Citas del Mes</CardTitle>
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryCounts.month}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="w-full max-w-7xl mx-auto shadow-lg">
        <CardHeader>
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
                        {format(dateRange.from, 'LLL dd, y', {locale: es})} -{' '}
                        {format(dateRange.to, 'LLL dd, y', {locale: es})}
                      </>
                    ) : (
                      format(dateRange.from, 'LLL dd, y', {locale: es})
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
          {isDataLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-4 text-muted-foreground">
                Cargando citas...
              </span>
            </div>
          ) : (
            <>
              {appointmentsToDisplay.length > 0 ? (
                renderAppointmentList()
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  No hay citas para mostrar con los filtros seleccionados.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
