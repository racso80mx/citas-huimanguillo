'use client';
import { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import type { Appointment, Clinic, LabAppointment, XRayAppointment, UltrasoundAppointment, VaccineAppointment } from '@/lib/definitions';
import {
  getAppointmentsForClinic,
  getLabAppointments,
  getXRayAppointments,
  getUltrasoundAppointments,
  getVaccineAppointments,
  deleteAppointment,
  deleteLabAppointment,
  deleteXRayAppointment,
  deleteUltrasoundAppointment,
  deleteVaccineAppointment,
  getClinics,
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
  UserCheck,
  Clock,
  UserX,
  PlusCircle,
  RefreshCw,
  Pill,
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
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AppointmentList } from '../appointment-list';
import { LabAppointmentList } from '../laboratorio/lab-appointment-list';
import { XRayAppointmentList } from '../rayos-x/x-ray-appointment-list';
import { UltrasoundAppointmentList } from '../ultrasonidos/ultrasound-appointment-list';
import { VaccineAppointmentList } from '../vacunas/vaccine-appointment-list';
import { LabSettingsManager } from '../admin/lab-settings-manager';
import { XRaySettingsManager } from '../admin/x-ray-settings-manager';
import { UltrasoundSettingsManager } from '../admin/ultrasound-settings-manager';
import { VaccineSettingsManager } from '../admin/vaccine-settings-manager';
import { MedicationInventoryDialog } from './medication-inventory-dialog';
import Link from 'next/link';

type ReportType = 'clinic' | 'x-ray' | 'ultrasound' | 'laboratorio' | 'vacunas';

type ReportsDashboardProps = {
  entity: any;
  onLogout: () => void;
  reportType: ReportType;
};

type FilterType = 'today' | 'week' | 'month' | 'range';

export function ReportsDashboard({ entity, onLogout, reportType }: ReportsDashboardProps) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isDataLoading, startDataTransition] = useTransition();
  const [activeFilter, setActiveFilter] = useState<FilterType>('today');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isClient, setIsClient] = useState(false);
  const [isMedicationDialogOpen, setIsMedicationDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchData = useCallback(() => {
    startDataTransition(async () => {
      try {
        let appointmentsData;
        const clinicsData = await getClinics();
        setClinics(clinicsData);

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
    if (!isClient || !appointments || appointments.length === 0) {
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
          return isWithinInterval(appDate, { start: weekStart, end: weekEnd });
        };
        break;
      case 'month':
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        filterFn = (app) => {
          const appDate = parseISO(app.date);
          return isWithinInterval(appDate, { start: monthStart, end: monthEnd });
        };
        break;
      case 'range':
        if (dateRange?.from) {
          const rangeStart = startOfDay(dateRange.from);
          const rangeEnd = endOfDay(dateRange.to || dateRange.from);
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
          return isWithinInterval(appDate, { start: todayStart, end: todayEnd });
        };
        break;
    }
    return appointments
      .filter(filterFn)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [isClient, appointments, activeFilter, dateRange]);

  const newAppointmentPath = useMemo(() => {
    switch (reportType) {
      case 'clinic':
        return '/citas-medicas';
      case 'laboratorio':
        return '/laboratorio';
      case 'x-ray':
        return '/rayos-x';
      case 'ultrasound':
        return '/ultrasonidos';
      case 'vacunas':
        return '/vacunas';
      default:
        return '/';
    }
  }, [reportType]);

  const handleDelete = async (id: string) => {
    try {
      if (reportType === 'clinic') await deleteAppointment(id);
      if (reportType === 'laboratorio') await deleteLabAppointment(id);
      if (reportType === 'x-ray') await deleteXRayAppointment(id);
      if (reportType === 'ultrasound') await deleteUltrasoundAppointment(id);
      if (reportType === 'vacunas') await deleteVaccineAppointment(id);

      toast({
        title: 'Cita Eliminada',
        description: 'La cita ha sido eliminada correctamente.',
      });
      fetchData(); // Refresh data after deletion
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cita.',
        variant: 'destructive',
      });
    }
  };


  const handleSetDateRange = (range: DateRange | undefined) => {
    setDateRange(range);
    setActiveFilter('range');
  };

  const handleDownload = async () => {
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

    const enrichedData = appointmentsToDisplay.map(app => {
      const clinic = clinics.find(c => c.id === app.clinicId);
      return {
        ...app,
        clinicName: clinic?.name || 'N/A'
      };
    });

    const xlsx = await import('xlsx');
    
    const worksheetData = enrichedData.map(
        (item: any) => {
            const baseData: any = {
                'Folio': item.appointmentNumber,
                'Fecha': format(parseISO(item.date), 'dd/MM/yyyy'),
                'Hora': item.time,
                'Estado': item.status,
                'Paciente': item.patient ? `${item.patient.name} ${item.patient.paternalLastName} ${item.patient.maternalLastName}`: 'N/A',
                'CURP': item.patient?.curp || 'N/A',
                'Teléfono': item.patient?.phoneNumber || 'N/A',
            };

            if (reportType === 'laboratorio') {
                const labItem = item as LabAppointment;
                baseData['Estudios'] = labItem.studies.map(s => s.name).join(', ');
            } else if (reportType === 'x-ray') {
                 const xrayItem = item as XRayAppointment;
                 baseData['Estudio'] = xrayItem.studyName;
            } else if (reportType === 'ultrasound') {
                 const ultrasoundItem = item as UltrasoundAppointment;
                 baseData['Estudio'] = ultrasoundItem.studyName;
            } else if (reportType === 'vacunas') {
                const vaccineItem = item as VaccineAppointment;
                baseData['Colonia'] = vaccineItem.coloniaName || 'N/A';
                baseData['Vacunas'] = vaccineItem.vaccines.map(v => v.name).join(', ');
                baseData['Recién Nacido'] = vaccineItem.patientType === 'Recién Nacido' ? 'Sí' : 'No';
            } else { // clinic
                const regularItem = item as Appointment;
                if (regularItem.time.includes('Ficha')) {
                    baseData['Ficha'] = regularItem.time.split(' ')[1];
                }
                baseData['Núcleo'] = (item as any).clinicName;
                baseData['Colonia'] = regularItem.coloniaName || 'N/A';
                baseData['Tipo Paciente'] = regularItem.patientType;
            }
            return baseData;
        }
    );

  const worksheet = xlsx.utils.json_to_sheet(worksheetData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Citas');

  if (worksheetData.length > 0) {
    const cols = Object.keys(worksheetData[0]);
    const colWidths = cols.map(col => ({
        wch: Math.max(...worksheetData.map(row => (row[col as keyof typeof row] ?? '').toString().length), col.length) + 1
    }));
    worksheet['!cols'] = colWidths;
  }

  xlsx.writeFile(workbook, `${filename}.xlsx`);
  };

  const summaryCounts = useMemo(() => {
    if (!isClient) {
        return { total: 0, attended: 0, pending: 0, notAttended: 0 };
    }
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const todaysAppointments = appointments.filter(app => isWithinInterval(parseISO(app.date), { start: todayStart, end: todayEnd }));

    return {
      total: todaysAppointments.length,
      attended: todaysAppointments.filter(app => app.status === 'Atendido').length,
      pending: todaysAppointments.filter(app => app.status === 'Agendada' || !app.status).length,
      notAttended: todaysAppointments.filter(app => app.status === 'No Asistió' || app.status === 'No Atendido').length,
    }
  }, [isClient, appointments]);

  const renderAppointmentList = () => {
    const props = {
      isAdmin: true,
      onEditSuccess: fetchData,
      // Deshabilitamos onDelete específicamente para los reportes de Núcleos Básicos
      onDelete: reportType === 'clinic' ? undefined : handleDelete,
    };
    switch(reportType) {
        case 'clinic':
            return <AppointmentList appointments={appointmentsToDisplay as Appointment[]} clinics={clinics} {...props} />;
        case 'laboratorio':
            return <LabAppointmentList appointments={appointmentsToDisplay as LabAppointment[]} {...props} />;
        case 'x-ray':
            return <XRayAppointmentList appointments={appointmentsToDisplay as XRayAppointment[]} {...props} />;
        case 'ultrasound':
            return <UltrasoundAppointmentList appointments={appointmentsToDisplay as UltrasoundAppointment[]} {...props} />;
        case 'vacunas':
            return <VaccineAppointmentList appointments={appointmentsToDisplay as VaccineAppointment[]} {...props} />;
        default:
            return <p>Tipo de reporte no reconocido.</p>
    }
  }

  const renderSettingsManager = () => {
    switch(reportType) {
        case 'laboratorio':
            return <LabSettingsManager />;
        case 'x-ray':
            return <XRaySettingsManager />;
        case 'ultrasound':
            return <UltrasoundSettingsManager />;
        case 'vacunas':
            return <VaccineSettingsManager />;
        default:
            return null;
    }
  }


  return (
    <div className="space-y-8 px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div className="min-w-[300px]">
            <CardTitle className="text-3xl font-bold font-headline">
              Reportes de Citas: {entity.name}
            </CardTitle>
            <CardDescription>
              Bienvenido, {entity.doctorName}. Visualiza y gestiona las
              citas.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="default" className="bg-primary hover:bg-primary/90" onClick={() => setIsMedicationDialogOpen(true)}>
                <Pill className="mr-2 h-4 w-4" />
                Consultar Farmacia
            </Button>
            <Button variant="outline" onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Citas Totales (Hoy)</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryCounts.total}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atendidos</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summaryCounts.attended}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {summaryCounts.pending}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Asistieron / No Atendidos</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {summaryCounts.notAttended}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="w-full shadow-lg">
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
            <Button
              variant="outline"
              onClick={fetchData}
              disabled={isDataLoading}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isDataLoading && "animate-spin")} />
              Recargar
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
            <div className="ml-auto flex items-center gap-2">
                <Button
                    onClick={handleDownload}
                    variant="secondary"
                    >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Excel
                </Button>
            </div>
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
      <div className="w-full mt-8">
        {renderSettingsManager()}
      </div>

      <MedicationInventoryDialog 
        isOpen={isMedicationDialogOpen} 
        onClose={() => setIsMedicationDialogOpen(false)} 
      />
    </div>
  );
}
