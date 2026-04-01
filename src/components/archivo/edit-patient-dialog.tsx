'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import type { Patient } from '@/lib/definitions';
import { PatientStatus } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { parseCURP, calculateAge } from '@/lib/curp';
import { format as formatDate } from 'date-fns';

type EditPatientDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onSave: (patient: Omit<Patient, 'id'>, id?: string) => void;
  isSaving: boolean;
};

const formSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  paternalLastName: z.string().min(1, 'Apellido paterno es requerido'),
  maternalLastName: z.string().min(1, 'Apellido materno es requerido'),
  curp: z.string().min(1, 'CURP es requerida'),
  phoneNumber: z.string().nullable().optional(),
  expediente: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  sex: z.enum(['Hombre', 'Mujer']),
  age: z.coerce.number().nullable().optional(),
  birthState: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  coloniaName: z.string().nullable().optional(),
  fatherName: z.string().nullable().optional(),
  motherName: z.string().nullable().optional(),
  fatherAge: z.coerce.number().nullable().optional(),
  motherAge: z.coerce.number().nullable().optional(),
  registrationDate: z.string().nullable().optional(),
  derechoAbiencia: z.string().nullable().optional(),
  status: z.nativeEnum(PatientStatus).optional(),
  lastAppointmentDate: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function EditPatientDialog({ isOpen, onClose, patient, onSave, isSaving }: EditPatientDialogProps) {

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        name: '',
        paternalLastName: '',
        maternalLastName: '',
        curp: '',
        phoneNumber: '',
        expediente: '',
        birthDate: '',
        sex: 'Hombre',
        age: undefined,
        birthState: '',
        address: '',
        coloniaName: '',
        fatherName: '',
        motherName: '',
        fatherAge: undefined,
        motherAge: undefined,
        registrationDate: '',
        derechoAbiencia: '',
        status: PatientStatus.Vigente,
        lastAppointmentDate: '',
    },
  });
  
  const curp = form.watch('curp');
  
  React.useEffect(() => {
    if (isOpen) {
      if (patient) {
        form.reset({
          ...patient,
          age: patient.age ?? undefined,
          fatherAge: patient.fatherAge ?? undefined,
          motherAge: patient.motherAge ?? undefined,
        });
      } else {
        form.reset({
          name: '',
          paternalLastName: '',
          maternalLastName: '',
          curp: '',
          phoneNumber: '',
          expediente: '',
          birthDate: '',
          sex: 'Hombre',
          age: undefined,
          birthState: '',
          address: '',
          coloniaName: '',
          fatherName: '',
          motherName: '',
          fatherAge: undefined,
          motherAge: undefined,
          registrationDate: formatDate(new Date(), 'yyyy-MM-dd'),
          derechoAbiencia: '',
          status: PatientStatus.Vigente,
          lastAppointmentDate: '',
        });
      }
    }
  }, [isOpen, patient, form]);

  React.useEffect(() => {
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

  const onSubmit = (data: FormValues) => {
    onSave(data, patient?.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle>{patient ? 'Editar Paciente' : 'Agregar Nuevo Paciente'}</DialogTitle>
          <DialogDescription>
            Completa la información del paciente. Todos los campos se guardarán en el padrón.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <ScrollArea className="flex-1 w-full">
              <div className="space-y-8 p-6 pb-20">
                
                <div>
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">1</span>
                    Datos Personales
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre(s)</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="paternalLastName" render={({ field }) => (<FormItem><FormLabel>Apellido Paterno</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="maternalLastName" render={({ field }) => (<FormItem><FormLabel>Apellido Materno</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <FormField control={form.control} name="curp" render={({ field }) => (<FormItem><FormLabel>CURP</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} maxLength={18} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="birthDate" render={({ field }) => (<FormItem><FormLabel>Fecha de Nacimiento</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>Edad</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
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
                    <FormField control={form.control} name="birthState" render={({ field }) => (<FormItem><FormLabel>Estado de Nacimiento</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Domicilio</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="coloniaName" render={({ field }) => (<FormItem><FormLabel>Municipio</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">2</span>
                    Datos Familiares
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                      <FormField control={form.control} name="fatherName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del Padre</FormLabel>
                          <FormControl><Input placeholder="Nombre completo" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="fatherAge" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Edad del Padre</FormLabel>
                          <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                      <FormField control={form.control} name="motherName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de la Madre</FormLabel>
                          <FormControl><Input placeholder="Nombre completo" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="motherAge" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Edad de la Madre</FormLabel>
                          <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">3</span>
                    Datos Administrativos
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="expediente" render={({ field }) => (<FormItem><FormLabel>No. de Expediente</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="registrationDate" render={({ field }) => (<FormItem><FormLabel>Fecha de Apertura</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
                    <FormField control={form.control} name="lastAppointmentDate" render={({ field }) => (<FormItem><FormLabel>Última Cita (Sólo Lectura)</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} readOnly className="bg-muted" /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </div>

              </div>
            </ScrollArea>
            <DialogFooter className="p-6 border-t bg-background shrink-0">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isSaving} className="min-w-[150px]">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Guardar Paciente'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
