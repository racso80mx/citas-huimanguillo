'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTransition, useEffect } from 'react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { bookAppointment } from '@/lib/actions';
import { parseCURP, calculateAge } from '@/lib/curp';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import estados from '@/lib/data/estados.json';
import municipios from '@/lib/data/municipios.json';
import colonias from '@/lib/data/colonias.json';
import { generateAppointmentPDF } from '@/lib/utils';
import type { Appointment } from '@/lib/definitions';

const formSchema = z.object({
  curp: z
    .string()
    .min(18, { message: 'La CURP debe tener 18 caracteres.' })
    .max(18, { message: 'La CURP debe tener 18 caracteres.' })
    .regex(/^[A-Z]{4}\d{6}[HM][A-Z]{2}[A-Z]{3}[A-Z0-9]\d$/, {
      message: 'Formato de CURP no válido.',
    }),
  nombre: z.string().min(2, { message: 'El nombre es requerido.' }).regex(/^[a-zA-Z\sñÑáéíóúÁÉÍÓÚ]+$/, "El nombre solo debe contener letras, ñ y acentos."),
  apellidoPaterno: z
    .string()
    .min(2, { message: 'El apellido paterno es requerido.' }).regex(/^[a-zA-Z\sñÑáéíóúÁÉÍÓÚ]+$/, "El apellido solo debe contener letras, ñ y acentos."),
  apellidoMaterno: z
    .string()
    .min(2, { message: 'El apellido materno es requerido.' }).regex(/^[a-zA-Z\sñÑáéíóúÁÉÍÓÚ]+$/, "El apellido solo debe contener letras, ñ y acentos."),
  sexo: z.enum(['Hombre', 'Mujer'], { required_error: 'El sexo es requerido.' }),
  edad: z.coerce
    .number()
    .min(0, { message: 'La edad no puede ser negativa.' })
    .max(120, { message: 'La edad no es válida' }),
  estadoNacimiento: z.string().min(1, { message: 'El estado es requerido.' }),
  municipio: z.string().min(1, { message: 'El municipio es requerido.' }).regex(/^[a-zA-Z0-9\sñÑáéíóúÁÉÍÓÚ]+$/, "El municipio solo debe contener letras, números, ñ y acentos."),
  colonia: z.string().min(1, { message: 'La colonia es requerida.' }).regex(/^[a-zA-Z0-9\sñÑáéíóúÁÉÍÓÚ]+$/, "La colonia solo debe contener letras, números, ñ y acentos."),
  otraColonia: z.string().optional().refine((val) => !val || /^[a-zA-Z0-9\sñÑáéíóúÁÉÍÓÚ]+$/.test(val), {
    message: "La nueva colonia solo debe contener letras, números, ñ y acentos.",
  }),
  telefono: z.string().regex(/^\d{10}$/, { message: 'El número de teléfono debe tener 10 dígitos.' }),
}).refine(data => {
    // If state is Tabasco and municipio is Huimanguillo, colonia dropdown is required.
    if (data.estadoNacimiento === 'TABASCO' && data.municipio === 'Huimanguillo' && !data.colonia) {
        return false;
    }
    return true;
}, {
    message: 'La colonia es requerida para Huimanguillo.',
    path: ['colonia'],
}).refine(data => {
    // If 'Otra' is selected in colonia dropdown, 'otraColonia' input is required.
    if (data.estadoNacimiento === 'TABASCO' && data.municipio === 'Huimanguillo' && data.colonia === 'Otra') {
        return !!data.otraColonia && data.otraColonia.length > 2;
    }
    return true;
}, {
    message: 'El nombre de la nueva colonia es requerido.',
    path: ['otraColonia'],
});


type BookingFormProps = {
  selectedDate: Date | undefined;
  selectedConsultorio: number | undefined;
  selectedTime: string | undefined;
  onBookingSuccess: () => void;
};

const coloniaOptions = colonias.map(c => ({label: c.nombre, value: c.nombre}));

