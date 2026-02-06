'use client';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useToast } from '@/hooks/use-toast';
import { getUsers, getClinics, updateUsers } from '@/lib/actions';
import { Loader2, Trash2, PlusCircle, Users, Save, Eye, EyeOff } from 'lucide-react';
import type { User, Clinic } from '@/lib/definitions';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';

const userSchema = z.object({
  id: z.string(),
  email: z.string().email('Email no válido.'),
  name: z.string().min(2, 'El nombre es requerido.'),
  role: z.enum(['admin', 'doctor']),
  clinicId: z.string().optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').optional().or(z.literal('')),
});

const formSchema = z.object({
  users: z.array(userSchema),
});


export function UsersManager() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { users: [] },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'users',
  });
  
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersData, clinicsData] = await Promise.all([getUsers(), getClinics()]);
      replace(usersData);
      setClinics(clinicsData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los usuarios y clínicas.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [replace, toast]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const toggleShowPassword = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    startSavingTransition(async () => {
      const result = await updateUsers(data.users);
      if (result.success) {
        toast({ title: 'Usuarios Guardados', description: 'Los usuarios se han actualizado.' });
        fetchData();
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    });
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users /> Gestionar Usuarios</CardTitle>
          <CardDescription>Crea y gestiona administradores y doctores.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users /> Gestionar Usuarios</CardTitle>
            <CardDescription>Crea y gestiona administradores y doctores. Las contraseñas solo son necesarias al crear un usuario nuevo o al querer cambiarla.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 max-h-96 overflow-y-auto p-4">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg space-y-4 relative bg-background">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  className="absolute top-2 right-2"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`users.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl><Input placeholder="Nombre completo" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`users.${index}.email`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input placeholder="email@dominio.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name={`users.${index}.password`}
                      render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contraseña (solo para crear/cambiar)</FormLabel>
                            <div className="relative">
                               <FormControl>
                                <Input
                                    type={showPasswords[field.name] ? 'text' : 'password'}
                                    placeholder="Dejar en blanco para no cambiar"
                                    {...field}
                                    value={field.value ?? ''}
                                />
                               </FormControl>
                               <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute inset-y-0 right-0 h-full px-3"
                                    onClick={() => toggleShowPassword(field.name)}
                                >
                                    {showPasswords[field.name] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                      )}
                    />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`users.${index}.role`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rol</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un rol" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="doctor">Doctor</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch(`users.${index}.role`) === 'doctor' && (
                    <FormField
                      control={form.control}
                      name={`users.${index}.clinicId`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Asignar a Núcleo Básico</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un núcleo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {clinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => append({ id: `new-${Date.now()}`, name: '', email: '', role: 'doctor', password: '' })}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Agregar Usuario
            </Button>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar Usuarios
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
