'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTransition, useState } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const formSchema = z.object({
  curp: z
    .string()
    .min(18, { message: 'La CURP debe tener 18 caracteres.' })
    .max(18, { message: 'La CURP debe tener 18 caracteres.' })
    .regex(/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/, {
      message: 'Formato de CURP no válido.',
    }),
  nombre: z.string().min(2, { message: 'El nombre es requerido.' }),
  apellidoPaterno: z
    .string()
    .min(2, { message: 'El apellido paterno es requerido.' }),
  apellidoMaterno: z
    .string()
    .min(2, { message: 'El apellido materno es requerido.' }),
  sexo: z.enum(['Hombre', 'Mujer'], { required_error: 'El sexo es requerido.' }),
  edad: z.coerce
    .number()
    .min(1, { message: 'La edad debe ser mayor a 0.' })
    .max(120, { message: 'La edad no es válida' }),
});

type BookingFormProps = {
  selectedDate: Date | undefined;
  onBookingSuccess: () => void;
};

export function BookingForm({
  selectedDate,
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
    },
  });

  const handleCurpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const curp = e.target.value.toUpperCase();
    form.setValue('curp', curp, { shouldValidate: curp.length === 18 });
    const parsed = parseCURP(curp);
    if (parsed) {
      form.setValue('sexo', parsed.sex, { shouldValidate: true });
      form.setValue('edad', calculateAge(parsed.birthDate), {
        shouldValidate: true,
      });
      form.clearErrors(['sexo', 'edad']);
    }
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    if (!selectedDate) {
      toast({
        title: 'Error de validación',
        description: 'Por favor, selecciona una fecha en el calendario.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await bookAppointment({
        ...data,
        date: selectedDate.toISOString(),
      });

      if (result.success) {
        toast({
          title: '¡Cita Reservada!',
          description: 'Tu cita ha sido agendada con éxito.',
          className: 'bg-accent text-accent-foreground',
        });
        form.reset();
        onBookingSuccess();
      } else {
        toast({
          title: 'Error al reservar',
          description: result.message,
          variant: 'destructive',
        });
      }
    });
  };

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
                      defaultValue={field.value}
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
                        disabled={!!parseCURP(form.getValues('curp'))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button
              type="submit"
              disabled={isPending || !selectedDate}
              className="w-full text-lg py-6"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Reservando...' : 'Confirmar Cita'}
            </Button>
            {!selectedDate && (
                <p className='text-sm text-center text-destructive'>Por favor, primero selecciona un día en el calendario.</p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
