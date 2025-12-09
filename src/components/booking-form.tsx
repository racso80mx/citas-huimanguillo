'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useTransition } from 'react';
import {
  Form,
  FormControl,
  FormDescription,
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
import { bookAppointment } from '@/lib/actions';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { parseCURP, calculateAge } from '@/lib/curp';
import estados from '@/lib/data/estados.json';
import { Combobox } from './ui/combobox';
import { generateAppointmentPDF } from '@/lib/utils';
import type { Appointment, Clinic, Patient } from '@/lib/definitions';
import { PatientType } from '@/lib/definitions';

const curpRegex = /^[A-Z]{4}(\d{2})(\d{2})(\d{2})([HM])([A-Z]{2})[A-Z]{3}[A-Z0-9]\d$/;

const formSchema = z.object({
  curp: z.string().regex(curpRegex, 'El formato de la CURP no es válido.'),
  name: z.string().min(2, 'El nombre es requerido.'),
  paternalLastName: z.string().min(2, 'El apellido paterno es requerido.'),
  maternalLastName: z.string().min(2, 'El apellido materno es requerido.'),
  sex: z.enum(['Hombre', 'Mujer']),
  age: z.number().min(0, 'La edad no puede ser negativa.'),
  birthState: z.string().min(1, 'El estado es requerido.'),
  patientType: z.nativeEnum(PatientType),
});

type BookingFormValues = z.infer<typeof formSchema>;

type BookingFormProps = {
  selectedDate: Date | undefined;
  selectedClinic: Clinic | undefined;
  selectedColoniaName: string | undefined;
  selectedTime: string | undefined;
  allTimeSlots: string[];
  onBookingSuccess: () => void;
};

export function BookingForm({
  selectedDate,
  selectedClinic,
  selectedColoniaName,
  selectedTime,
  allTimeSlots,
  onBookingSuccess,
}: BookingFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      curp: '',
      name: '',
      paternalLastName: '',
      maternalLastName: '',
      sex: undefined,
      age: undefined,
      birthState: '',
      patientType: PatientType.General,
    },
  });

  const curp = form.watch('curp');
  const patientType = form.watch('patientType');

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

  useEffect(() => {
    const priorityPatients = [PatientType.Cronico, PatientType.Embarazada, PatientType.TerceraEdad];
    if (priorityPatients.includes(patientType) && selectedTime) {
        const slotIndex = allTimeSlots.indexOf(selectedTime);
        if (slotIndex >= 5) {
            toast({
                title: "Horario no prioritario",
                description: "Los pacientes prioritarios deben seleccionar uno de los primeros 5 horarios.",
                variant: "destructive"
            });
        }
    }
    if (patientType === PatientType.General && selectedTime) {
        const slotIndex = allTimeSlots.indexOf(selectedTime);
        if (slotIndex < 5) {
            toast({
                title: "Horario prioritario",
                description: "Este horario es para pacientes prioritarios. Por favor, selecciona a partir del sexto horario.",
                variant: "destructive"
            });
        }
    }

  }, [patientType, selectedTime, allTimeSlots, toast])

  const onSubmit = (data: BookingFormValues) => {
    if (!selectedDate || !selectedClinic || !selectedTime || !selectedColoniaName) {
      toast({
        title: 'Error de validación',
        description: 'Por favor, selecciona una fecha, colonia y hora.',
        variant: 'destructive',
      });
      return;
    }

    const priorityPatients = [PatientType.Cronico, PatientType.Embarazada, PatientType.TerceraEdad];
    const slotIndex = allTimeSlots.indexOf(selectedTime);

    if (priorityPatients.includes(data.patientType) && slotIndex >= 5) {
        toast({ title: "Horario no prioritario", description: "Los pacientes prioritarios deben seleccionar uno de los primeros 5 horarios.", variant: "destructive"});
        return;
    }

    if (data.patientType === PatientType.General && slotIndex < 5) {
        toast({ title: "Horario prioritario", description: "Este horario es para pacientes prioritarios. Por favor, selecciona a partir del sexto horario.", variant: "destructive"});
        return;
    }

    startTransition(async () => {
      const patientData: Omit<Patient, 'id'> = {
        curp: data.curp,
        name: data.name,
        paternalLastName: data.paternalLastName,
        maternalLastName: data.maternalLastName,
        sex: data.sex,
        age: data.age,
        birthState: data.birthState,
      };

      const result = await bookAppointment({
          patient: patientData,
          date: selectedDate.toISOString(),
          time: selectedTime,
          clinicId: selectedClinic.id,
          patientType: data.patientType,
      });

      if (result.success && result.appointment) {
        toast({
          title: 'Cita Confirmada',
          description: `Tu cita ha sido agendada con éxito. Folio: ${result.appointment.appointmentNumber}`,
          duration: 10000,
        });

        generateAppointmentPDF(result.appointment, selectedClinic);

        form.reset();
        onBookingSuccess();
      } else {
        toast({
          title: 'Error al Agendar',
          description: result.message || 'No se pudo agendar la cita. Intenta de nuevo.',
          variant: 'destructive',
        });
      }
    });
  };
  
  if (!selectedDate || !selectedClinic || !selectedTime) {
    return (
        <Card className='border-dashed'>
            <CardContent className='p-6 text-center'>
                <p className='text-muted-foreground'>Por favor, selecciona primero una fecha, colonia y hora disponibles.</p>
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
                      <FormLabel>Edad</FormLabel>
                      <FormControl>
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

            <FormField
              control={form.control}
              name="patientType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Paciente</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                     <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={PatientType.General}>General</SelectItem>
                      <SelectItem value={PatientType.Cronico}>Paciente Crónico</SelectItem>
                      <SelectItem value={PatientType.Embarazada}>Embarazada</SelectItem>
                      <SelectItem value={PatientType.TerceraEdad}>Tercera Edad</SelectItem>
                    </SelectContent>
                  </Select>
                   <FormDescription>
                    Pacientes prioritarios (crónico, embarazada, 3ra edad) deben elegir los primeros 5 horarios.
                  </FormDescription>
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
