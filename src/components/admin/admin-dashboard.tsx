'use client';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import type { Appointment, Clinic, Colonia } from '@/lib/definitions';
import { deleteAppointment } from '@/lib/actions';
import { getAppointments } from '@/lib/data-client';
import { getClinics, getColonias } from '@/lib/data';
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
  RefreshCw,
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
import { ClinicsManager } from './clinics-manager';
import { ColoniasManager } from './colonias-manager';

type AdminDashboardProps = {
  onLogout: () => void;
};

type FilterType = 'today' | 'week' | 'month' | 'range';

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [colonias, setColonias] = useState<Colonia[]>([]);

  const [isPending, startTransition] = useTransition();
  const [activeFilter, setActiveFilter] = useState<FilterType>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const { toast } = useToast();

  const fetchData = useCallback(() => {
    startTransition(async () => {
      try {
        const [appointmentsData, clinicsData, coloniasData] =
          await Promise.all([getAppointments(), getClinics(), getColonias()]);
        setAllAppointments(appointmentsData);
        setClinics(clinicsData);
        setColonias(coloniasData);
      } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        toast({
          title: 'Error de Carga',
          description:
            'No se pudieron cargar todos los datos del panel. Por favor, recarga.',
          variant: 'destructive',
        });
      }
    });
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const appointmentsToDisplay = useMemo(() => {
    if (!allAppointments || allAppointments.length === 0) {
      return [];
    }

    const now = new Date();
    let filterFn: (app: Appointment) => boolean;

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
        if (dateRange?.from && dateRange?.to) {
          const rangeStart = startOfDay(dateRange.from);
          const rangeEnd = endOfDay(dateRange.to);
          filterFn = (app) => {
            const appDate = parseISO(app.date);
            return appDate >= rangeStart && appDate <= rangeEnd;
          };
        } else {
          return []; // No range selected, show nothing
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
    return allAppointments.filter(filterFn);
  }, [activeFilter, dateRange, allAppointments]);


  const handleSetDateRange = (range: DateRange | undefined) => {
    setDateRange(range);
    setActiveFilter('range');
  };

  const handleDownload = () => {
    const dataToDownload = appointmentsToDisplay;
    if (dataToDownload.length === 0) {
      toast({
        title: 'No hay datos para descargar',
        description: 'No hay citas en el filtro actual para exportar.',
        variant: 'destructive',
      });
      return;
    }

    // Create a safe, enriched copy for download without mutating the original data
    const enrichedAppointments = dataToDownload.map((app) => {
      const clinic = clinics.find((c) => c.id === app.clinicId);
      // This is a simplification; in a real app, you might need to find the colonia based on patient ID or another logic
      const patientColonia = colonias.find((c) => c.clinicId === app.clinicId); // Example logic
      return {
        ...app,
        clinicName: clinic?.name || 'N/A',
        coloniaName: patientColonia?.name || 'N/A', // This property is not standard on Appointment
      };
    });

    downloadExcel(enrichedAppointments, `citas_${activeFilter}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAppointment(id);
      toast({
        title: 'Cita Eliminada',
        description: 'La cita ha sido eliminada y el cupo liberado.',
      });
      fetchData(); // Refresca los datos para asegurar consistencia
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cita.',
        variant: 'destructive',
      });
    }
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
              Bienvenido, SuperAdmin. Gestiona las citas y configuraciones.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchData} disabled={isPending}>
              <RefreshCw
                className={cn('mr-2 h-4 w-4', isPending && 'animate-spin')}
              />
              Recargar Datos
            </Button>
            <Button variant="outline" onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <ClinicsManager />
          <ColoniasManager />
        </div>
        <AnnouncementsManager />
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
              disabled={isPending}
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
              <span className="ml-4 text-muted-foreground">
                Cargando citas...
              </span>
            </div>
          ) : (
            <AppointmentList
              appointments={appointmentsToDisplay}
              onDelete={handleDelete}
              isAdmin
              clinics={clinics}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
