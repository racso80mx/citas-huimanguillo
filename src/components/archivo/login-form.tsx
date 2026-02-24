'use client';
import { useState } from 'react';
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
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';

type LoginFormProps = {
    correctPassword?: string;
    onLoginSuccess: () => void;
}

export function ArchiveLoginForm({ correctPassword, onLoginSuccess }: LoginFormProps) {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    setIsPending(true);
    if (password === correctPassword) {
        onLoginSuccess();
        toast({ title: 'Acceso Concedido' });
    } else {
        toast({
            title: 'Acceso Denegado',
            description: 'La contraseña es incorrecta.',
            variant: 'destructive',
        });
    }
    setIsPending(false);
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md shadow-2xl">
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
            Módulo de Archivo
          </CardTitle>
          <CardDescription>
            Este módulo es de acceso restringido. Ingresa la contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
               <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 right-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
            </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleLogin} disabled={isPending} className="w-full">
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            {isPending ? 'Verificando...' : 'Acceder'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
