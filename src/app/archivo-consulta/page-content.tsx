'use client';
import { useState, useEffect, useMemo } from 'react';
import { ArchiveDashboard } from '@/components/archivo/archive-dashboard';
import { ModuleLoginForm } from '@/components/shared/module-login-form';
import { getModuleSettings, getMedications, getSupplies } from '@/lib/actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Users, Search, Package, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Pill, AlertTriangle, CheckCircle2, CalendarClock, Filter } from 'lucide-react';
import type { Medication, Supply } from '@/lib/definitions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { differenceInMonths, parse, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
          description="Acceso de solo lectura al archivo de pacientes e inventario hospitalario. Ingresa la contraseña autorizada."
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
                <p className="text-muted-foreground">Padrón de pacientes e inventarios (Solo Lectura).</p>
             </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>Salir</Button>
        </div>

        <Tabs defaultValue="pacientes" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-xl">
            <TabsTrigger value="pacientes" className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Pacientes
            </TabsTrigger>
            <TabsTrigger value="farmacia" className="flex items-center gap-2">
              <Pill className="h-4 w-4" /> Farmacia
            </TabsTrigger>
            <TabsTrigger value="almacen" className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Almacén
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pacientes" className="mt-6">
            <ArchiveDashboard onLogout={handleLogout} isReadOnly={true} />
          </TabsContent>
          
          <TabsContent value="farmacia" className="mt-6">
            <ReadOnlyInventory type="pharmacy" />
          </TabsContent>

          <TabsContent value="almacen" className="mt-6">
            <ReadOnlyInventory type="warehouse" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ReadOnlyInventory({ type }: { type: 'pharmacy' | 'warehouse' }) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searchFields, setSearchFields] = useState<string[]>(['descripcion', 'claveCuadroBasico']);
    const [statusFilter, setStatusFilter] = useState<'red' | 'yellow' | 'green' | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        const fetchFn = type === 'pharmacy' ? getMedications : getSupplies;
        fetchFn().then(data => {
            setItems(data);
            setLoading(false);
        });
    }, [type]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
        }
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const getStatus = (date: string) => {
        if (!date) return 'unknown';
        let d: Date;
        if (date.includes('/')) {
            d = parse(date, 'dd/MM/yyyy', new Date());
        } else {
            d = new Date(date);
        }
        if (! d || !isValid(d)) return 'unknown';
        const diff = differenceInMonths(d, new Date());
        if (diff < 6) return 'red';
        if (diff < 12) return 'yellow';
        return 'green';
    };

    const stats = useMemo(() => {
        const counts = { red: 0, yellow: 0, green: 0, total: items.length };
        items.forEach(item => {
            const status = getStatus(item.fechaCaducidad);
            if (status === 'red') counts.red++;
            if (status === 'yellow') counts.yellow++;
            if (status === 'green') counts.green++;
        });
        return counts;
    }, [items]);

    const filteredAndSorted = useMemo(() => {
        let result = items.filter(m => {
            // Filter by status
            if (statusFilter) {
                const s = getStatus(m.fechaCaducidad);
                if (s !== statusFilter) return false;
            }

            // Filter by search
            if (search) {
                const term = search.toUpperCase();
                return searchFields.some(field => {
                    const val = String(m[field] || '').toUpperCase();
                    return val.includes(term);
                });
            }
            return true;
        });

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
    }, [items, search, searchFields, statusFilter, sortConfig]);

    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

    const toggleSearchField = (field: string) => {
        setSearchFields(prev => 
            prev.includes(field) 
                ? (prev.length > 1 ? prev.filter(f => f !== field) : prev) 
                : [...prev, field]
        );
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CalendarClock className="h-5 w-5 text-primary" /> Alertas de Caducidad
                    </CardTitle>
                    <CardDescription>Usa los botones para filtrar por estado de vencimiento.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <button 
                            onClick={() => setStatusFilter(statusFilter === 'red' ? null : 'red')}
                            className={cn(
                                "bg-red-50 border p-4 rounded-xl text-center transition-all",
                                statusFilter === 'red' ? "border-red-500 ring-2 ring-red-200 shadow-md scale-105" : "border-red-100 opacity-70 hover:opacity-100"
                            )}
                        >
                            <div className="text-[10px] text-red-600 uppercase font-black mb-1">Crítico (&lt; 6m)</div>
                            <div className="text-3xl font-black text-red-700">{stats.red}</div>
                            <div className="text-[10px] text-red-500 mt-1 flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3"/> Ver lista</div>
                        </button>
                        <button 
                            onClick={() => setStatusFilter(statusFilter === 'yellow' ? null : 'yellow')}
                            className={cn(
                                "bg-yellow-50 border p-4 rounded-xl text-center transition-all",
                                statusFilter === 'yellow' ? "border-yellow-500 ring-2 ring-yellow-200 shadow-md scale-105" : "border-yellow-100 opacity-70 hover:opacity-100"
                            )}
                        >
                            <div className="text-[10px] text-yellow-600 uppercase font-black mb-1">Preventivo (6m-1a)</div>
                            <div className="text-3xl font-black text-yellow-700">{stats.yellow}</div>
                            <div className="text-[10px] text-yellow-500 mt-1 flex items-center justify-center gap-1"><CalendarClock className="h-3 w-3"/> Ver lista</div>
                        </button>
                        <button 
                            onClick={() => setStatusFilter(statusFilter === 'green' ? null : 'green')}
                            className={cn(
                                "bg-green-50 border p-4 rounded-xl text-center transition-all",
                                statusFilter === 'green' ? "border-green-500 ring-2 ring-green-200 shadow-md scale-105" : "border-green-100 opacity-70 hover:opacity-100"
                            )}
                        >
                            <div className="text-[10px] text-green-600 uppercase font-black mb-1">Óptimo (&gt; 1a)</div>
                            <div className="text-3xl font-black text-green-700">{stats.green}</div>
                            <div className="text-[10px] text-green-500 mt-1 flex items-center justify-center gap-1"><CheckCircle2 className="h-3 w-3"/> Ver lista</div>
                        </button>
                        <button 
                            onClick={() => setStatusFilter(null)}
                            className={cn(
                                "bg-muted/30 border p-4 rounded-xl text-center transition-all",
                                !statusFilter ? "border-primary ring-2 ring-primary/10 shadow-md scale-105" : "border-transparent opacity-70 hover:opacity-100"
                            )}
                        >
                            <div className="text-[10px] text-muted-foreground uppercase font-black mb-1">Total Registros</div>
                            <div className="text-3xl font-black">{stats.total}</div>
                            <div className="text-[10px] text-muted-foreground mt-1">Ver todos</div>
                        </button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Escribe para buscar..." 
                        className="pl-9 h-11"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-11 gap-2 whitespace-nowrap">
                            <Filter className="h-4 w-4" /> 
                            Campos: {searchFields.length === 3 ? 'Todos' : searchFields.length}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Filtrar búsqueda por:</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem checked={searchFields.includes('claveCuadroBasico')} onCheckedChange={() => toggleSearchField('claveCuadroBasico')}>
                            Clave de Cuadro Básico
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={searchFields.includes('descripcion')} onCheckedChange={() => toggleSearchField('descripcion')}>
                            Descripción / Nombre
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={searchFields.includes('lote')} onCheckedChange={() => toggleSearchField('lote')}>
                            Lote
                        </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                {statusFilter && (
                    <Badge variant="secondary" className="h-11 px-4 gap-2 text-sm font-bold animate-in fade-in">
                        Filtro: {statusFilter === 'red' ? 'Crítico' : statusFilter === 'yellow' ? 'Preventivo' : 'Óptimo'}
                        <X className="h-4 w-4 cursor-pointer hover:text-destructive" onClick={() => setStatusFilter(null)} />
                    </Badge>
                )}
            </div>

            <div className="border rounded-lg overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead 
                                className="cursor-pointer hover:bg-muted transition-colors w-[150px]"
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
                                className="text-right cursor-pointer hover:bg-muted transition-colors w-[120px]"
                                onClick={() => handleSort('existencia')}
                            >
                                <div className="flex items-center justify-end">
                                    Existencia {getSortIcon('existencia')}
                                </div>
                            </TableHead>
                            <TableHead 
                                className="cursor-pointer hover:bg-muted transition-colors w-[140px]"
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
                                <TableRow key={m.id} className="hover:bg-muted/30">
                                    <TableCell className="font-mono text-xs font-bold">{m.claveCuadroBasico}</TableCell>
                                    <TableCell className="text-xs font-medium uppercase">{m.descripcion}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant={m.existencia > 0 ? 'secondary' : 'destructive'} className={cn(m.existencia > 10 ? 'bg-green-100 text-green-800' : '', "font-black")}>
                                            {m.existencia}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "text-[10px] font-bold px-2",
                                            status === 'red' && "bg-red-100 text-red-700 border-red-200",
                                            status === 'yellow' && "bg-yellow-100 text-yellow-700 border-yellow-200",
                                            status === 'green' && "bg-green-100 text-green-700 border-green-200"
                                        )}>
                                            {m.fechaCaducidad || 'N/A'}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            )
                        }) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                                    No hay registros coincidentes con los filtros aplicados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
