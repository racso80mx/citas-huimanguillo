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
import { verifyArchivePassword } from '@/lib/actions';

type LoginFormProps = {
    onLoginSuccess: () => void;
}

export function ArchiveLoginForm({ onLoginSuccess }: LoginFormProps) {
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setIsVerifying(true);
    const result = await verifyArchivePassword(password);
    if (result.success) {
        onLoginSuccess();
        toast({ title: 'Acceso Concedido' });
    } else {
        toast({
            title: 'Acceso Denegado',
            description: result.message || 'La contraseña es incorrecta.',
            variant: 'destructive',
        });
    }
    setIsVerifying(false);
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] bg-background/50">
      <Card className="w-full max-w-[450px] shadow-2xl border-none p-4 md:p-8">
        <CardHeader className="text-center space-y-4 mb-4">
          <CardTitle className="text-3xl font-bold font-headline tracking-tight">
            Módulo de Archivo
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Este módulo es de acceso restringido. Ingresa la contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="h-12 text-lg pr-12 rounded-xl border-border/60 bg-muted/20"
              />
               <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 right-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                >
                    {showPassword ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
                </Button>
            </div>
        </CardContent>
        <CardFooter className="pt-2">
          <Button 
            onClick={handleLogin} 
            disabled={isVerifying || !password} 
            className="w-full h-14 text-xl font-bold rounded-xl transition-all hover:scale-[1.01] active:scale-95 bg-primary hover:bg-primary/90"
          >
            {isVerifying ? (
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-6 w-6" />
            )}
            {isVerifying ? 'Verificando...' : 'Acceder'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
