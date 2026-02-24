'use client';

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
  phoneNumber: z.string().optional(),
  expediente: z.string().optional(),
  birthDate: z.string().optional(),
  sex: z.enum(['Hombre', 'Mujer']),
  age: z.number().optional(),
  birthState: z.string().optional(),
  address: z.string().optional(),
  coloniaName: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  fatherAge: z.number().optional(),
  motherAge: z.number().optional(),
  registrationDate: z.string().optional(),
  derechoAbiencia: z.string().optional(),
  status: z.nativeEnum(PatientStatus).optional(),
  lastAppointmentDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function EditPatientDialog({ isOpen, onClose, patient, onSave, isSaving }: EditPatientDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...patient,
      status: patient?.status || PatientStatus.Vigente,
    } || {
      status: PatientStatus.Vigente
    },
  });

  const onSubmit = (data: FormValues) => {
    onSave(data, patient?.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{patient ? 'Editar Paciente' : 'Agregar Nuevo Paciente'}</DialogTitle>
          <DialogDescription>
            Completa la información del paciente. Haz clic en guardar cuando termines.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[60vh] p-4">
              <div className="space-y-4">
                 <FormField control={form.control} name="expediente" render={({ field }) => (<FormItem><FormLabel>No.Expediente</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                   <FormField control={form.control} name="paternalLastName" render={({ field }) => (<FormItem><FormLabel>Apaterno</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                   <FormField control={form.control} name="maternalLastName" render={({ field }) => (<FormItem><FormLabel>Amaterno</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <FormField control={form.control} name="curp" render={({ field }) => (<FormItem><FormLabel>CURP</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="birthDate" render={({ field }) => (<FormItem><FormLabel>FNacimiento</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="age" render={({ field }) => (<FormItem><FormLabel>Edad</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseInt(e.target.value, 10) || undefined)} /></FormControl><FormMessage /></FormItem>)} />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="sex" render={({ field }) => (<FormItem><FormLabel>Sexo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona el sexo"/>
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Hombre">Hombre</SelectItem>
                                <SelectItem value="Mujer">Mujer</SelectItem>
                            </SelectContent>
                        </Select>
                    <FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="birthState" render={({ field }) => (<FormItem><FormLabel>Estado</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Telefono</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                 </div>
                 <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Domicilio</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="coloniaName" render={({ field }) => (<FormItem><FormLabel>Colonia</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="fatherName" render={({ field }) => (<FormItem><FormLabel>NombrePadre</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="fatherAge" render={({ field }) => (<FormItem><FormLabel>EdadPadre</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseInt(e.target.value, 10) || undefined)}/></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="motherName" render={({ field }) => (<FormItem><FormLabel>NombreMadre</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="motherAge" render={({ field }) => (<FormItem><FormLabel>EdadMadre</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseInt(e.target.value, 10) || undefined)}/></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="registrationDate" render={({ field }) => (<FormItem><FormLabel>FechaApertura</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="lastAppointmentDate" render={({ field }) => (<FormItem><FormLabel>Última Cita</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} readOnly /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="derechoAbiencia" render={({ field }) => (<FormItem><FormLabel>Derechoabiencia</FormLabel><FormControl><Input placeholder="IMSS, ISSSTE, etc." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                 </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Paciente
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
