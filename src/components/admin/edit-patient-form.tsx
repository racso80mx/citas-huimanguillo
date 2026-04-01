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
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Patient } from '@/lib/definitions';
import { PatientStatus } from '@/lib/definitions';
import { updatePatient } from '@/lib/actions';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { parseCURP, calculateAge } from '@/lib/curp';
import { format as formatDate } from 'date-fns';

const formSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  paternalLastName: z.string().min(1, 'Apellido paterno es requerido'),
  maternalLastName: z.string().min(1, 'Apellido materno es requerido'),
  curp: z.string().min(1, 'CURP es requerida'),
  phoneNumber: z.string().max(10, 'Máximo 10 dígitos').nullable().optional(),
  expediente: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  sex: z.enum(['Hombre', 'Mujer']),
  age: z.coerce.number().min(0, 'La edad no puede ser negativa').nullable().optional(),
  birthState: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  coloniaName: z.string().nullable().optional(),
  fatherName: z.string().nullable().optional(),
  motherName: z.string().nullable().optional(),
  fatherAge: z.coerce.number().min(0, 'La edad no puede ser negativa').nullable().optional(),
  motherAge: z.coerce.number().min(0, 'La edad no puede ser negativa').nullable().optional(),
  registrationDate: z.string().nullable().optional(),
  derechoAbiencia: z.string().nullable().optional(),
  status: z.nativeEnum(PatientStatus).optional(),
  lastAppointmentDate: z.string().nullable().optional(),
});


type EditPatientFormValues = z.infer<typeof formSchema>;

type EditPatientFormProps = {
  patient: Patient;
  onFinished: () => void;
};

