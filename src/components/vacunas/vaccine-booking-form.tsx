
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
import { saveNewVaccineAppointment, getPatientByCURP } from '@/lib/actions';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { parseCURP, calculateAge } from '@/lib/curp';
import estados from '@/lib/data/estados.json';
import { Combobox } from '../ui/combobox';
import type { VaccineAppointment, Patient, Vaccine } from '@/lib/definitions';
import { PatientType } from '@/lib/definitions';
import { v4 as uuidv4 } from 'uuid';
import { generateVaccineAppointmentPDF } from '@/lib/utils';

const curpRegex = /^[A-Z]{4}(\d{2})(\d{2})(\d{2})([HM])([A-Z]{2})[A-Z]{3}[A-Z0-9]\d$/;
const phoneRegex = /^\d{10}$/;

const baseSchema = z.object({
  name: z.string().min(2, 'El nombre es requerido.'),
  paternalLastName: z.string().min(2, 'El apellido paterno es requerido.'),
  maternalLastName: z.string().min(2, 'El apellido materno es requerido.'),
  phoneNumber: z.string().regex(phoneRegex, 'El número de teléfono del tutor debe tener 10 dígitos.'),
  sex: z.enum(['Hombre', 'Mujer']),
  age: z.number().min(0, 'La edad no puede ser negativa.'),
});

const formSchemaWithCurp = baseSchema.extend({
    curp: z.string().regex(curpRegex, 'El formato de la CURP no es válido.'),
    birthState: z.string().min(1, 'El estado es requerido.'),
});

const formSchemaNewborn = baseSchema.extend({
  curp: z.string().optional(),
  birthState: z.string().optional(),
});


type BookingFormValues = z.infer<typeof formSchemaWithCurp>;

type VaccineBookingFormProps = {
  selectedDate: Date | undefined;
  selectedTime: string | undefined;
  selectedVaccines: Vaccine[];
  patientType: PatientType;
  clinicId?: string;
  coloniaName?: string;
  onBookingSuccess: () => void;
};

export function VaccineBookingForm({
  selectedDate,
  selectedTime,
  selectedVaccines,
  patientType,
  clinicId,
  coloniaName,
  onBookingSuccess,
}: VaccineBookingFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const isNewborn = patientType === PatientType.RecienNacido;

  const currentSchema = isNewborn ? formSchemaNewborn : formSchemaWithCurp;

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(currentSchema),
    defaultValues: {
      curp: '',
      name: '',
      paternalLastName: '',
      maternalLastName: '',
      phoneNumber: '',
      sex: undefined,
      age: 0,
      birthState: '',
    },
  });

  useEffect(() => {
      form.reset();
  }, [isNewborn, form]);

  const curp = form.watch('curp');

  const handleCurpBlur = async () => {
    if (isNewborn || !curp) return;
    const curpUpper = curp.toUpperCase();
    if (curpRegex.test(curpUpper)) {
      startTransition(async () => {
        const result = await getPatientByCURP(curpUpper);
        if (result.success && result.data) {
          form.setValue('name', result.data.name, { shouldValidate: true });
          form.setValue('paternalLastName', result.data.paternalLastName, { shouldValidate: true });
          form.setValue('maternalLastName', result.data.maternalLastName, { shouldValidate: true });
          form.setValue('phoneNumber', result.data.phoneNumber, { shouldValidate: true });
           toast({
                title: 'Paciente Encontrado',
                description: 'Se han precargado tus datos.',
            });
        }
      });
    }
  };

  useEffect(() => {
    if (!isNewborn && curp && curp.length === 18 && curpRegex.test(curp.toUpperCase())) {
      const data = parseCURP(curp.toUpperCase());
      if (data) {
        form.setValue('sex', data.sex as 'Hombre' | 'Mujer');
        form.setValue('birthState', data.estadoNacimiento || 'NACIDO EN EL EXTRANJERO');
        form.setValue('age', calculateAge(data.birthDate));
      }
    }
  }, [curp, form, isNewborn]);


  const onSubmit = (data: BookingFormValues) => {
    if (!selectedDate || !selectedTime || selectedVaccines.length === 0) {
      toast({
        title: 'Error de validación',
        description: 'Por favor, selecciona fecha, vacuna(s) y hora.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!isNewborn && !clinicId) {
        toast({ title: "Error", description: "Selecciona una colonia.", variant: "destructive" });
        return;
    }

    startTransition(async () => {
      const patientData: Omit<Patient, 'id'> = {
          curp: (data.curp || `RN-${uuidv4()}`).toUpperCase(),
          name: data.name.toUpperCase(),
          paternalLastName: data.paternalLastName.toUpperCase(),
          maternalLastName: data.maternalLastName.toUpperCase(),
          sex: data.sex,
          age: data.age,
          birthState: data.birthState || "No especificado",
          phoneNumber: data.phoneNumber
      };

      const appointmentNumber = `VAC-${uuidv4().split('-')[0].toUpperCase()}`;

      const newAppointment: Omit<VaccineAppointment, 'id' | 'patientId' | 'patient'> = {
        appointmentNumber,
        date: selectedDate.toISOString(),
        time: selectedTime,
        isNewborn: isNewborn,
        clinicId: clinicId,
        coloniaName: coloniaName,
        vaccines: selectedVaccines,
        status: 'Agendada',
        patientType: patientType,
      };

      const result = await saveNewVaccineAppointment(newAppointment, patientData);
      
      if (result.success && result.data) {
        generateVaccineAppointmentPDF(result.data);
        toast({
            title: 'Cita Confirmada',
            description: `Tu cita de Vacunación ha sido agendada. Folio: ${result.data.appointmentNumber}`,
            duration: 10000,
        });

        form.reset();
        onBookingSuccess();
      } else {
         toast({
          title: 'Error al Agendar',
          description: result.error || 'No se pudo agendar la cita. Inténtalo de nuevo.',
          variant: 'destructive',
        });
      }
    });
  };
  
  if (!selectedDate || !selectedTime || selectedVaccines.length === 0 || (!isNewborn && !clinicId)) {
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
             {!isNewborn && (
                <FormField
                control={form.control}
                name="curp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CURP</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="CURP de 18 caracteres del paciente"
                        {...field}
                        value={field.value ?? ''}
                        onBlur={handleCurpBlur}
                        maxLength={18}
                        className="uppercase"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
             )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre(s) del paciente</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre(s)" {...field} className="uppercase" />
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
                        <Input placeholder="Apellido paterno" {...field} className="uppercase" />
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
                    <Input placeholder="Apellido materno" {...field} className="uppercase" />
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
                      <FormLabel>Teléfono del Padre/Tutor</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Teléfono de 10 dígitos" {...field} maxLength={10} />
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
                       <Select onValueChange={field.onChange} value={field.value} disabled={!isNewborn && !!curp}>
                         <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={!isNewborn && !!curp ? "Derivado de CURP" : "Selecciona..."} />
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
                      <FormLabel>Edad (años)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder={!isNewborn && !!curp ? "Derivado de CURP" : "Años cumplidos"} {...field} disabled={!isNewborn && !!curp} value={field.value ?? ''} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            
            {!isNewborn && (
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
                      disabled={!isNewborn && !!curp}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
