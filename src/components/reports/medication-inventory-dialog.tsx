'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Search, 
  Loader2, 
  ArrowUp, 
  ArrowDown, 
  Pill 
} from 'lucide-react';
import { getMedications } from '@/lib/actions';
import type { Medication } from '@/lib/definitions';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { differenceInMonths, parse, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

type MedicationInventoryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

type ExpirationStatus = 'red' | 'yellow' | 'green' | 'unknown';

export function MedicationInventoryDialog({ isOpen, onClose }: MedicationInventoryDialogProps) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Medication; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const data = await getMedications();
          setMedications(data);
        } catch (e) {
          console.error("Failed to fetch inventory", e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  const getExpirationStatus = (dateStr: string): ExpirationStatus => {
    if (!dateStr) return 'unknown';
    
    let expiryDate: Date;
    if (dateStr.includes('/')) {
        expiryDate = parse(dateStr, 'dd/MM/yyyy', new Date());
    } else {
        expiryDate = new Date(dateStr);
    }

    if (!isValid(expiryDate)) return 'unknown';

    const monthsUntilExpiry = differenceInMonths(expiryDate, new Date());

    if (monthsUntilExpiry < 6) return 'red';
    if (monthsUntilExpiry >= 6 && monthsUntilExpiry < 12) return 'yellow';
    return 'green';
  };

  const handleSort = (key: keyof Medication) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...medications];

    if (searchTerm) {
      const term = searchTerm.toUpperCase();
      result = result.filter(m => m.descripcion.includes(term));
    }

    if (sortConfig) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA === valB) return 0;
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        return sortConfig.direction === 'asc' 
          ? (valA < valB ? -1 : 1) 
          : (valA > valB ? -1 : 1);
      });
    }

    return result;
  }, [medications, searchTerm, sortConfig]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Pill className="h-6 w-6 text-primary" /> Inventario de Medicamentos
          </DialogTitle>
          <DialogDescription>
            Consulta existencias y semáforo de caducidades en tiempo real.
          </DialogDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar medicamento por descripción..." 
              className="pl-9 h-11"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden px-6 pb-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground font-medium">Consultando farmacia...</p>
            </div>
          ) : (
            <div className="border rounded-lg h-full flex flex-col">
              <ScrollArea className="flex-1">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead onClick={() => handleSort('descripcion')} className="cursor-pointer hover:bg-accent">
                        Descripción {sortConfig?.key === 'descripcion' && (sortConfig.direction === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
                      </TableHead>
                      <TableHead onClick={() => handleSort('existencia')} className="cursor-pointer hover:bg-accent text-center w-[120px]">
                        Existencia {sortConfig?.key === 'existencia' && (sortConfig.direction === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
                      </TableHead>
                      <TableHead onClick={() => handleSort('fechaCaducidad')} className="cursor-pointer hover:bg-accent w-[150px]">
                        Caducidad {sortConfig?.key === 'fechaCaducidad' && (sortConfig.direction === 'asc' ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />)}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSorted.length > 0 ? (
                      filteredAndSorted.map((med) => {
                        const expiryStatus = getExpirationStatus(med.fechaCaducidad);
                        return (
                          <TableRow key={med.id}>
                            <TableCell className="font-medium text-xs py-2">{med.descripcion}</TableCell>
                            <TableCell className="text-center py-2">
                              <Badge variant={med.existencia > 0 ? 'secondary' : 'destructive'} className={cn(med.existencia > 5 ? 'bg-green-100 text-green-800' : '', "font-bold")}>
                                {med.existencia}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2">
                               <Badge 
                                    variant="outline"
                                    className={cn(
                                        "font-bold text-[10px] px-2 py-0",
                                        expiryStatus === 'red' && "bg-red-100 text-red-700 border-red-200",
                                        expiryStatus === 'yellow' && "bg-yellow-100 text-yellow-700 border-yellow-200",
                                        expiryStatus === 'green' && "bg-green-100 text-green-700 border-green-200",
                                        expiryStatus === 'unknown' && "bg-gray-100 text-gray-600"
                                    )}
                                >
                                {med.fechaCaducidad || 'N/A'}
                                </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-20 text-muted-foreground">
                          {searchTerm ? 'No se encontraron medicamentos.' : 'Sin registros.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
