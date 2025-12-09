'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';
import { useAuth } from '@/firebase';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';

const formSchema = z.object({
  email: z.string().min(1, { message: 'El correo electrónico o usuario es requerido.' }),
  password: z.string().min(1, { message: 'La contraseña es requerida.' }),
});

type LoginFormProps = {
    onSuperAdminLogin?: (credentials: {email: string, pass: string}) => void;
}

export function LoginForm({ onSuperAdminLogin }: LoginFormProps) {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const auth = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsPending(true);

    // Hardcoded SuperAdmin check
    if (data.email === 'SuperAdmin' && data.password === 'Hu1m4ngu1ll0') {
      if (onSuperAdminLogin) {
        onSuperAdminLogin({email: data.email, pass: data.password});
        toast({
            title: 'Inicio de Sesión Exitoso',
            description: 'Bienvenido, Super Administrador.',
        });
      }
      setIsPending(false);
      return;
    }
    
    // Fallback to Firebase Auth for other users (doctors)
    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithEmailAndPassword(auth, data.email, data.password);
        toast({
            title: 'Inicio de Sesión Exitoso',
            description: 'Bienvenido al panel.',
        });
        // The onAuthStateChanged listener in the parent page will handle the UI change.
    } catch (error: any) {
        let description = 'Ocurrió un error inesperado.';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            description = 'Usuario o contraseña incorrectos.';
        }
        toast({
            title: 'Error de Autenticación',
            description,
            variant: 'destructive',
        });
    } finally {
        setIsPending(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center items-center">
          <div className="text-primary mb-4">
            <Image
                src={logoBase64}
                alt="Logo CitaMedicaFacil"
                width={80}
                height={80}
                className="rounded-md"
            />
          </div>
          <CardTitle className="text-2xl font-bold font-headline">
            Acceso de Personal
          </CardTitle>
          <CardDescription>
            Ingresa tus credenciales para continuar
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario o Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="SuperAdmin o tu@correo.com"
                        {...field}
                        autoComplete="email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Tu contraseña"
                          {...field}
                          autoComplete="current-password"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute inset-y-0 right-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                        <span className="sr-only">
                          {showPassword ? 'Ocultar' : 'Mostrar'} contraseña
                        </span>
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                {isPending ? 'Verificando...' : 'Ingresar'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
