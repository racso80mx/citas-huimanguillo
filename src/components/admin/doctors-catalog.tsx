'use client';

import { useState, useEffect, useMemo } from 'react';
import { getClinics } from '@/lib/actions';
import type { Clinic } from '@/lib/definitions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Loader2, 
  Download, 
  UserRound, 
  Hospital, 
  ShieldCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export function DoctorsCatalog() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Clinic; direction: 'asc' | 'desc' } | null>({ key: 'doctorName', direction: 'asc' });

  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getClinics();
      // Filtrar clínicas que tengan nombre de doctor asignado
      setClinics(data.filter(c => c.doctorName && c.doctorName.trim() !== ''));
    } catch (e) {
      toast({ title: 'Error al cargar médicos', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSort = (key: keyof Clinic) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Clinic) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const filteredDoctors = useMemo(() => {
    let results = [...clinics];

    if (searchTerm) {
      const term = searchTerm.toUpperCase();
      results = results.filter(c => 
        c.doctorName.toUpperCase().includes(term) || 
        (c.professionalLicense && c.professionalLicense.includes(term)) ||
        c.name.toUpperCase().includes(term)
      );
    }

    if (sortConfig) {
      results.sort((a, b) => {
        const valA = String((a as any)[sortConfig.key] || '').toUpperCase();
        const valB = String((b as any)[sortConfig.key] || '').toUpperCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return results;
  }, [clinics, searchTerm, sortConfig]);

  const handleDownloadExcel = async () => {
    if (filteredDoctors.length === 0) return;
    const xlsx = await import('xlsx');
    const data = filteredDoctors.map(d => ({
        'Médico': d.doctorName,
        'Cédula Profesional': d.professionalLicense || 'S/C',
        'Unidad de Adscripción': d.name,
        'Servicio': d.clinicType
    }));
    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Directorio Médico');
    xlsx.writeFile(wb, 'directorio_medicos_adscripcion.xlsx');
  };

  return (
    <Card className="shadow-lg border-primary/10">
      <CardHeader className="bg-muted/10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-2xl font-bold font-headline flex items-center gap-2">
              <UserRound className="h-6 w-6 text-primary" /> Catálogo de Médicos de Adscripción
            </CardTitle>
            <CardDescription>
              Directorio oficial de profesionales de la salud por unidad médica.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={filteredDoctors.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Exportar Excel
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
        <div className="relative mt-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre del médico, cédula o núcleo..." 
            className="pl-9 h-11"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground tracking-widest">CONSULTANDO DIRECTORIO...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('doctorName')}>
                    <div className="flex items-center">Médico {getSortIcon('doctorName')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('professionalLicense')}>
                    <div className="flex items-center">Cédula de Adscripción {getSortIcon('professionalLicense')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Unidad Médica {getSortIcon('name')}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted" onClick={() => handleSort('clinicType')}>
                    <div className="flex items-center">Servicio {getSortIcon('clinicType')}</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDoctors.length > 0 ? filteredDoctors.map((doc) => (
                  <TableRow key={doc.id} className="hover:bg-muted/30 group">
                    <TableCell>
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/5 p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                                <UserRound className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-bold text-sm uppercase">{doc.doctorName}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-green-600" />
                            <code className="bg-muted px-2 py-0.5 rounded font-mono text-xs font-bold">
                                {doc.professionalLicense || 'EN TRÁMITE'}
                            </code>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2 text-xs font-medium">
                            <Hospital className="h-3.5 w-3.5 text-muted-foreground" />
                            {doc.name}
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter bg-background">
                            {doc.clinicType}
                        </Badge>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">
                        No se encontraron médicos que coincidan con la búsqueda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
