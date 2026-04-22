'use client';
import { useState, useEffect, useMemo } from 'react';
import { ArchiveDashboard } from '@/components/archivo/archive-dashboard';
import { ModuleLoginForm } from '@/components/shared/module-login-form';
import { getModuleSettings, getMedications } from '@/lib/actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Users, Search, Package, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { Medication } from '@/lib/definitions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { differenceInMonths, parse, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

export default function PageContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleVerify = async (password: string) => {
    const settings = await getModuleSettings();
    const success = settings.archivoConsultaPassword === password;
    return { 
        success, 
        message: !success ? 'La contraseña de consulta es incorrecta.' : undefined 
    };
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 md:py-12">
        <ModuleLoginForm
          title="Consulta de Recursos"
          description="Acceso de solo lectura al archivo de pacientes e inventario de farmacia. Ingresa la contraseña autorizada."
          onVerify={handleVerify}
          onSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <Search className="h-8 w-8 text-primary" />
             <div>
                <h1 className="text-3xl font-bold font-headline">Consulta de Recursos</h1>
                <p className="text-muted-foreground">Padrón de pacientes e inventario de medicamentos (Solo Lectura).</p>
             </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>Salir</Button>
        </div>

        <Tabs defaultValue="pacientes" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="pacientes" className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Pacientes
            </TabsTrigger>
            <TabsTrigger value="farmacia" className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Inventario Farmacia
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pacientes" className="mt-6">
            <ArchiveDashboard onLogout={handleLogout} isReadOnly={true} />
          </TabsContent>
          
          <TabsContent value="farmacia" className="mt-6">
            <div className="space-y-6">
                <div className="p-4 bg-muted/30 rounded-lg border border-dashed text-center">
                    <p className="text-sm text-muted-foreground">
                        Esta sección muestra el inventario actualizado cargado por el área de Farmacia. 
                        Los datos son informativos para la planeación de recursos.
                    </p>
                </div>
                <ReadOnlyInventory />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ReadOnlyInventory() {
    const [medications, setMedications] = useState<Medication[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Medication; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        getMedications().then(data => {
            setMedications(data);
            setLoading(false);
        });
    }, []);

    const handleSort = (key: keyof Medication) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: keyof Medication) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
        }
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const filteredAndSorted = useMemo(() => {
        let result = medications.filter(m => 
            m.descripcion.toUpperCase().includes(search.toUpperCase()) || 
            m.claveCuadroBasico.toUpperCase().includes(search.toUpperCase())
        );

        if (sortConfig) {
            result.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];

                if (valA === valB) return 0;
                if (valA === undefined || valA === null) return 1;
                if (valB === undefined || valB === null) return -1;

                if (sortConfig.direction === 'asc') {
                    return valA < valB ? -1 : 1;
                } else {
                    return valA > valB ? -1 : 1;
                }
            });
        }

        return result;
    }, [medications, search, sortConfig]);

    const getStatus = (date: string) => {
        if (!date) return 'unknown';
        const d = date.includes('/') ? parse(date, 'dd/MM/yyyy', new Date()) : new Date(date);
        if (! d || !isValid(d)) return 'unknown';
        const diff = differenceInMonths(d, new Date());
        if (diff < 6) return 'red';
        if (diff < 12) return 'yellow';
        return 'green';
    };

    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Buscar medicamento por nombre o clave..." 
                    className="pl-9 h-11"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead 
                                className="cursor-pointer hover:bg-muted transition-colors"
                                onClick={() => handleSort('claveCuadroBasico')}
                            >
                                <div className="flex items-center">
                                    Clave {getSortIcon('claveCuadroBasico')}
                                </div>
                            </TableHead>
                            <TableHead 
                                className="cursor-pointer hover:bg-muted transition-colors"
                                onClick={() => handleSort('descripcion')}
                            >
                                <div className="flex items-center">
                                    Descripción {getSortIcon('descripcion')}
                                </div>
                            </TableHead>
                            <TableHead 
                                className="text-right cursor-pointer hover:bg-muted transition-colors"
                                onClick={() => handleSort('existencia')}
                            >
                                <div className="flex items-center justify-end">
                                    Existencia {getSortIcon('existencia')}
                                </div>
                            </TableHead>
                            <TableHead 
                                className="cursor-pointer hover:bg-muted transition-colors"
                                onClick={() => handleSort('fechaCaducidad')}
                            >
                                <div className="flex items-center">
                                    Caducidad {getSortIcon('fechaCaducidad')}
                                </div>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAndSorted.length > 0 ? filteredAndSorted.map(m => {
                            const status = getStatus(m.fechaCaducidad);
                            return (
                                <TableRow key={m.id}>
                                    <TableCell className="font-mono text-xs">{m.claveCuadroBasico}</TableCell>
                                    <TableCell className="text-xs font-medium uppercase">{m.descripcion}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant={m.existencia > 0 ? 'secondary' : 'destructive'} className={cn(m.existencia > 10 ? 'bg-green-100 text-green-800' : '')}>
                                            {m.existencia}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "text-[10px]",
                                            status === 'red' && "bg-red-100 text-red-700",
                                            status === 'yellow' && "bg-yellow-100 text-yellow-700",
                                            status === 'green' && "bg-green-100 text-green-700"
                                        )}>
                                            {m.fechaCaducidad || 'N/A'}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            )
                        }) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No hay registros coincidentes.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}