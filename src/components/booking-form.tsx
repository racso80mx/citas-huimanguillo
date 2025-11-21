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
import municipios from '@/lib/data/municipios.json';
import colonias from '@/lib/data/colonias.json';
import { Combobox } from './ui/combobox';
import { generateAppointmentPDF } from '@/lib/utils';
import type { Appointment } from '@/lib/definitions';

const curpRegex = /^[A-Z]{4}(\d{2})(\d{2})(\d{2})([HM])([A-Z]{2})[A-Z]{3}[A-Z0-9]\d$/;

const formSchema = z.object({
  curp: z.string().regex(curpRegex, 'El formato de la CURP no es válido.'),
  nombre: z.string().min(2, 'El nombre es requerido.'),
  apellidoPaterno: z.string().min(2, 'El apellido paterno es requerido.'),
  apellidoMaterno: z.string().min(2, 'El apellido materno es requerido.'),
  telefono: z.string().length(10, 'El teléfono debe tener 10 dígitos.'),
  sexo: z.enum(['Hombre', 'Mujer']),
  edad: z.number().min(0, 'La edad no puede ser negativa.'),
  estadoNacimiento: z.string().min(1, 'El estado es requerido.'),
  municipio: z.string().optional(),
  colonia: z.string().optional(),
  otraColonia: z.string().optional(),
}).refine(data => {
    if (data.estadoNacimiento === 'TABASCO') {
        return !!data.municipio;
    }
    return true;
}, {
    message: "El municipio es requerido para residentes de Tabasco.",
    path: ['municipio'],
}).refine(data => {
    if (data.estadoNacimiento === 'TABASCO' && data.municipio === 'Huimanguillo') {
        return !!data.colonia;
    }
    return true;
}, {
    message: "La colonia es requerida para residentes de Huimanguillo.",
    path: ['colonia'],
}).refine(data => {
    if (data.colonia === 'Otra') {
        return !!data.otraColonia && data.otraColonia.length > 2;
    }
    return true;
}, {
    message: "Por favor, especifica la colonia.",
    path: ['otraColonia'],
});

type BookingFormValues = z.infer<typeof formSchema>;

type BookingFormProps = {
  selectedDate: Date | undefined;
  selectedConsultorio: number | undefined;
  selectedTime: string | undefined;
  onBookingSuccess: () => void;
};

export function BookingForm({
  selectedDate,
  selectedConsultorio,
  selectedTime,
  onBookingSuccess,
}: BookingFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      curp: '',
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      telefono: '',
    },
  });

  const curp = form.watch('curp');
  const estadoNacimiento = form.watch('estadoNacimiento');
  const municipio = form.watch('municipio');
  const colonia = form.watch('colonia');

  useEffect(() => {
    if (curp.length === 18 && curpRegex.test(curp.toUpperCase())) {
      const data = parseCURP(curp.toUpperCase());
      if (data) {
        form.setValue('sexo', data.sex as 'Hombre' | 'Mujer');
        form.setValue('estadoNacimiento', data.estadoNacimiento || 'NACIDO EN EL EXTRANJERO');
        form.setValue('edad', calculateAge(data.birthDate));
      }
    }
  }, [curp, form]);

  const onSubmit = (data: BookingFormValues) => {
    if (!selectedDate || !selectedConsultorio || !selectedTime) {
      toast({
        title: 'Error de validación',
        description: 'Por favor, selecciona una fecha, consultorio y hora.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await bookAppointment({
          ...data,
          date: selectedDate.toISOString(),
          time: selectedTime,
          consultorio: selectedConsultorio,
      });

      if (result.success && result.appointmentId) {
        toast({
          title: 'Cita Confirmada',
          description: `Tu cita ha sido agendada con éxito. Folio: ${result.appointmentNumber}`,
          duration: 10000,
        });

        // Generate and download PDF
        const completeAppointmentData = {
          ...data,
          id: result.appointmentId,
          date: selectedDate.toISOString(),
          time: selectedTime,
          consultorio: selectedConsultorio,
          appointmentNumber: result.appointmentNumber,
        } as Appointment;
        generateAppointmentPDF(completeAppointmentData);

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
                  name="nombre"
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
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <FormField
                  control={form.control}
                  name="sexo"
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
                  name="edad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Edad</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Derivado de CURP" {...field} disabled value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            
            <FormField
              control={form.control}
              name="estadoNacimiento"
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
            {estadoNacimiento === 'TABASCO' && (
               <FormField
                  control={form.control}
                  name="municipio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Municipio</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                         <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona tu municipio" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {municipios.map(m => (
                              <SelectItem key={m.clave} value={m.nombre}>{m.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}

            {estadoNacimiento === 'TABASCO' && municipio === 'Huimanguillo' && (
                <FormField
                  control={form.control}
                  name="colonia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Colonia</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                         <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona tu colonia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           {colonias.map(c => (
                              <SelectItem key={c.nombre} value={c.nombre}>{c.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}
            {colonia === 'Otra' && (
                 <FormField
                  control={form.control}
                  name="otraColonia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Especifica tu colonia</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre de tu colonia" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}
            <FormField
              control={form.control}
              name="telefono"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número Telefónico</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="Tu número a 10 dígitos" {...field} maxLength={10} />
                  </FormControl>
                   <FormDescription>
                    Usaremos este número para contactarte si hay cambios en tu cita.
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
