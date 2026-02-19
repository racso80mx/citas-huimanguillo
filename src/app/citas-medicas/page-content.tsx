'use client';
import React from 'react';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import { BookingForm } from '@/components/booking-form';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import type { DailyAvailability, Colonia, Clinic } from '@/lib/definitions';
import { PatientType, BookingMode, ClinicType } from '@/lib/definitions';
import { getAppointments, getClinics } from '@/lib/data';

import { useToast } from '@/hooks/use-toast';
import { Bell, Clock, MapPin, UserCheck, Ticket, Stethoscope } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSaturday, isSunday, startOfToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';

type PageContentProps = {
    initialAnnouncements: string[];
    initialColonias: Colonia[];
    initialClinics: Clinic[];
};

export default function PageContent({ initialAnnouncements, initialColonias, initialClinics }: PageContentProps) {
  const [selectedClinicType, setSelectedClinicType] = React.useState<ClinicType | undefined>();
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [selectedColoniaId, setSelectedColoniaId] = React.useState<string | undefined>();
  const [selectedTime, setSelectedTime] = React.useState<string | undefined>();
  const [patientType, setPatientType] = React.useState<PatientType>(PatientType.General);

  const [availability, setAvailability] = React.useState<DailyAvailability[]>([]);
  const [announcements] = React.useState<string[]>(initialAnnouncements);
  const [colonias] = React.useState<Colonia[]>(initialColonias);
  const [clinics, setClinics] = React.useState<Clinic[]>(initialClinics);
  
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [isPending, startTransition] = React.useTransition();
  const { toast } = useToast();

  const generateDynamicTimeSlots = (startTimeStr: string, endTimeStr: string, duration: number): string[] => {
    if (!startTimeStr || !endTimeStr || !duration) return [];
    const slots: string[] = [];
    const start = new Date(`1970-01-01T${startTimeStr}:00`);
    const end = new Date(`1970-01-01T${endTimeStr}:00`);

    let current = start;
    while (current < end) {
        slots.push(current.toTimeString().substring(0, 5));
        current = new Date(current.getTime() + duration * 60000);
    }
    return slots;
  };

  const fetchAvailability = React.useCallback(async (year: number, month: number) => {
      const startDate = startOfMonth(new Date(year, month));
      const endDate = endOfMonth(new Date(year, month));

      const [allAppointments, freshClinics] = await Promise.all([
        getAppointments(),
        getClinics()
      ]);
      setClinics(freshClinics);
      
      const availabilityResult: DailyAvailability[] = [];
      const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });
      const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

      for (const day of daysInMonth) {
        const dateString = day.toISOString().split('T')[0];
        const appointmentsOnDate = allAppointments.filter(
          (app) => app.date.split('T')[0] === dateString
        );

        let totalAvailableSlots = 0;
        const availabilityByClinic: { [key: string]: number } = {};
        const takenTimesByClinic: { [key: string]: string[] } = {};

        for (const clinic of freshClinics) {
            const isWeekend = isSaturday(day) || isSunday(day);
            const dayOfWeekName = dayNames[day.getUTCDay()];
            
            const isDayOfAction = clinic.daysOfAction?.includes(dayOfWeekName);
            const isUnavailableDate = clinic.unavailableDates?.includes(dateString);
            const isWeekendAndNotEnabled = isWeekend && !clinic.weekendBookingEnabled;

            if (isDayOfAction || isUnavailableDate || isWeekendAndNotEnabled) {
                availabilityByClinic[clinic.id] = 0;
                takenTimesByClinic[clinic.id] = [];
                continue;
            }
            
            let slotsForClinic = 0;
            if (clinic.bookingMode === BookingMode.Time && clinic.consultationDuration) {
                slotsForClinic = generateDynamicTimeSlots(clinic.startTime, clinic.endTime, clinic.consultationDuration).length;
            } else {
                slotsForClinic = clinic.dailySlots;
            }
            
            const bookedAppointments = appointmentsOnDate.filter(
                (app) => app.clinicId === clinic.id
            );
            
            const available = Math.max(0, slotsForClinic - bookedAppointments.length);
            availabilityByClinic[clinic.id] = available;
            totalAvailableSlots += available;
            takenTimesByClinic[clinic.id] = bookedAppointments.map(app => app.time);
        }

        availabilityResult.push({
          date: dateString,
          availableSlots: totalAvailableSlots,
          availabilityByClinic,
          takenTimesByClinic,
        });
      }
      setAvailability(availabilityResult);
  }, []);

  React.useEffect(() => {
    async function fetchInitialData() {
        startTransition(async () => {
            const today = new Date();
            try {
                await fetchAvailability(today.getFullYear(), today.getMonth());
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
                toast({
                    title: "Error de Carga",
                    description: "No se pudieron cargar los datos de disponibilidad. Por favor, recarga la página.",
                    variant: "destructive",
                });
            }
        });
    }
    fetchInitialData();
  }, [fetchAvailability, toast]);

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
    startTransition(async () => {
      await fetchAvailability(
        month.getFullYear(),
        month.getMonth()
      );
    });
  };

  const refreshData = () => {
    startTransition(async () => {
      try {
        await fetchAvailability(currentMonth.getFullYear(), currentMonth.getMonth());
        setSelectedDate(undefined);
        setSelectedColoniaId(undefined);
        setSelectedTime(undefined);
        // Do not reset clinic type to allow for multiple bookings
        // setSelectedClinicType(undefined); 
        setPatientType(PatientType.General);
      } catch (error) {
          console.error("Failed to refresh data:", error);
           toast({
              title: "Error al Refrescar",
              description: "No se pudieron actualizar los datos.",
              variant: "destructive",
          });
      }
    });
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      if (date < startOfToday()) {
        toast({
          title: 'Fecha no válida',
          description: 'No puedes seleccionar una fecha en el pasado.',
          variant: 'destructive',
        });
        return;
      }
    }
    setSelectedDate(date);
    setSelectedColoniaId(undefined);
    setSelectedTime(undefined);
    setPatientType(PatientType.General);
  };

  const handleColoniaSelect = (coloniaId: string) => {
      setSelectedColoniaId(coloniaId);
      setSelectedTime(undefined);
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  }

  const selectedColonia = React.useMemo(() => {
    return colonias.find(c => c.id === selectedColoniaId);
  }, [selectedColoniaId, colonias]);

  const selectedClinic = React.useMemo(() => {
    return clinics.find(c => c.id === selectedColonia?.clinicId);
  }, [selectedColonia, clinics]);

  const selectedDayAvailability = React.useMemo(() => {
    if (!selectedDate) return null;
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return availability.find((d) => d.date === dateString) || null;
  }, [selectedDate, availability]);
  
  const coloniaOptions = React.useMemo(() => {
    if (!selectedDayAvailability || !selectedClinicType) return [];
    
    const options = colonias.map(colonia => {
        const clinic = clinics.find(c => c.id === colonia.clinicId);
        
        if (!clinic || clinic.clinicType !== selectedClinicType) {
            return null;
        }

        const slots = selectedDayAvailability.availabilityByClinic[colonia.clinicId] ?? 0;
        const isDisabled = slots === 0;

        return {
            value: colonia.id,
            label: `${colonia.name} (${clinic?.name || 'N/A'}) - ${slots} citas`,
            keywords: `${colonia.name} ${clinic?.name || ''}`,
            disabled: isDisabled,
            clinicName: clinic?.name || 'Z',
            coloniaName: colonia.name,
            content: (
                 <div className="flex justify-between w-full">
                    <span>{colonia.name} (<strong className="text-red-600">{clinic?.name || 'N/A'}</strong>)</span>
                    <span className={`font-bold ml-4 ${isDisabled ? 'text-destructive' : 'text-green-600'}`}>
                        {slots} citas
                    </span>
                </div>
            )
        };
    }).filter(Boolean) as any[];

    options.sort((a, b) => {
        const clinicCompare = a.clinicName.localeCompare(b.clinicName);
        if (clinicCompare !== 0) {
            return clinicCompare;
        }
        return a.coloniaName.localeCompare(b.coloniaName);
    });

    return options;
    
  }, [colonias, clinics, selectedDayAvailability, selectedClinicType]);

  const allTimeSlots = React.useMemo(() => {
    if (!selectedClinic || selectedClinic.bookingMode !== BookingMode.Time || !selectedClinic.consultationDuration) return [];
    return generateDynamicTimeSlots(selectedClinic.startTime, selectedClinic.endTime, selectedClinic.consultationDuration);
  }, [selectedClinic]);


  const availableTimeSlots = React.useMemo(() => {
    if (!selectedDayAvailability || !selectedClinic || selectedClinic.bookingMode !== BookingMode.Time) return [];
    const takenTimes = selectedDayAvailability.takenTimesByClinic[selectedClinic.id] || [];
    return allTimeSlots.filter(slot => !takenTimes.includes(slot));
  }, [selectedDayAvailability, selectedClinic, allTimeSlots]);

  const isTokenBooking = selectedClinic?.bookingMode === BookingMode.Token;
  const isTimeBooking = selectedClinic?.bookingMode === BookingMode.Time;

  const availableTokens = React.useMemo(() => {
    if (!selectedDayAvailability || !selectedClinic || !isTokenBooking) return [];
    
    const totalSlots = selectedClinic.dailySlots;
    const allPossibleTokens = Array.from({ length: totalSlots }, (_, i) => i + 1);

    const takenTimes = selectedDayAvailability.takenTimesByClinic?.[selectedClinic.id] || [];
    
    const takenTokens = takenTimes.map(time => {
        const match = time.match(/Ficha (\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }).filter(Boolean) as number[];

    return allPossibleTokens.filter(token => !takenTokens.includes(token));
  }, [selectedDayAvailability, selectedClinic, isTokenBooking]);


  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="text-primary mb-4">
           <Image
            src={logoBase64}
            alt="Logo CitaMedicaFacil"
            width={80}
            height={80}
            className="rounded-md"
          />
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold font-headline text-foreground">
          Agenda tu Cita Médica
        </h1>
        <p className="text-lg text-muted-foreground mt-2 max-w-2xl mx-auto">
          Un servicio simple y rápido para la comunidad de Huimanguillo.
          Selecciona un día, tu colonia, un horario y registra tus datos.
        </p>
      </div>

      <Card className="w-full max-w-5xl mx-auto shadow-xl border-border/60">
        <CardContent className="p-4 md:p-6 lg:p-8">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="flex flex-col gap-8">
              <div>
                <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                    1. Selecciona un tipo de cita
                </h3>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Stethoscope className="h-5 w-5 text-primary" />
                            Tipo de Consulta
                        </CardTitle>
                        <CardDescription>Selecciona el tipo de consulta que necesitas para ver las colonias disponibles.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Select onValueChange={(value: ClinicType) => setSelectedClinicType(value)} value={selectedClinicType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un tipo de consulta" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ClinicType.ConsultaExterna}>Consulta Externa</SelectItem>
                                <SelectItem value={ClinicType.Especializada}>Consulta Externa Especializada</SelectItem>
                                <SelectItem value={ClinicType.Psicologia}>Psicología</SelectItem>
                                <SelectItem value={ClinicType.Nutricion}>Nutrición</SelectItem>
                                <SelectItem value={ClinicType.Odontologia}>Odontología</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>
              </div>
              
              {selectedClinicType && (
                <>
                    <div>
                        <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                        2. Selecciona un día
                        </h3>
                        <AvailabilityCalendar
                        selectedDate={selectedDate}
                        onDateSelect={handleDateSelect}
                        availability={availability}
                        onMonthChange={handleMonthChange}
                        isLoading={isPending}
                        />
                    </div>

                    {selectedDate && (
                        <div>
                            <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                                3. Indica tu tipo de paciente
                            </h3>
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        <UserCheck className="h-5 w-5 text-primary" />
                                        Tipo de Paciente
                                    </CardTitle>
                                    <CardDescription>Selecciona tu tipo de paciente para nuestros registros.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Select onValueChange={(value: PatientType) => setPatientType(value)} value={patientType}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona un tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value={PatientType.General}>General</SelectItem>
                                        <SelectItem value={PatientType.Cronico}>Paciente Crónico</SelectItem>
                                        <SelectItem value={PatientType.Embarazada}>Embarazada</SelectItem>
                                        <SelectItem value={PatientType.TerceraEdad}>Tercera Edad</SelectItem>
                                        <SelectItem value={PatientType.RecienNacido}>Recién Nacido (sin CURP)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                        
                    {selectedDate && selectedDayAvailability && (
                        <div>
                        <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                            4. Selecciona tu colonia
                        </h3>
                        <Card className="bg-card">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-primary" />
                                    Colonias con citas para el {format(selectedDate, 'PPP', { locale: es })}
                                </CardTitle>
                                <CardDescription>Busca y selecciona tu colonia. Se te asignará el núcleo básico correspondiente.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Combobox
                                    options={coloniaOptions}
                                    value={selectedColoniaId || ''}
                                    onChange={handleColoniaSelect}
                                    placeholder="Busca y selecciona tu colonia..."
                                    searchPlaceholder="Escribe colonia o núcleo..."
                                    noResultsText="No se encontró la colonia para este tipo de cita."
                                />
                            </CardContent>
                        </Card>
                        </div>
                    )}
                    
                    {selectedColoniaId && isTimeBooking && (
                        <>
                            <div>
                                <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                                    5. Selecciona una hora
                                </h3>
                                <Card className="bg-card">
                                    <CardHeader>
                                        <CardTitle className="text-xl flex items-center gap-2">
                                        <Clock className="h-5 w-5 text-primary" />
                                        Horarios para {selectedClinic?.name}
                                        </CardTitle>
                                        <CardDescription>Selecciona un horario disponible.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-3 gap-2">
                                    {availableTimeSlots.length > 0 ? availableTimeSlots.map(time => (
                                        <button key={time}
                                        onClick={() => handleTimeSelect(time)}
                                        className={`w-full p-2 border rounded-md text-center transition-colors ${selectedTime === time ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
                                        >
                                            {time}
                                        </button>
                                    )) : <p className="col-span-3 text-center text-muted-foreground">No hay horarios disponibles en esta colonia para la fecha seleccionada.</p>}
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                    {selectedColoniaId && isTokenBooking && (
                        <div>
                            <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                                5. Selecciona una Ficha
                            </h3>
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        <Ticket className="h-5 w-5 text-primary" />
                                        Fichas Disponibles
                                    </CardTitle>
                                    <CardDescription>
                                        Este núcleo asigna fichas. Hay {availableTokens.length} fichas disponibles. Selecciona una como medida de seguridad.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Select onValueChange={(value) => setSelectedTime(value)} value={selectedTime}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona una ficha..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableTokens.length > 0 ? (
                                                availableTokens.map(token => (
                                                    <SelectItem key={token} value={String(token)}>
                                                        Ficha {token}
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <p className="p-4 text-sm text-muted-foreground">No hay fichas disponibles.</p>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </>
              )}
            </div>

            <div className="flex flex-col gap-8">
              <div>
                <h3 className="text-2xl font-semibold font-headline text-foreground mb-4">
                  6. Completa tus datos
                </h3>
                <BookingForm
                  selectedDate={selectedDate}
                  selectedClinic={selectedClinic}
                  selectedColoniaName={selectedColonia?.name}
                  selectedTime={selectedTime}
                  patientType={patientType}
                  onBookingSuccess={refreshData}
                  announcements={announcements}
                />
              </div>
              {announcements && announcements.length > 0 && (
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl font-headline">
                      <Bell className="h-5 w-5 text-primary" />
                      Avisos Importantes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                      {announcements.map((announcement, index) => (
                        <li key={index}>{announcement}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
