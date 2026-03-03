'use client';
import { useState, useTransition, useMemo, useCallback, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import type { Appointment, Clinic, Patient, AppointmentStatus } from '@/lib/definitions';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from './ui/button';
import { Trash2, Pencil, Loader2, ArrowUpDown, ArrowUp, ArrowDown, FileDown, ClipboardCopy, MessageCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { EditPatientForm } from './admin/edit-patient-form';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { updateAppointmentStatus, rescheduleAppointment, cloneAppointment, getAnnouncements, getAvailableSlotsForDate } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from './ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from './ui/label';


type AppointmentListProps = {
  appointments: Appointment[];
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  clinics: Clinic[];
  onEditSuccess?: () => void;
};

type SortableKeys = keyof Appointment | 'patientName' | 'clinicName' | 'curp' | 'phoneNumber' | 'coloniaName';


export function AppointmentList({ appointments, isAdmin = false, onDelete, clinics, onEditSuccess }: AppointmentListProps) {
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [isUpdating, startUpdateTransition] = useTransition();
  const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>(null);
  
  const [reschedulingAppointment, setReschedulingAppointment] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [isRescheduling, startRescheduleTransition] = useTransition();

  const [cloningAppointment, setCloningAppointment] = useState<Appointment | null>(null);
  const [newCloneDate, setNewCloneDate] = useState<Date | undefined>();
  const [newCloneTime, setNewCloneTime] = useState<string | undefined>();
  const [availableCloneSlots, setAvailableCloneSlots] = useState<{ timeSlots?: string[], tokens?: number[] }>({});
  const [isFetchingSlots, startFetchingSlotsTransition] = useTransition();
  const [isCloning, startCloneTransition] = useTransition();
  
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchAnnouncements() {
      const data = await getAnnouncements();
      setAnnouncements(data);
    }
    fetchAnnouncements();
  }, []);

  const cloningClinic = useMemo(() => {
      if (!cloningAppointment) return null;
      return clinics.find(c => c.id === cloningAppointment.clinicId);
  }, [cloningAppointment, clinics]);

  useEffect(() => {
    if (cloningAppointment && newCloneDate) {
      startFetchingSlotsTransition(async () => {
        const slots = await getAvailableSlotsForDate(cloningAppointment.clinicId, newCloneDate.toISOString());
        setAvailableCloneSlots(slots);
        setNewCloneTime(undefined); // Reset selection when date changes
      });
    }
  }, [cloningAppointment, newCloneDate]);

  const handleCopyCurp = (curp: string) => {
    navigator.clipboard.writeText(curp).then(() => {
      toast({
        title: 'CURP Copiada',
        description: `Se ha copiado la CURP: ${curp}`,
      });
    }).catch(err => {
      console.error('Failed to copy CURP: ', err);
      toast({
        title: 'Error al copiar',
        description: 'No se pudo copiar la CURP al portapapeles.',
        variant: 'destructive',
      });
    });
  };

  const handleWhatsApp = (app: Appointment) => {
    const phone = app.patient?.phoneNumber;
    if (!phone) {
        toast({ title: "Sin teléfono", description: "El paciente no tiene un número registrado.", variant: "destructive" });
        return;
    }
    const clinic = clinics.find(c => c.id === app.clinicId);
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedDate = format(parseISO(app.date), "eeee dd 'de' MMMM", { locale: es });
    
    const obs = announcements.length > 0 ? `\n\nAvisos: ${announcements.join(' - ')}` : '';
    
    const message = encodeURIComponent(`Hola ${app.patient.name}, le contactamos del Hospital General de Huimanguillo para confirmar su cita médica con folio ${app.appointmentNumber} para el día ${formattedDate} a las ${app.time} en el consultorio ${clinic?.name || 'N/A'} con el Dr(a). ${clinic?.doctorName || 'N/A'}.${obs}`);
    
    window.open(`https://wa.me/52${cleanPhone}?text=${message}`, '_blank');
  };

  const getClinicName = useCallback((clinicId: string) => {
    return clinics.find(c => c.id === clinicId)?.name || clinicId;
  }, [clinics]);

  const sortedAppointments = useMemo(() => {
    let sortableItems = [...appointments];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        switch (sortConfig.key) {
          case 'patientName':
            aValue = a.patient ? `${a.patient.name} ${a.patient.paternalLastName} ${a.patient.maternalLastName}` : '';
            bValue = b.patient ? `${b.patient.name} ${b.patient.paternalLastName} ${b.patient.maternalLastName}` : '';
            break;
          case 'clinicName':
            aValue = getClinicName(a.clinicId);
            bValue = getClinicName(b.clinicId);
            break;
          case 'curp':
            aValue = a.patient?.curp || '';
            bValue = b.patient?.curp || '';
            break;
          case 'phoneNumber':
            aValue = a.patient?.phoneNumber || '';
            bValue = b.patient?.phoneNumber || '';
            break;
          case 'coloniaName':
            aValue = a.coloniaName || '';
            bValue = b.coloniaName || '';
            break;
          case 'date':
             aValue = new Date(a.date).getTime();
             bValue = new Date(b.date).getTime();
             break;
          default:
            aValue = a[sortConfig.key as keyof Appointment];
            bValue = b[sortConfig.key as keyof Appointment];
        }

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [appointments, sortConfig, getClinicName]);

  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key: SortableKeys) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    if (sortConfig.direction === 'ascending') {
      return <ArrowUp className="ml-2 h-4 w-4 text-primary" />;
    }
    return <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  const handleStatusChange = (appointmentId: string, status: AppointmentStatus) => {
    startUpdateTransition(async () => {
      const result = await updateAppointmentStatus(appointmentId, status, 'medical');
      if (result.success) {
        toast({ title: 'Estado actualizado' });
        onEditSuccess?.();
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    });
  };

  const handleRescheduleConfirm = () => {
    if (!reschedulingAppointment || !newDate) return;

    startRescheduleTransition(async () => {
        const result = await rescheduleAppointment(reschedulingAppointment.id, newDate.toISOString(), 'medical');
        if (result.success) {
            toast({
                title: 'Fecha Actualizada',
                description: result.message,
            });
            setReschedulingAppointment(null);
            setNewDate(undefined);
            onEditSuccess?.();
        } else {
            toast({
                title: 'Error al Cambiar Fecha',
                description: result.message,
                variant: 'destructive',
            });
        }
    });
  };

  const handleCloneConfirm = () => {
    if (!cloningAppointment || !newCloneDate || !newCloneTime) return;

    startCloneTransition(async () => {
        const result = await cloneAppointment(cloningAppointment.id, newCloneDate.toISOString(), 'medical', newCloneTime);
        if (result.success) {
            toast({
                title: 'Nueva Cita Asignada',
                description: result.message,
            });
            setCloningAppointment(null);
            setNewCloneDate(undefined);
            setNewCloneTime(undefined);
            setAvailableCloneSlots({});
            onEditSuccess?.();
        } else {
            toast({
                title: 'Error al Asignar Cita',
                description: result.message,
                variant: 'destructive',
            });
        }
    });
  };
  
  const handleDownloadPDF = async (appointment: Appointment) => {
    const clinic = clinics.find(c => c.id === appointment.clinicId);
    if (!clinic) {
      toast({
        title: 'Error',
        description: 'No se encontraron los datos de la clínica para generar el PDF.',
        variant: 'destructive',
      });
      return;
    }
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');
    const doc = new jsPDF() as any;
    const { patient, date, time, appointmentNumber, patientType } = appointment;

    doc.setFont('Helvetica');
    doc.setFontSize(22);
    doc.text('Confirmación de Cita Médica', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Hospital General de Huimanguillo', 105, 31, { align: 'center' });
    
    let currentY = 50;
    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text(`Folio de Cita: ${appointmentNumber}`, 20, currentY);
    currentY += 8;

    doc.setLineWidth(0.5);
    doc.line(20, currentY - 4, 190, currentY - 4);

    currentY += 5;

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Datos del Paciente:', 20, currentY);
    currentY += 10;
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Nombre: ${patient.name} ${patient.paternalLastName} ${patient.maternalLastName}`, 20, currentY);
    currentY += 10;
    doc.text(`Tipo de Paciente: ${patientType}`, 20, currentY);
    currentY += 10;
    doc.text(`CURP: ${patient.curp}`, 20, currentY);
    currentY += 10;
    doc.text(`Teléfono: ${patient.phoneNumber}`, 20, currentY);
    currentY += 20;

    doc.setFontSize(16);
    doc.setFont('Helvetica', 'bold');
    doc.text('Detalles de la Cita:', 20, currentY);
    currentY += 10;
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'normal');
    const formattedDate = format(new Date(date), "eeee, dd 'de' MMMM 'de' yyyy", { locale: es });
    doc.text(`Fecha: ${formattedDate}`, 20, currentY);
    currentY += 10;
    
    if (time.includes('Ficha')) {
        doc.text(`Ficha de Turno: ${time.split(' ')[1]}`, 20, currentY);
    } else {
        doc.text(`Hora: ${time}`, 20, currentY);
    }
    currentY += 10;

    doc.text(`Clínica: ${clinic.name}`, 20, currentY);
    currentY += 10;
    doc.text(`Doctor(a): ${clinic.doctorName}`, 20, currentY);
    currentY += 10;
    
    let finalY = currentY;

    if (announcements && announcements.length > 0) {
        doc.setFontSize(14);
        doc.setFont('Helvetica', 'bold');
        doc.text('Avisos Importantes:', 20, finalY);
        finalY += 7;
        
        doc.autoTable({
            startY: finalY,
            body: announcements.map(a => [a]),
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 1, halign: 'left' },
        });
        finalY = doc.lastAutoTable.finalY + 5;
    }

    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Por favor, llegue 15 minutos antes de su cita.', 20, finalY);
    doc.text('Presentarse con identificación personal (INE).', 20, finalY + 5)
    doc.text('Este es un comprobante de su cita, puede mostrar este PDF desde su teléfono.', 20, finalY + 10);

    doc.save(`recibo_cita_${patient.curp}.pdf`);
  };

  if (!appointments || appointments.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No hay citas agendadas para el filtro seleccionado.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableCaption>
          Un total de {appointments.length} citas agendadas.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead><Button variant="ghost" onClick={() => requestSort('appointmentNumber')}>Folio {getSortIcon('appointmentNumber')}</Button></TableHead>
            <TableHead className="w-[120px]"><Button variant="ghost" onClick={() => requestSort('date')}>Fecha / Hora {getSortIcon('date')}</Button></TableHead>
            <TableHead><Button variant="ghost" onClick={() => requestSort('patientName')}>Paciente {getSortIcon('patientName')}</Button></TableHead>
            <TableHead><Button variant="ghost" onClick={() => requestSort('curp')}>CURP {getSortIcon('curp')}</Button></TableHead>
            <TableHead><Button variant="ghost" onClick={() => requestSort('phoneNumber')}>Teléfono {getSortIcon('phoneNumber')}</Button></TableHead>
            <TableHead><Button variant="ghost" onClick={() => requestSort('clinicName')}>Núcleo Básico {getSortIcon('clinicName')}</Button></TableHead>
            <TableHead><Button variant="ghost" onClick={() => requestSort('coloniaName')}>Colonia {getSortIcon('coloniaName')}</Button></TableHead>
            <TableHead><Button variant="ghost" onClick={() => requestSort('patientType')}>Tipo {getSortIcon('patientType')}</Button></TableHead>
            <TableHead><Button variant="ghost" onClick={() => requestSort('status')}>Estado {getSortIcon('status')}</Button></TableHead>
            {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAppointments.map((app) => (
            <TableRow key={app.id}>
              <TableCell className="font-mono">
                {app.appointmentNumber}
                {app.time.includes('Ficha') && <span className="block text-xs font-semibold text-blue-600">({app.time})</span>}
              </TableCell>
              <TableCell className="font-medium">
                {format(parseISO(app.date), 'dd/MM/yy', { locale: es })}
                <span className='block text-xs text-muted-foreground'>{app.time.includes('Ficha') ? 'Recepción General' : app.time}</span>
              </TableCell>
              <TableCell>{app.patient ? `${app.patient.name} ${app.patient.paternalLastName} ${app.patient.maternalLastName}` : 'N/A'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <span>{app.patient?.curp || 'N/A'}</span>
                  {app.patient?.curp && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleCopyCurp(app.patient!.curp)}
                    >
                      <ClipboardCopy className="h-4 w-4" />
                      <span className="sr-only">Copiar CURP</span>
                    </Button>
                  )}
                </div>
              </TableCell>
              <TableCell>{app.patient?.phoneNumber || 'N/A'}</TableCell>
              <TableCell>{getClinicName(app.clinicId)}</TableCell>
              <TableCell>{app.coloniaName || 'N/A'}</TableCell>
              <TableCell>{app.patientType}</TableCell>
              <TableCell>
                {onEditSuccess ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-28" disabled={isUpdating}>
                        {app.status || 'Agendada'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => handleStatusChange(app.id, 'Atendido')}>Atendido</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleStatusChange(app.id, 'No Atendido')}>No Atendido</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleStatusChange(app.id, 'No Asistió')}>No Asistió</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => { setNewCloneDate(undefined); setCloningAppointment(app); }}>Asignar Nueva Cita</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => {
                          setNewDate(new Date(app.date));
                          setReschedulingAppointment(app);
                      }}>Cambiar Fecha</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  app.status || 'Agendada'
                )}
              </TableCell>
               {isAdmin && app.patient && (
                <TableCell className="text-right">
                  <div className='flex justify-end items-center'>
                    <Button variant="ghost" size="icon" onClick={() => handleWhatsApp(app)} title="Enviar recordatorio WhatsApp">
                        <MessageCircle className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDownloadPDF(app)}>
                        <FileDown className="h-4 w-4 text-gray-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditingPatient(app.patient)}>
                        <Pencil className="h-4 w-4 text-blue-600" />
                    </Button>
                   <AlertDialog>
                    <AlertDialogTrigger asChild>
                       <Button variant="ghost" size="icon" disabled={!onDelete}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Se eliminará permanentemente la cita de
                          <span className='font-bold'>{app.patient ? ` ${app.patient.name} ${app.patient.paternalLastName} ${app.patient.maternalLastName} ` : 'este paciente '}</span>
                           ({app.appointmentNumber}) y el espacio quedará libre.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete?.(app.id)} className='bg-destructive hover:bg-destructive/90'>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
       {editingPatient && (
        <Dialog open={!!editingPatient} onOpenChange={(open) => !open && setEditingPatient(null)}>
            <DialogContent className="sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Editar Paciente</DialogTitle>
                    <DialogDescription>
                        Modifica los datos del paciente. Los cambios se reflejarán en todas sus citas.
                    </DialogDescription>
                </DialogHeader>
                <EditPatientForm 
                    patient={editingPatient} 
                    onFinished={() => { 
                        setEditingPatient(null); 
                        onEditSuccess?.(); 
                    }} 
                />
            </DialogContent>
        </Dialog>
      )}
       {reschedulingAppointment && (
        <Dialog open={!!reschedulingAppointment} onOpenChange={(open) => {
            if (!open) {
                setReschedulingAppointment(null);
                setNewDate(undefined);
            }
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cambiar Fecha de la Cita</DialogTitle>
                    <DialogDescription>
                        Selecciona una nueva fecha para la cita de <span className="font-bold">{reschedulingAppointment.patient.name}</span>.
                        La hora original se conservará si está disponible. De lo contrario, se asignará la más próxima.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center py-4">
                    <Calendar
                        mode="single"
                        selected={newDate}
                        onSelect={setNewDate}
                        initialFocus
                        disabled={{ before: new Date() }}
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setReschedulingAppointment(null)}>Cancelar</Button>
                    <Button onClick={handleRescheduleConfirm} disabled={isRescheduling || !newDate}>
                        {isRescheduling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Nueva Fecha
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
      {cloningAppointment && (
        <Dialog open={!!cloningAppointment} onOpenChange={(open) => {
          if (!open) {
              setCloningAppointment(null);
              setNewCloneDate(undefined);
              setNewCloneTime(undefined);
              setAvailableCloneSlots({});
          }
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Asignar Nueva Cita (Clonar)</DialogTitle>
                    <DialogDescription>
                        Selecciona una nueva fecha y disponibilidad para la cita de <span className="font-bold">{cloningAppointment.patient.name}</span>. Se clonarán los detalles de la cita actual.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center py-4">
                    <Calendar
                        mode="single"
                        selected={newCloneDate}
                        onSelect={setNewCloneDate}
                        initialFocus
                        disabled={{ before: new Date() }}
                    />
                </div>
                
                {newCloneDate && cloningClinic && (
                  <div className="space-y-2">
                    {isFetchingSlots ? (
                      <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando disponibilidad...</div>
                    ) : (
                      <>
                        {cloningClinic.bookingMode === 'token' && (
                          <>
                            <Label>Selecciona una Ficha</Label>
                            <Select onValueChange={setNewCloneTime} value={newCloneTime}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona una ficha disponible..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCloneSlots.tokens && availableCloneSlots.tokens.length > 0 ? (
                                  availableCloneSlots.tokens.map(token => (
                                    <SelectItem key={token} value={String(token)}>Ficha {token}</SelectItem>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-muted-foreground">No hay fichas disponibles.</div>
                                )}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        {cloningClinic.bookingMode === 'time' && (
                          <>
                            <Label>Selecciona una Hora</Label>
                             <Select onValueChange={newCloneTime} value={newCloneTime}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un horario disponible..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCloneSlots.timeSlots && availableCloneSlots.timeSlots.length > 0 ? (
                                  availableCloneSlots.timeSlots.map(time => (
                                    <SelectItem key={time} value={time}>{time}</SelectItem>
                                  ))
                                ) : (
                                  <div className="p-2 text-sm text-muted-foreground">No hay horarios disponibles.</div>
                                )}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setCloningAppointment(null)}>Cancelar</Button>
                    <Button onClick={handleCloneConfirm} disabled={isCloning || !newCloneDate || !newCloneTime || isFetchingSlots}>
                        {isCloning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Nueva Cita
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
