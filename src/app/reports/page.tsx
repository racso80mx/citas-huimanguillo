'use client';
import { useState, useEffect, useMemo } from 'react';
import type { Clinic } from '@/lib/definitions';
import { ClinicType } from '@/lib/definitions';
import { verifyClinicPassword, verifyXRayPassword, verifyUltrasoundPassword, verifyLabPassword, verifyVaccinePassword, getClinics } from '@/lib/actions';
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

type ReportType = 'clinic' | 'x-ray' | 'ultrasound' | 'laboratorio' | 'vacunas';

export default function ReportsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('clinic');
  const [selectedClinicType, setSelectedClinicType] = useState<ClinicType | 'all'>('all');
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedEntity, setAuthenticatedEntity] = useState<any>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const clinicsData = await getClinics();
        const sortedClinics = clinicsData.sort((a, b) => a.name.localeCompare(b.name));
        setClinics(sortedClinics);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos de configuración.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [toast]);

  const filteredClinics = useMemo(() => {
    if (selectedClinicType === 'all') return clinics;
    return clinics.filter(c => c.clinicType === selectedClinicType);
  }, [clinics, selectedClinicType]);

  const handleLogin = async () => {
    setIsVerifying(true);
    let result;
    let entityToAuth;

    if (selectedReportType === 'clinic') {
        if (!selectedClinic || !password) {
          toast({ title: 'Error', description: 'Selecciona un núcleo e ingresa la contraseña.' });
          setIsVerifying(false);
          return;
        }
        result = await verifyClinicPassword(selectedClinic.id, password);
        entityToAuth = selectedClinic;
    } else if (selectedReportType === 'x-ray') {
        result = await verifyXRayPassword(password);
        entityToAuth = { id: 'rayos-x', name: 'Rayos X', doctorName: 'Responsable de Rayos X' };
    } else if (selectedReportType === 'ultrasound') {
        result = await verifyUltrasoundPassword(password);
        entityToAuth = { id: 'ultrasonidos', name: 'Ultrasonidos', doctorName: 'Responsable de Ultrasonidos' };
    } else if (selectedReportType === 'laboratorio') {
        result = await verifyLabPassword(password);
        entityToAuth = { id: 'laboratorio', name: 'Laboratorio', doctorName: 'Responsable de Laboratorio' };
    } else if (selectedReportType === 'vacunas') {
        result = await verifyVaccinePassword(password);
        entityToAuth = { id: 'vacunas', name: 'Vacunación', doctorName: 'Responsable de Vacunación' };
    }

    if (result?.success && entityToAuth) {
      setIsAuthenticated(true);
      setAuthenticatedEntity(entityToAuth);
      toast({ title: 'Acceso Concedido', description: `Bienvenido al panel de ${entityToAuth.name}`});
    } else {
      toast({ title: 'Acceso Denegado', description: result?.message || 'La contraseña es incorrecta.', variant: 'destructive' });
    }
    setIsVerifying(false);
  };
  
  const handleLogout = () => {
      setIsAuthenticated(false);
      setAuthenticatedEntity(null);
      setSelectedClinic(null);
      setSelectedClinicType('all');
      setPassword('');
  }

  const handleReportTypeChange = (type: ReportType) => {
    setSelectedReportType(type);
    setSelectedClinic(null);
    setSelectedClinicType('all');
    setPassword('');
  };

  const handleClinicTypeChange = (type: ClinicType | 'all') => {
    setSelectedClinicType(type);
    setSelectedClinic(null);
    setPassword('');
  };
  
  const handleClinicSelect = (clinicId: string) => {
    const clinic = clinics.find(c => c.id === clinicId);
    setSelectedClinic(clinic || null);
    setPassword('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className='ml-2'>Cargando...</p>
      </div>
    );
  }

  if (isAuthenticated && authenticatedEntity) {
    return <ReportsDashboard entity={authenticatedEntity} onLogout={handleLogout} reportType={selectedReportType} />;
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
                Selecciona el tipo de reporte e ingresa la contraseña.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="report-type">Tipo de Reporte</Label>
                 <Select onValueChange={(value: ReportType) => handleReportTypeChange(value)} value={selectedReportType}>
                    <SelectTrigger id="report-type" className="w-full h-11">
                        <SelectValue placeholder="Selecciona un tipo de reporte..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="clinic">Núcleos Básicos</SelectItem>
                        <SelectItem value="laboratorio">Laboratorio</SelectItem>
                        <SelectItem value="x-ray">Rayos X</SelectItem>
                        <SelectItem value="ultrasound">Ultrasonidos</SelectItem>
                        <SelectItem value="vacunas">Vacunas</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {selectedReportType === 'clinic' && (
                <>
                    <div className="space-y-2">
                        <Label htmlFor="clinic-type">Tipo de Núcleo</Label>
                        <Select onValueChange={(value: ClinicType | 'all') => handleClinicTypeChange(value)} value={selectedClinicType}>
                            <SelectTrigger id="clinic-type" className="w-full h-11">
                                <SelectValue placeholder="Filtrar por especialidad..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Tipos</SelectItem>
                                {Object.values(ClinicType).map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="clinic">Núcleo Básico</Label>
                        <Select onValueChange={handleClinicSelect} value={selectedClinic?.id}>
                            <SelectTrigger id="clinic" className="w-full h-11 border-primary/40">
                                <SelectValue placeholder="Selecciona un núcleo..." />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredClinics.length > 0 ? (
                                    filteredClinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                                ) : (
                                    <div className="p-4 text-center text-sm text-muted-foreground">No hay núcleos de este tipo.</div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </>
            )}
           
            <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                    <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={`Contraseña para reportes`}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        disabled={selectedReportType === 'clinic' && !selectedClinic}
                        className="h-11 bg-muted/20"
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
        </CardContent>
        <CardFooter>
            <Button onClick={handleLogin} disabled={isVerifying || !password || (selectedReportType === 'clinic' && !selectedClinic)} className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90">
               {isVerifying ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-5 w-5" />
                )}
                {isVerifying ? 'Verificando...' : 'Ingresar'}
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
