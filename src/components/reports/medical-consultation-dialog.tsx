'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Stethoscope, 
    Baby, 
    ClipboardList, 
    HeartPulse, 
    ShieldCheck, 
    Loader2, 
    Save, 
    CalendarDays,
    Search,
    FilePlus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveMedicalConsultation, getConsultationByAppointmentId } from '@/lib/actions';
import type { Appointment, Clinic, MedicalConsultation } from '@/lib/definitions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CreatePrescriptionDialog } from './create-prescription-dialog';

const formSchema = z.object({
  service: z.string().min(1, 'El servicio es requerido'),
  weight: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  waist: z.coerce.number().optional(),
  systolicBP: z.coerce.number().optional(),
  diastolicBP: z.coerce.number().optional(),
  heartRate: z.coerce.number().optional(),
  respiratoryRate: z.coerce.number().optional(),
  temperature: z.coerce.number().optional(),
  oxygenSaturation: z.coerce.number().optional(),
  glucose: z.coerce.number().optional(),
  fastingGlucose: z.boolean().default(false),
  tbSymptomatic: z.string().optional(),
  firstTimeOfYear: z.boolean().default(false),
  motiveRelation: z.string().min(1, 'Motivo requerido'),
  diagnosis1: z.string().min(1, 'Diagnóstico primario requerido'),
  diagnosis1Type: z.string().default('Subsecuente'),
  diagnosis2: z.string().optional(),
  diagnosis2Type: z.string().optional(),
  diagnosis3: z.string().optional(),
  diagnosis3Type: z.string().optional(),
  mentalHealthAction: z.string().optional(),
  recipeFolio: z.string().optional(),
  pregestationalCare: z.enum(['Primera vez', 'Subsecuente']).optional(),
  pregestationalRisk: z.string().optional(),
  pregnancyTrimester: z.string().optional(),
  pregnancyHighRisk: z.boolean().default(false),
  pregnancyComplications: z.array(z.string()).default([]),
  pregnancyActions: z.array(z.string()).default([]),
  puerperiumType: z.enum(['Puérpera 1ra', 'Puérpera Sub']).optional(),
  puerperiumInfection: z.boolean().default(false),
  puerperiumPlanning: z.boolean().default(false),
  otherEvents: z.array(z.string()).default([]),
  vsoPackets: z.coerce.number().default(0),
  lifeLine: z.boolean().default(false),
  healthCard: z.boolean().default(false),
  vaccinationComplete: z.boolean().default(false),
  referredBy: z.string().optional(),
  counterReferred: z.boolean().default(false),
  telemedicineRole: z.string().optional(),
  telemedicineStudies: z.boolean().default(false),
  nextAppointmentDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function MedicalConsultationDialog({ 
    appointment, 
    clinic, 
    isOpen, 
    onClose, 
    onSuccess 
}: { 
    appointment: Appointment; 
    clinic: Clinic; 
    isOpen: boolean; 
    onClose: () => void;
    onSuccess: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPrescriptionDialogOpen, setIsPrescriptionDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      service: clinic.clinicType || 'Consulta Externa',
      pregnancyComplications: [],
      pregnancyActions: [],
      otherEvents: [],
      vsoPackets: 0,
      motiveRelation: 'Subsecuente',
      diagnosis1Type: 'Subsecuente',
      diagnosis1: '',
      diagnosis2: '',
      diagnosis3: '',
      recipeFolio: '',
      referredBy: '',
      nextAppointmentDate: '',
    },
  });

  const weight = form.watch('weight');
  const height = form.watch('height');
  const [imc, setImc] = useState<number | null>(null);

  useEffect(() => {
    if (weight && height) {
      const hMeter = height / 100;
      const calculatedImc = weight / (hMeter * hMeter);
      setImc(parseFloat(calculatedImc.toFixed(1)));
    } else {
      setImc(null);
    }
  }, [weight, height]);

  useEffect(() => {
    if (isOpen) {
      setIsInitialLoading(true);
      getConsultationByAppointmentId(appointment.id).then(existing => {
        if (existing) {
          form.reset({
              ...existing as any,
              vsoPackets: existing.vsoPackets || 0,
              diagnosis1: existing.diagnosis1 || '',
              diagnosis2: existing.diagnosis2 || '',
              diagnosis3: existing.diagnosis3 || '',
              recipeFolio: existing.recipeFolio || '',
              referredBy: existing.referredBy || '',
              nextAppointmentDate: existing.nextAppointmentDate || '',
          });
        }
        setIsInitialLoading(false);
      });
    }
  }, [isOpen, appointment.id, clinic.clinicType, form]);

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true);
    try {
      const res = await saveMedicalConsultation({
        ...values,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        clinicId: clinic.id,
        doctorName: clinic.doctorName,
        date: new Date().toISOString(),
        imc: imc || undefined
      });

      if (res.success) {
        toast({ title: 'Consulta Guardada', description: 'El registro clínico ha sido actualizado.' });
        onSuccess();
        onClose();
      } else {
        toast({ title: 'Error al guardar', description: res.message, variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[95vw] h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase">
                  <Stethoscope className="h-7 w-7 text-primary" /> Registro de Consulta Médica
                </DialogTitle>
                <DialogDescription className="text-sm font-bold">
                  Paciente: {appointment.patient.name} {appointment.patient.paternalLastName} ({appointment.patient.age} años)
                </DialogDescription>
              </div>
              <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="font-mono text-[10px] bg-background">FOLIO: {appointment.appointmentNumber}</Badge>
                  <Badge className="bg-primary/10 text-primary border-primary/20">{clinic.name}</Badge>
              </div>
            </div>
          </DialogHeader>

          {isInitialLoading ? (
              <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
          ) : (
              <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                  <Tabs defaultValue="externa" className="flex-1 flex flex-col min-h-0">
                      <div className="px-6 border-b bg-muted/5">
                          <TabsList className="bg-transparent h-12 w-full justify-start gap-4">
                              <TabsTrigger value="externa" className="data-[state=active]:bg-primary data-[state=active]:text-white font-bold h-10 px-6 rounded-t-lg">
                                  <ClipboardList className="mr-2 h-4 w-4" /> 1. Consulta Externa
                              </TabsTrigger>
                              <TabsTrigger value="obstetrica" className="data-[state=active]:bg-primary data-[state=active]:text-white font-bold h-10 px-6 rounded-t-lg">
                                  <Baby className="mr-2 h-4 w-4" /> 2. Consulta Obstétrica / Eventos
                              </TabsTrigger>
                              <TabsTrigger value="promocion" className="data-[state=active]:bg-primary data-[state=active]:text-white font-bold h-10 px-6 rounded-t-lg">
                                  <ShieldCheck className="mr-2 h-4 w-4" /> 3. Promoción y Referencia
                              </TabsTrigger>
                          </TabsList>
                      </div>

                      <ScrollArea className="flex-1">
                          <div className="p-8 pb-20">
                              <TabsContent value="externa" className="mt-0 space-y-10">
                                  <section className="space-y-4">
                                      <h3 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                          <HeartPulse className="h-5 w-5" /> Signos Vitales y Somatometría
                                      </h3>
                                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-6 bg-muted/10 p-6 rounded-2xl border border-dashed">
                                          <FormField control={form.control} name="weight" render={({ field }) => (
                                              <FormItem><FormLabel className="text-xs">Peso (kg)</FormLabel><FormControl><Input type="number" step="0.1" {...field} value={field.value ?? ''} className="h-10 font-bold"/></FormControl></FormItem>
                                          )} />
                                          <FormField control={form.control} name="height" render={({ field }) => (
                                              <FormItem><FormLabel className="text-xs">Talla (cm)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-10 font-bold"/></FormControl></FormItem>
                                          )} />
                                          <div className="space-y-2">
                                              <Label className="text-xs">IMC (Calculado)</Label>
                                              <div className={cn("h-10 flex items-center justify-center rounded-md border font-black", imc && imc >= 30 ? "bg-red-100 text-red-700" : imc ? "bg-green-100 text-green-700" : "bg-muted/50")}>
                                                  {imc || '---'}
                                              </div>
                                          </div>
                                          <FormField control={form.control} name="waist" render={({ field }) => (
                                              <FormItem><FormLabel className="text-xs">Cintura (cm)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-10 font-bold"/></FormControl></FormItem>
                                          )} />
                                          <div className="col-span-2 grid grid-cols-2 gap-2">
                                              <FormField control={form.control} name="systolicBP" render={({ field }) => (
                                                  <FormItem><FormLabel className="text-[10px]">T.A. Sistólica</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-10 font-bold"/></FormControl></FormItem>
                                              )} />
                                              <FormField control={form.control} name="diastolicBP" render={({ field }) => (
                                                  <FormItem><FormLabel className="text-[10px]">T.A. Diastólica</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-10 font-bold"/></FormControl></FormItem>
                                              )} />
                                          </div>
                                          <FormField control={form.control} name="heartRate" render={({ field }) => (
                                              <FormItem><FormLabel className="text-xs">FC (lpm)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-10 font-bold"/></FormControl></FormItem>
                                          )} />
                                          <FormField control={form.control} name="respiratoryRate" render={({ field }) => (
                                              <FormItem><FormLabel className="text-xs">FR (rpm)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-10 font-bold"/></FormControl></FormItem>
                                          )} />
                                          <FormField control={form.control} name="temperature" render={({ field }) => (
                                              <FormItem><FormLabel className="text-xs">Temp (°C)</FormLabel><FormControl><Input type="number" step="0.1" {...field} value={field.value ?? ''} className="h-10 font-bold"/></FormControl></FormItem>
                                          )} />
                                          <FormField control={form.control} name="oxygenSaturation" render={({ field }) => (
                                              <FormItem><FormLabel className="text-xs">SatO2 (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-10 font-bold"/></FormControl></FormItem>
                                          )} />
                                          <FormField control={form.control} name="glucose" render={({ field }) => (
                                              <FormItem><FormLabel className="text-xs">Glucemia</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} className="h-10 font-bold"/></FormControl></FormItem>
                                          )} />
                                          <FormField control={form.control} name="fastingGlucose" render={({ field }) => (
                                              <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-8">
                                                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                  <FormLabel className="text-[10px]">En ayunas</FormLabel>
                                              </FormItem>
                                          )} />
                                      </div>
                                  </section>

                                  <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                      <FormField control={form.control} name="service" render={({ field }) => (
                                          <FormItem>
                                              <FormLabel className="font-bold">Servicio</FormLabel>
                                              <Select onValueChange={field.onChange} value={field.value}>
                                                  <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                                                  <SelectContent>
                                                      <SelectItem value="Consulta Externa">Consulta Externa</SelectItem>
                                                      <SelectItem value="Especializada">Consulta Especializada</SelectItem>
                                                      <SelectItem value="Salud Mental">Salud Mental</SelectItem>
                                                      <SelectItem value="Urgencias">Urgencias</SelectItem>
                                                  </SelectContent>
                                              </Select>
                                          </FormItem>
                                      )} />
                                      <FormField control={form.control} name="motiveRelation" render={({ field }) => (
                                          <FormItem>
                                              <FormLabel className="font-bold">Relación Temporal con el Motivo</FormLabel>
                                              <Select onValueChange={field.onChange} value={field.value}>
                                                  <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                                                  <SelectContent>
                                                      <SelectItem value="Primera vez">Primera vez</SelectItem>
                                                      <SelectItem value="Subsecuente">Subsecuente</SelectItem>
                                                  </SelectContent>
                                              </Select>
                                          </FormItem>
                                      )} />
                                      <FormField control={form.control} name="firstTimeOfYear" render={({ field }) => (
                                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-4 border rounded-xl bg-muted/5 mt-6">
                                              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                              <div className="space-y-1 leading-none">
                                                  <FormLabel className="font-bold">Primera vez en el año</FormLabel>
                                              </div>
                                          </FormItem>
                                      )} />
                                  </section>

                                  <Separator />

                                  <section className="space-y-6">
                                      <h3 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                          <Search className="h-5 w-5" /> Diagnósticos (CIE-10)
                                      </h3>
                                      <div className="grid gap-4">
                                          {[1, 2, 3].map(n => (
                                              <div key={n} className="grid sm:grid-cols-6 gap-4 p-4 border rounded-xl bg-background shadow-sm">
                                                  <div className="sm:col-span-4 space-y-2">
                                                      <Label className="text-[10px] font-black opacity-50">DIAGNÓSTICO {n}</Label>
                                                      <FormField control={form.control} name={`diagnosis${n}` as any} render={({ field }) => (
                                                          <FormControl><Input placeholder="Código o nombre..." {...field} value={field.value ?? ''} className="h-11 uppercase font-bold" /></FormControl>
                                                      )} />
                                                  </div>
                                                  <div className="sm:col-span-2 space-y-2">
                                                      <Label className="text-[10px] font-black opacity-50">TIPO</Label>
                                                      <FormField control={form.control} name={`diagnosis${n}Type` as any} render={({ field }) => (
                                                          <Select onValueChange={field.onChange} value={field.value || 'Subsecuente'}>
                                                              <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                                                              <SelectContent>
                                                                  <SelectItem value="Primera vez">Primera vez</SelectItem>
                                                                  <SelectItem value="Subsecuente">Subsecuente</SelectItem>
                                                              </SelectContent>
                                                          </Select>
                                                      )} />
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </section>

                                  <section className="grid sm:grid-cols-2 gap-8">
                                      <FormField control={form.control} name="mentalHealthAction" render={({ field }) => (
                                          <FormItem>
                                              <FormLabel className="font-bold">Acciones de Salud Mental</FormLabel>
                                              <Select onValueChange={field.onChange} value={field.value}>
                                                  <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar acción..." /></SelectTrigger></FormControl>
                                                  <SelectContent>
                                                      <SelectItem value="Detección Depresión">Detección Depresión</SelectItem>
                                                      <SelectItem value="Detección Violencia">Detección Violencia</SelectItem>
                                                      <SelectItem value="Adicciones">Adicciones</SelectItem>
                                                      <SelectItem value="Ninguna">Ninguna</SelectItem>
                                                  </SelectContent>
                                              </Select>
                                          </FormItem>
                                      )} />
                                      <FormField control={form.control} name="recipeFolio" render={({ field }) => (
                                          <FormItem>
                                              <FormLabel className="font-black text-primary">Folio de Receta</FormLabel>
                                              <div className="flex gap-2">
                                                <FormControl>
                                                    <Input placeholder="Folio receta..." {...field} value={field.value ?? ''} className="h-11 bg-muted/5 font-bold" />
                                                </FormControl>
                                                <Button type="button" variant="secondary" className="h-11 font-black bg-blue-600 text-white hover:bg-blue-700" onClick={() => setIsPrescriptionDialogOpen(true)}>
                                                    <FilePlus className="mr-2 h-5 w-5" /> DIGITAL
                                                </Button>
                                              </div>
                                          </FormItem>
                                      )} />
                                  </section>
                              </TabsContent>

                              <TabsContent value="obstetrica" className="mt-0 space-y-10">
                                  <div className="grid lg:grid-cols-2 gap-10">
                                      <Card className="border-primary/10 shadow-sm overflow-hidden">
                                          <CardHeader className="bg-primary/5 pb-4">
                                              <CardTitle className="text-base uppercase tracking-tight">Atención Pregestacional</CardTitle>
                                          </CardHeader>
                                          <CardContent className="pt-6 space-y-6">
                                              <FormField control={form.control} name="pregestationalCare" render={({ field }) => (
                                                  <FormItem className="space-y-3">
                                                      <FormControl>
                                                          <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                                              <div className="flex items-center space-x-2"><RadioGroupItem value="Primera vez" id="pg-1" /><Label htmlFor="pg-1">Primera vez</Label></div>
                                                              <div className="flex items-center space-x-2"><RadioGroupItem value="Subsecuente" id="pg-2" /><Label htmlFor="pg-2">Subsecuente</Label></div>
                                                          </RadioGroup>
                                                      </FormControl>
                                                  </FormItem>
                                              )} />
                                              <FormField control={form.control} name="pregestationalRisk" render={({ field }) => (
                                                  <FormItem>
                                                      <FormLabel className="text-xs font-bold">Riesgo Detectado</FormLabel>
                                                      <Select onValueChange={field.onChange} value={field.value}>
                                                          <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Riesgo..." /></SelectTrigger></FormControl>
                                                          <SelectContent>
                                                              <SelectItem value="Bajo">Bajo</SelectItem>
                                                              <SelectItem value="Alto">Alto</SelectItem>
                                                              <SelectItem value="Muy Alto">Muy Alto</SelectItem>
                                                          </SelectContent>
                                                      </Select>
                                                  </FormItem>
                                              )} />
                                          </CardContent>
                                      </Card>

                                      <Card className="border-pink-200 shadow-sm overflow-hidden">
                                          <CardHeader className="bg-pink-50 pb-4">
                                              <CardTitle className="text-base uppercase tracking-tight text-pink-700">Control de Embarazada</CardTitle>
                                          </CardHeader>
                                          <CardContent className="pt-6 space-y-6">
                                              <div className="grid grid-cols-2 gap-4">
                                                  <FormField control={form.control} name="pregnancyTrimester" render={({ field }) => (
                                                      <FormItem>
                                                          <FormLabel className="text-xs font-bold">Trimestre</FormLabel>
                                                          <Select onValueChange={field.onChange} value={field.value}>
                                                              <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                                                              <SelectContent>
                                                                  <SelectItem value="1ro">1ro</SelectItem>
                                                                  <SelectItem value="2do">2do</SelectItem>
                                                                  <SelectItem value="3ro">3ro</SelectItem>
                                                              </SelectContent>
                                                          </Select>
                                                      </FormItem>
                                                  )} />
                                                  <FormField control={form.control} name="pregnancyHighRisk" render={({ field }) => (
                                                      <FormItem className="flex items-center space-x-2 space-y-0 pt-8">
                                                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                          <FormLabel className="text-xs font-bold text-red-600">ALTO RIESGO</FormLabel>
                                                      </FormItem>
                                                  )} />
                                              </div>
                                          </CardContent>
                                      </Card>
                                  </div>

                                  <div className="grid lg:grid-cols-2 gap-10">
                                      <div className="space-y-6">
                                          <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider">Control de Puerperio</h4>
                                          <div className="space-y-4 p-6 border rounded-2xl bg-muted/5">
                                              <FormField control={form.control} name="puerperiumType" render={({ field }) => (
                                                  <FormItem>
                                                      <FormControl>
                                                          <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                                              <div className="flex items-center space-x-2"><RadioGroupItem value="Puérpera 1ra" id="p-1" /><Label htmlFor="p-1">Puérpera (1ra)</Label></div>
                                                              <div className="flex items-center space-x-2"><RadioGroupItem value="Puérpera Sub" id="p-2" /><Label htmlFor="p-2">Puérpera (Sub)</Label></div>
                                                          </RadioGroup>
                                                      </FormControl>
                                                  </FormItem>
                                              )} />
                                              <div className="flex gap-6 pt-2">
                                                  <FormField control={form.control} name="puerperiumInfection" render={({ field }) => (
                                                      <FormItem className="flex items-center space-x-2 space-y-0">
                                                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                          <FormLabel className="text-xs">Con infección</FormLabel>
                                                      </FormItem>
                                                  )} />
                                                  <FormField control={form.control} name="puerperiumPlanning" render={({ field }) => (
                                                      <FormItem className="flex items-center space-x-2 space-y-0">
                                                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                          <FormLabel className="text-xs">Aceptante Planif.</FormLabel>
                                                      </FormItem>
                                                  )} />
                                              </div>
                                          </div>
                                      </div>
                                      <div className="space-y-6">
                                          <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider">Otros Eventos</h4>
                                          <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-6 border rounded-2xl bg-muted/5">
                                              {[{ id: 'hormonal', label: 'Terapia Hormonal' }, { id: 'menopause', label: 'Menopausia' }, { id: 'its', label: 'ITS' }, { id: 'mamaria', label: 'Patología Mamaria' }, { id: 'cancer', label: 'Detección Cáncer' }].map(ev => (
                                                  <div key={ev.id} className="flex items-center space-x-2">
                                                      <Checkbox id={ev.id} checked={form.watch('otherEvents')?.includes(ev.id)} onCheckedChange={(v) => {
                                                              const cur = form.getValues('otherEvents') || [];
                                                              form.setValue('otherEvents', v ? [...cur, ev.id] : cur.filter(x => x !== ev.id));
                                                          }}
                                                      />
                                                      <Label htmlFor={ev.id} className="text-xs cursor-pointer">{ev.label}</Label>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  </div>
                              </TabsContent>

                              <TabsContent value="promocion" className="mt-0 space-y-10">
                                  <section className="grid lg:grid-cols-2 gap-10">
                                      <div className="space-y-6">
                                          <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider">Promoción de la Salud</h4>
                                          <div className="grid gap-4 bg-muted/5 p-6 border rounded-2xl">
                                              <FormField control={form.control} name="vsoPackets" render={({ field }) => (
                                                  <FormItem className="flex items-center justify-between"><FormLabel>Sobres VSO Entregados</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? 0} className="w-24 text-center font-bold" /></FormControl></FormItem>
                                              )} />
                                              <FormField control={form.control} name="lifeLine" render={({ field }) => (
                                                  <FormItem className="flex items-center justify-between space-y-0"><FormLabel>Se otorgó Línea de Vida</FormLabel><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                              )} />
                                              <FormField control={form.control} name="healthCard" render={({ field }) => (
                                                  <FormItem className="flex items-center justify-between space-y-0"><FormLabel>Presentó Cartilla</FormLabel><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
                                              )} />
                                          </div>
                                      </div>
                                      <div className="space-y-6">
                                          <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider">Referencia y Telemedicina</h4>
                                          <div className="space-y-4 bg-muted/5 p-6 border rounded-2xl">
                                              <FormField control={form.control} name="referredBy" render={({ field }) => (
                                                  <FormItem><FormLabel className="text-[10px] font-bold uppercase">Referido por</FormLabel><Input placeholder="Unidad..." {...field} value={field.value ?? ''} className="h-10" /></FormItem>
                                              )} />
                                              <FormField control={form.control} name="counterReferred" render={({ field }) => (
                                                  <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-xs">CONTRARREFERIDO</FormLabel></FormItem>
                                              )} />
                                          </div>
                                      </div>
                                  </section>

                                  <Separator />

                                  <section className="max-w-md mx-auto">
                                      <FormField control={form.control} name="nextAppointmentDate" render={({ field }) => (
                                          <FormItem><FormLabel className="font-bold flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Próxima Cita Sugerida</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ''} className="h-11" /></FormControl></FormItem>
                                      )} />
                                  </section>
                              </TabsContent>
                          </div>
                      </ScrollArea>
                  </Tabs>

                  <DialogFooter className="p-6 border-t bg-muted/20 shrink-0">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-8">Cancelar</Button>
                    <Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={isSaving} className="h-12 px-12 font-black bg-primary hover:bg-primary/90 shadow-xl transition-all">
                      {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                      FINALIZAR Y GUARDAR CONSULTA
                    </Button>
                  </DialogFooter>
              </form>
              </Form>
          )}
        </DialogContent>
      </Dialog>

      {isPrescriptionDialogOpen && (
          <CreatePrescriptionDialog 
            isOpen={isPrescriptionDialogOpen}
            onClose={() => setIsPrescriptionDialogOpen(false)}
            clinic={clinic}
            initialPatient={appointment.patient}
            onPrescriptionCreated={(folio) => {
                form.setValue('recipeFolio', folio);
                setIsPrescriptionDialogOpen(false);
                toast({ title: 'Folio Actualizado', description: `Se vinculó la receta ${folio} a la consulta.` });
            }}
          />
      )}
    </>
  );
}

