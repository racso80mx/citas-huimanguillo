'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useTransition } from 'react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  getXRayAppointmentsByDate,
  saveXRayAppointment,
} from '@/lib/data-client';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { parseCURP, calculateAge } from '@/lib/curp';
import estados from '@/lib/data/estados.json';
import { Combobox } from '../ui/combobox';
import { generateXRayAppointmentPDF } from '@/lib/utils';
import type { XRayAppointment, Patient, XRayStudy } from '@/lib/definitions';
import { v4 as uuidv4 } from 'uuid';

const curpRegex = /^[A-Z]{4}(\d{2})(\d{2})(\d{2})([HM])([A-Z]{2})[A-Z]{3}[A-Z0-9]\d$/;
const phoneRegex = /^\d{10}$/;


const formSchema = z.object({
  curp: z.string().regex(curpRegex, 'El formato de la CURP no es válido.'),
  name: z.string().min(2, 'El nombre es requerido.'),
  paternalLastName: z.string().min(2, 'El apellido paterno es requerido.'),
  maternalLastName: z.string().min(2, 'El apellido materno es requerido.'),
  phoneNumber: z.string().regex(phoneRegex, 'El número de teléfono debe tener 10 dígitos.'),
  sex: z.enum(['Hombre', 'Mujer']),
  age: z.number().min(0, 'La edad no puede ser negativa.'),
  birthState: z.string().min(1, 'El estado es requerido.'),
});

type BookingFormValues = z.infer<typeof formSchema>;

type XRayBookingFormProps = {
  selectedDate: Date | undefined;
  selectedTime: string | undefined;
  selectedStudy: XRayStudy | undefined;
  onBookingSuccess: () => void;
};

export function XRayBookingForm({
  selectedDate,
  selectedTime,
  selectedStudy,
  onBookingSuccess,
}: XRayBookingFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      curp: '',
      name: '',
      paternalLastName: '',
      maternalLastName: '',
      phoneNumber: '',
      sex: undefined,
      age: undefined,
      birthState: '',
    },
  });

  const curp = form.watch('curp');

  useEffect(() => {
    if (curp.length === 18 && curpRegex.test(curp.toUpperCase())) {
      const data = parseCURP(curp.toUpperCase());
      if (data) {
        form.setValue('sex', data.sex as 'Hombre' | 'Mujer');
        form.setValue('birthState', data.estadoNacimiento || 'NACIDO EN EL EXTRANJERO');
        form.setValue('age', calculateAge(data.birthDate));
      }
    }
  }, [curp, form]);


  const bookAppointment = async (
    bookingData: BookingFormValues,
  ) => {
    if (!selectedDate || !selectedTime || !selectedStudy) throw new Error("Datos de la cita incompletos.");

    const appointmentsOnDate = await getXRayAppointmentsByDate(selectedDate);
    
    const isTimeSlotTaken = appointmentsOnDate.some(
      (app) => app.time === selectedTime
    );

    if (isTimeSlotTaken) {
      throw new Error(`El horario de ${selectedTime} ya no está disponible. Por favor, selecciona otro.`);
    }
    
    const curpExistsOnDate = appointmentsOnDate.some(
      (app) => app.patient.curp.toUpperCase() === bookingData.curp.toUpperCase()
    );

    if (curpExistsOnDate) {
      throw new Error('Ya existe una cita de Rayos X agendada con esta CURP para el día seleccionado.');
    }
    
    const patientData: Omit<Patient, 'id'> = {
        curp: bookingData.curp.toUpperCase(),
        name: bookingData.name,
        paternalLastName: bookingData.paternalLastName,
        maternalLastName: bookingData.maternalLastName,
        sex: bookingData.sex,
        age: bookingData.age,
        birthState: bookingData.birthState,
        phoneNumber: bookingData.phoneNumber
    };

    const appointmentNumber = `RX-${uuidv4().split('-')[0].toUpperCase()}`;

    const newAppointment: Omit<XRayAppointment, 'id'> = {
      appointmentNumber,
      patient: patientData,
      date: selectedDate.toISOString(),
      time: selectedTime,
      studyId: selectedStudy.id,
      studyName: selectedStudy.name,
    };

    return await saveXRayAppointment(newAppointment);
  }


  const onSubmit = (data: BookingFormValues) => {
    if (!selectedDate || !selectedTime || !selectedStudy) {
      toast({
        title: 'Error de validación',
        description: 'Por favor, selecciona fecha, estudio y hora.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      try {
        const appointment = await bookAppointment(data);
        if (appointment) {
          toast({
            title: 'Cita Confirmada',
            description: `Tu cita de Rayos X ha sido agendada. Folio: ${appointment.appointmentNumber}`,
            duration: 10000,
          });

          generateXRayAppointmentPDF(appointment, selectedStudy);

          form.reset();
          onBookingSuccess();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'No se pudo agendar la cita. Intenta de nuevo.';
        toast({
          title: 'Error al Agendar',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    });
  };
  
  if (!selectedDate || !selectedTime || !selectedStudy) {
    return (
        <Card className='border-dashed'>
            <CardContent className='p-6 text-center'>
                <p className='text-muted-foreground'>Por favor, completa todos los pasos anteriores.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="bg-transparent border-none shadow-none">
      <CardContent className='p-0'>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField
              control={form.control}
              name="curp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CURP</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Tu CURP de 18 caracteres"
                      {...field}
                      maxLength={18}
                      className="uppercase"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre(s)</FormLabel>
                      <FormControl>
                        <Input placeholder="Tu(s) nombre(s)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="paternalLastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido Paterno</FormLabel>
                      <FormControl>
                        <Input placeholder="Tu apellido paterno" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
             <FormField
              control={form.control}
              name="maternalLastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apellido Materno</FormLabel>
                  <FormControl>
                    <Input placeholder="Tu apellido materno" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número Telefónico</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Tu teléfono de 10 dígitos" {...field} maxLength={10} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <FormField
                  control={form.control}
                  name="sex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sexo</FormLabel>
                       <Select onValueChange={field.onChange} value={field.value} disabled>
                         <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Derivado de CURP" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Hombre">Hombre</SelectItem>
                          <SelectItem value="Mujer">Mujer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Edad</FormLabel>                      <FormControl>
                        <Input type="number" placeholder="Derivado de CURP" {...field} disabled value={field.value || ''} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            
            <FormField
              control={form.control}
              name="birthState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado de Nacimiento</FormLabel>
                  <Combobox 
                    options={estados.map(e => ({ value: e.nombre, label: e.nombre }))}
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder='Selecciona un estado'
                    searchPlaceholder='Buscar estado...'
                    noResultsText='No se encontró el estado.'
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isPending}
              className="w-full text-lg py-6"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Confirmando Cita...' : 'Confirmar y Descargar Cita'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
