'use client'
import { useState, useEffect, useTransition } from 'react';
import type { Appointment, User, Clinic } from '@/lib/definitions';
import { getAppointments, getClinics } from '@/lib/data';
import { updateAppointmentStatus } from '@/lib/actions';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2, Calendar as CalendarIcon, Check, X, Clock } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ReportsDashboardProps = {
  user: User;
  onLogout: () => void;
};

type FilterType = 'today' | 'week' | 'month' | 'range';

export function ReportsDashboard({ user, onLogout }: ReportsDashboardProps) {
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string | undefined>(user.clinicId);

  const [isPending, startTransition] = useTransition();
  const [isStatusPending, startStatusTransition] = useTransition();
  const [activeFilter, setActiveFilter] = useState<FilterType>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const { toast } = useToast();

  const fetchData = () => {
    startTransition(async () => {
      try {
        const [appointments, clinicsData] = await Promise.all([getAppointments(), getClinics()]);
        setAllAppointments(appointments);
        setClinics(clinicsData);

        // Set the initial selected clinic
        if (user.role === 'doctor' && user.clinicId) {
          setSelectedClinicId(user.clinicId);
        } else if (user.role === 'admin' && clinicsData.length > 0) {
          // Admin defaults to the first clinic in the list if none is selected
          if(!selectedClinicId){
            setSelectedClinicId(clinicsData[0].id);
          }
        }
      } catch (error) {
          console.error("Error fetching data for reports dashboard", error);
          toast({ title: "Error", description: "No se pudieron cargar los datos de las citas.", variant: "destructive"});
      }
    });
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAppointments, activeFilter, dateRange, selectedClinicId]);

  const applyFilters = () => {
    let clinicFiltered = allAppointments;

    if (selectedClinicId) {
       clinicFiltered = allAppointments.filter(app => app.clinicId === selectedClinicId);
    }
    
    let dateFiltered: Appointment[] = [];
    const now = new Date();

    switch (activeFilter) {
      case 'today':
        dateFiltered = clinicFiltered.filter(app => format(parseISO(app.date), 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd'));
        break;
      case 'week':
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        dateFiltered = clinicFiltered.filter(app => parseISO(app.date) >= weekStart && parseISO(app.date) <= weekEnd);
        break;
      case 'month':
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        dateFiltered = clinicFiltered.filter(app => parseISO(app.date) >= monthStart && parseISO(app.date) <= monthEnd);
        break;
      case 'range':
        if (dateRange?.from && dateRange.to) {
          const rangeStart = startOfDay(dateRange.from);
          const rangeEnd = endOfDay(dateRange.to);
          dateFiltered = clinicFiltered.filter(app => parseISO(app.date) >= rangeStart && parseISO(app.date) <= rangeEnd);
        } else {
          // If range is not complete, default to today's view for the selected clinic
          dateFiltered = clinicFiltered.filter(app => format(parseISO(app.date), 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd'));
        }
        break;
      default:
        dateFiltered = clinicFiltered.filter(app => format(parseISO(app.date), 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd'));
    }
    setFilteredAppointments(dateFiltered.sort((a, b) => a.time.localeCompare(b.time)));
  };
  
  const handleSetDateRange = (range: DateRange | undefined) => {
    setDateRange(range);
    setActiveFilter('range');
  }

  const handleStatusChange = async (appointmentId: string, status: 'Atendida' | 'Cancelada') => {
      startStatusTransition(async () => {
        const result = await updateAppointmentStatus(appointmentId, status);
        if (result.success) {
            toast({ title: "Estado Actualizado", description: "El estado de la cita ha sido actualizado."});
            fetchData(); // Refresh data to reflect changes
        } else {
            toast({ title: "Error", description: result.message || "No se pudo actualizar el estado de la cita.", variant: "destructive"});
        }
      })
  }

  const statusCounts = filteredAppointments.reduce((acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-3xl font-bold font-headline">
              Reportes de Citas
            </CardTitle>
            <CardDescription>
              Bienvenido, {user.name}. Visualiza y gestiona las citas.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </Button>
        </CardHeader>
      </Card>

      {user.role === 'admin' && (
          <Card>
              <CardHeader>
                  <CardTitle>Seleccionar Núcleo Básico</CardTitle>
              </CardHeader>
              <CardContent>
                  <Select onValueChange={setSelectedClinicId} value={selectedClinicId}>
                      <SelectTrigger className='w-full md:w-[300px]'>
                          <SelectValue placeholder="Selecciona un núcleo..." />
                      </SelectTrigger>
                      <SelectContent>
                          {clinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </CardContent>
          </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{statusCounts['Pendiente'] || 0}</div>
            </CardContent>
        </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Atendidas</CardTitle>
                <Check className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{statusCounts['Atendida'] || 0}</div>
            </CardContent>
        </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
                <X className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{statusCounts['Cancelada'] || 0}</div>
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
          </div>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-4 text-muted-foreground">Cargando citas...</span>
            </div>
          ) : (
            <>
              {filteredAppointments.length > 0 ? (
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Folio</TableHead>
                            <TableHead>Paciente</TableHead>
                            <TableHead>Hora</TableHead>
                            <TableHead>Tipo Paciente</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className='text-right'>Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAppointments.map(app => (
                            <TableRow key={app.id} className={isStatusPending ? 'opacity-50' : ''}>
                                <TableCell>{app.appointmentNumber}</TableCell>
                                <TableCell>{app.patient.name} {app.patient.paternalLastName}</TableCell>
                                <TableCell>{app.time}</TableCell>
                                <TableCell>{app.patientType}</TableCell>
                                <TableCell>
                                  <span className={cn(
                                    'px-2 py-1 rounded-full text-xs font-medium',
                                    app.status === 'Pendiente' && 'bg-yellow-100 text-yellow-800',
                                    app.status === 'Atendida' && 'bg-green-100 text-green-800',
                                    app.status === 'Cancelada' && 'bg-red-100 text-red-800'
                                  )}>
                                    {app.status}
                                  </span>
                                </TableCell>
                                <TableCell className='text-right'>
                                    <Button size="sm" variant="outline" onClick={() => handleStatusChange(app.id, 'Atendida')} disabled={app.status !== 'Pendiente' || isStatusPending}>
                                        <Check className='mr-2 h-4 w-4 text-green-600'/> Atendida
                                    </Button>
                                     <Button size="sm" variant="destructive" className='ml-2' onClick={() => handleStatusChange(app.id, 'Cancelada')} disabled={app.status !== 'Pendiente' || isStatusPending}>
                                        <X className='mr-2 h-4 w-4'/> Cancelar
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                 </Table>
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
