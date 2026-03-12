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
import { Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import { verifyAdminPassword } from '@/lib/actions';

const formSchema = z.object({
  email: z.string().min(1, { message: 'El usuario es requerido.' }),
  password: z.string().min(1, { message: 'La contraseña es requerida.' }),
});

type LoginFormProps = {
    onSuperAdminLogin: () => void;
}

export function LoginForm({ onSuperAdminLogin }: LoginFormProps) {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: 'SuperAdmin',
      password: '',
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsPending(true);

    if (data.email === 'SuperAdmin') {
        const res = await verifyAdminPassword(data.password);
        if (res.success) {
            onSuperAdminLogin();
            toast({
                title: 'Inicio de Sesión Exitoso',
                description: 'Bienvenido, Super Administrador.',
            });
            setIsPending(false);
            return;
        }
    }
    
    toast({
        title: 'Credenciales Incorrectas',
        description: 'Usuario o contraseña no válidos.',
        variant: 'destructive',
    });
    setIsPending(false);
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] bg-background/50">
      <Card className="w-full max-w-[450px] shadow-2xl border-none p-4 md:p-8">
        <CardHeader className="text-center space-y-4 mb-4">
          <CardTitle className="text-3xl font-bold font-headline tracking-tight">
            Módulo de Administración
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Este módulo es de acceso restringido. Ingresa tus credenciales.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="sr-only">Usuario</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="SuperAdmin"
                        {...field}
                        autoComplete="username"
                        className="h-12 text-lg rounded-xl border-border/60 bg-muted/20"
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
                    <FormLabel className="sr-only">Contraseña</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Contraseña"
                          {...field}
                          autoComplete="current-password"
                          className="h-12 text-lg pr-12 rounded-xl border-border/60 bg-muted/20"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute inset-y-0 right-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Eye className="h-5 w-5 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="pt-2">
              <Button 
                type="submit" 
                disabled={isPending || !form.watch('password')} 
                className="w-full h-14 text-xl font-bold rounded-xl transition-all hover:scale-[1.01] active:scale-95 bg-primary hover:bg-primary/90"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-6 w-6" />
                )}
                {isPending ? 'Verificando...' : 'Acceder'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
