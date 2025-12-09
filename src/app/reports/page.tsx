'use client';
import { useState, useEffect } from 'react';
import type { Clinic } from '@/lib/definitions';
import { getClinics } from '@/lib/data';
import { verifyClinicPassword } from '@/lib/actions';
import { ReportsDashboard } from '@/components/reports/reports-dashboard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { logoBase64 } from '@/lib/logo-data';

export default function ReportsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchClinics() {
      setIsLoading(true);
      try {
        const clinicsData = await getClinics();
        setClinics(clinicsData);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los núcleos básicos.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchClinics();
  }, [toast]);

  const handleLogin = async () => {
    if (!selectedClinic || !password) {
      toast({ title: 'Error', description: 'Selecciona un núcleo e ingresa la contraseña.' });
      return;
    }
    setIsVerifying(true);
    const result = await verifyClinicPassword(selectedClinic.id, password);
    if (result.success) {
      setIsAuthenticated(true);
      toast({ title: 'Acceso Concedido', description: `Bienvenido al panel de ${selectedClinic.name}`});
    } else {
      toast({ title: 'Acceso Denegado', description: result.message || 'La contraseña es incorrecta.', variant: 'destructive' });
    }
    setIsVerifying(false);
  };
  
  const handleLogout = () => {
      setIsAuthenticated(false);
      setSelectedClinic(null);
      setPassword('');
  }

  const handleClinicSelect = (clinicId: string) => {
    const clinic = clinics.find(c => c.id === clinicId);
    setSelectedClinic(clinic || null);
    setPassword(''); // Reset password on clinic change
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className='ml-2'>Cargando núcleos...</p>
      </div>
    );
  }

  if (isAuthenticated && selectedClinic) {
    return <ReportsDashboard clinic={selectedClinic} onLogout={handleLogout} />;
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 flex items-center justify-center min-h-[70vh]">
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
                Acceso a Reportes de Citas
            </CardTitle>
            <CardDescription>
                Selecciona tu núcleo básico e ingresa la contraseña.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="clinic">Núcleo Básico</Label>
                 <Select onValueChange={handleClinicSelect} value={selectedClinic?.id}>
                    <SelectTrigger id="clinic" className="w-full">
                        <SelectValue placeholder="Selecciona un núcleo..." />
                    </SelectTrigger>
                    <SelectContent>
                        {clinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
           {selectedClinic && (
             <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                    <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={`Contraseña para ${selectedClinic.name}`}
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
             </div>
           )}
        </CardContent>
        <CardFooter>
            <Button onClick={handleLogin} disabled={isVerifying || !selectedClinic || !password} className="w-full">
               {isVerifying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                {isVerifying ? 'Verificando...' : 'Ingresar'}
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