export function EditPatientForm({ patient, onFinished }: EditPatientFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditPatientFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: patient.name ?? '',
      paternalLastName: patient.paternalLastName ?? '',
      maternalLastName: patient.maternalLastName ?? '',
      curp: patient.curp ?? '',
      phoneNumber: patient.phoneNumber ?? '',
      expediente: patient.expediente ?? '',
      birthDate: patient.birthDate ?? '',
      sex: patient.sex ?? 'Hombre',
      age: patient.age ?? undefined,
      birthState: patient.birthState ?? '',
      address: patient.address ?? '',
      coloniaName: patient.coloniaName ?? '',
      fatherName: patient.fatherName ?? '',
      motherName: patient.motherName ?? '',
      fatherAge: patient.fatherAge ?? undefined,
      motherAge: patient.motherAge ?? undefined,
      registrationDate: patient.registrationDate ?? '',
      derechoAbiencia: patient.derechoAbiencia ?? '',
      status: patient.status || PatientStatus.Vigente,
      lastAppointmentDate: patient.lastAppointmentDate ?? '',
    },
  });

  const curp = form.watch('curp');

  useEffect(() => {
    if (curp && curp.length === 18 && /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/.test(curp)) {
      const data = parseCURP(curp);
      if (data) {
        form.setValue('sex', data.sex as 'Hombre' | 'Mujer');
        form.setValue('birthState', data.estadoNacimiento || 'NACIDO EN EL EXTRANJERO');
        form.setValue('age', calculateAge(data.birthDate));
        form.setValue('birthDate', formatDate(data.birthDate, 'yyyy-MM-dd'));
      }
    }
  }, [curp, form]);


  const onSubmit = (data: EditPatientFormValues) => {
    startTransition(async () => {
      const result = await updatePatient(patient.id, data);
      if (result.success) {
        toast({
          title: 'Paciente Actualizado',
          description: 'Los datos del paciente han sido guardados.',
        });
        onFinished();
      } else {
        toast({
          title: 'Error al Guardar',
          description: result.message || 'No se pudieron guardar los cambios.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Form {...form}>
       <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col overflow-hidden h-[80vh]">
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-8 p-4 pb-20">
                
                <div>
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">1</span>
                    Datos Personales
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="md:col-span-2">
                      <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre(s)</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="md:col-span-2">
                      <FormField control={form.control} name="paternalLastName" render={({ field }) => (<FormItem><FormLabel>Apellido Paterno</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="md:col-span-2">
                      <FormField control={form.control} name="maternalLastName" render={({ field }) => (<FormItem><FormLabel>Apellido Materno</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>

                    <div className="md:col-span-2">
                      <FormField control={form.control} name="curp" render={({ field }) => (<FormItem><FormLabel>CURP</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} maxLength={18} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="md:col-span-2">
                      <FormField control={form.control} name="birthDate" render={({ field }) => (<FormItem><FormLabel>Fecha de Nacimiento</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="md:col-span-2">
                      <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>Edad</FormLabel><FormControl><Input type="number" min={0} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>

                    <div className="md:col-span-2">
                      <FormField control={form.control} name="sex" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sexo</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="Hombre">Hombre</SelectItem>
                              <SelectItem value="Mujer">Mujer</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="md:col-span-2">
                      <FormField control={form.control} name="birthState" render={({ field }) => (<FormItem><FormLabel>Estado de Nacimiento</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="md:col-span-2">
                      <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} value={field.value ?? ''} maxLength={10} /></FormControl><FormMessage /></FormItem>)} />
                    </div>

                    <div className="md:col-span-3">
                      <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Domicilio</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="md:col-span-3">
                      <FormField control={form.control} name="coloniaName" render={({ field }) => (<FormItem><FormLabel>Municipio</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">2</span>
                    Datos Familiares
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                      <FormField control={form.control} name="fatherName" render={({ field }) => (<FormItem><FormLabel>Nombre del Padre</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="fatherAge" render={({ field }) => (<FormItem><FormLabel>Edad del Padre</FormLabel><FormControl><Input type="number" min={0} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                      <FormField control={form.control} name="motherName" render={({ field }) => (<FormItem><FormLabel>Nombre de la Madre</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="motherAge" render={({ field }) => (<FormItem><FormLabel>Edad de la Madre</FormLabel><FormControl><Input type="number" min={0} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">3</span>
                    Datos Administrativos
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="md:col-span-2">
                      <FormField control={form.control} name="expediente" render={({ field }) => (<FormItem><FormLabel>No. de Expediente</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="md:col-span-2">
                      <FormField control={form.control} name="registrationDate" render={({ field }) => (<FormItem><FormLabel>Fecha de Apertura</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="md:col-span-2">
                      <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estatus</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || PatientStatus.Vigente}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar Estatus" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value={PatientStatus.Vigente}>Vigente</SelectItem>
                              <SelectItem value={PatientStatus.Baja}>Baja Temporal</SelectItem>
                              <SelectItem value={PatientStatus.BajaDefinitiva}>Baja Definitiva</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    
                    <div className="md:col-span-3">
                      <FormField
                        control={form.control}
                        name="derechoAbiencia"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Derechoabiencia</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar Institución" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="IMSS">IMSS</SelectItem>
                                <SelectItem value="ISSSTE">ISSSTE</SelectItem>
                                <SelectItem value="IMSS-BIENESTAR">IMSS-Bienestar</SelectItem>
                                <SelectItem value="PEMEX">PEMEX</SelectItem>
                                <SelectItem value="SEDENA">SEDENA</SelectItem>
                                <SelectItem value="SEMAR">SEMAR</SelectItem>
                                <SelectItem value="ISSSET">ISSSET</SelectItem>
                                <SelectItem value="OTRO">OTRO</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <FormField control={form.control} name="lastAppointmentDate" render={({ field }) => (<FormItem><FormLabel>Última Cita (Sólo Lectura)</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  </div>
                </div>

              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 p-4 border-t bg-background mt-auto shrink-0">
              <Button type="button" variant="ghost" onClick={onFinished}>Cancelar</Button>
              <Button type="submit" disabled={isPending} className="min-w-[150px]">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            </div>
          </form>
    </Form>
  );
}
