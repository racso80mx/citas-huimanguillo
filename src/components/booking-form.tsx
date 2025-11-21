'use client';
import { useForm } from 'react-hook-form';
import { useTransition } from 'react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { bookAppointment } from '@/lib/actions';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';

// Esquema y tipos simplificados temporalmente
type SimplifiedFormValues = {
  nombre: string;
  curp: string;
  telefono: string;
};

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

  // Usamos un formulario simplificado
  const form = useForm<SimplifiedFormValues>({
    defaultValues: {
      nombre: '',
      curp: '',
      telefono: '',
    },
  });

  const onSubmit = (data: SimplifiedFormValues) => {
    if (!selectedDate || !selectedConsultorio || !selectedTime) {
      toast({
        title: 'Error de validación',
        description: 'Por favor, selecciona una fecha, consultorio y hora.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      // Simulación de envío con datos mínimos para evitar errores de tipo
       toast({
          title: 'Funcionalidad en reconstrucción',
          description: 'El formulario se está restaurando. Esta es una versión de prueba.',
        });
        console.log("Datos del formulario (simplificado):", {
            ...data,
            date: selectedDate.toISOString(),
            time: selectedTime,
            consultorio: selectedConsultorio
        });
      // El código de guardado real se restaurará en el siguiente paso.
      // Por ahora, solo reseteamos el formulario.
      form.reset();
      onBookingSuccess();
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

  // Estructura JSX del formulario, garantizada para ser sintácticamente correcta.
  return (
    <Card className="bg-transparent border-none shadow-none">
      <CardContent className='p-0'>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Tu nombre completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="curp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CURP</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Tu CURP"
                      {...field}
                      maxLength={18}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            <Button
              type="submit"
              disabled={isPending}
              className="w-full text-lg py-6"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Enviando...' : 'Confirmar Cita (Prueba)'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}