export function BookingForm({
  selectedDate,
  selectedConsultorio,
  selectedTime,
  onBookingSuccess,
}: BookingFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      curp: '',
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      sexo: undefined,
      edad: 0,
      estadoNacimiento: '',
      municipio: '',
      colonia: '',
      otraColonia: '',
      telefono: '',
    },
  });
  
  const watchEstado = form.watch('estadoNacimiento');
  const watchMunicipio = form.watch('municipio');
  const watchColonia = form.watch('colonia');

  useEffect(() => {
    form.reset({
      curp: '',
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      sexo: undefined,
      edad: 0,
      estadoNacimiento: '',
      municipio: '',
      colonia: '',
      otraColonia: '',
      telefono: '',
    });
  }, [selectedDate, selectedConsultorio, selectedTime, form]);

  const handleCurpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const curp = e.target.value.toUpperCase();
    form.setValue('curp', curp, { shouldValidate: curp.length === 18 });
    const parsed = parseCURP(curp);
    if (parsed) {
      form.setValue('sexo', parsed.sex, { shouldValidate: true });
      form.setValue('edad', calculateAge(parsed.birthDate), {
        shouldValidate: true,
      });
      if(parsed.estadoNacimiento) {
        form.setValue('estadoNacimiento', parsed.estadoNacimiento, { shouldValidate: true });
      }
      form.clearErrors(['sexo', 'edad', 'estadoNacimiento']);
    }
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    if (!selectedDate || !selectedConsultorio || !selectedTime) {
      toast({
        title: 'Error de validación',
        description: 'Por favor, selecciona una fecha, consultorio y hora.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const finalData = { ...data };
      if (finalData.colonia === 'Otra') {
          finalData.colonia = finalData.otraColonia || 'No especificada';
      }

      const result = await bookAppointment({
        ...finalData,
        date: selectedDate.toISOString(),
        time: selectedTime,
        consultorio: selectedConsultorio,
      });

      if (result.success && result.appointmentId) {
        toast({
          title: '¡Cita Reservada!',
          description: 'Tu cita ha sido agendada con éxito. Se está generando tu recibo.',
          className: 'bg-accent text-accent-foreground',
        });
        
        const appointmentDetails = await (await fetch(`/api/getAppointment?id=${result.appointmentId}`)).json();

        if (appointmentDetails) {
            generateAppointmentPDF(appointmentDetails);
        }

        form.reset();
        onBookingSuccess();
      } else {
        toast({
          title: 'Error al reservar',
          description: result.message,
          variant: 'destructive',
        });
        if (result.message?.includes('horario')) {
          onBookingSuccess();
        }
      }
    });
  };
  
  if (!selectedDate || !selectedConsultorio || !selectedTime) {
    return (
        <Card className='border-dashed'>
            <CardContent className='p-6 text-center'>
                <p className='text-muted-foreground'>Por favor, selecciona primero una fecha, consultorio y hora disponibles.</p>
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
                      placeholder="Tu Clave Única de Registro de Población"
                      {...field}
                      onChange={handleCurpChange}
                      maxLength={18}
                      className="uppercase"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre(s)</FormLabel>
                    <FormControl>
                      <Input placeholder="Tu nombre" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="apellidoPaterno"
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
                name="apellidoMaterno"
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
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sexo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexo</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!!parseCURP(form.getValues('curp'))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tu sexo" />
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
                name="edad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Edad</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Tu edad"
                        {...field}
                        value={field.value || ''}
                        disabled={!!parseCURP(form.getValues('curp'))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <FormField
              control={form.control}
              name="telefono"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número Telefónico</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="Tu número a 10 dígitos" {...field} maxLength={10} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid sm:grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="estadoNacimiento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado de Residencia</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tu estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {estados.map(e => <SelectItem key={e.clave} value={e.nombre}>{e.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchEstado === 'TABASCO' ? (
                <FormField
                  control={form.control}
                  name="municipio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Municipio</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona tu municipio" />
                          </Trigger>
                        </FormControl>
                        <SelectContent>
                          {municipios.map(m => <SelectItem key={m.clave} value={m.nombre}>{m.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : watchEstado ? (
                 <FormField
                  control={form.control}
                  name="municipio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Municipio</FormLabel>
                       <FormControl>
                        <Input placeholder="Escribe tu municipio" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>
             {watchEstado === 'TABASCO' && watchMunicipio === 'Huimanguillo' ? (
                <FormField
                  control={form.control}
                  name="colonia"
                  render={({ field }) => (
                     <FormItem className="flex flex-col">
                      <FormLabel>Colonia</FormLabel>
                       <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona tu colonia" />
                          </Trigger>
                        </FormControl>
                        <SelectContent>
                          {coloniaOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
             ) : watchEstado ? (
                <FormField
                  control={form.control}
                  name="colonia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Colonia</FormLabel>
                       <FormControl>
                        <Input placeholder="Escribe tu colonia" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
             ) : null}

             {watchEstado === 'TABASCO' && watchMunicipio === 'Huimanguillo' && watchColonia === 'Otra' && (
                 <FormField
                  control={form.control}
                  name="otraColonia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la nueva colonia</FormLabel>
                      <FormControl>
                        <Input placeholder="Escribe el nombre de la colonia" {...field} />
                      </FormControl>
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
              {isPending ? 'Reservando...' : 'Confirmar Cita'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
