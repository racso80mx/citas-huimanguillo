'use client';
import React, { useState, useTransition, useMemo } from 'react';
import type { Patient } from '@/lib/definitions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Trash2, Loader2, Info, ChevronsUpDown, CheckSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deletePatients } from '@/lib/actions';
import { cn } from '@/lib/utils';

type DuplicatesData = {
    byExpediente: Patient[][];
    byCurp: Patient[][];
    byName: Patient[][];
};

type DuplicatesManagerProps = {
    initialDuplicates: DuplicatesData;
};

const DuplicateGroup = ({ group, onSelectionChange, selectedIds }: { group: Patient[], onSelectionChange: (id: string, isSelected: boolean) => void, selectedIds: string[] }) => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[50px]">Sel.</TableHead>
                    <TableHead>Nombre Completo</TableHead>
                    <TableHead>No. Expediente</TableHead>
                    <TableHead>CURP</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Última Cita</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {group.map(patient => (
                    <TableRow key={patient.id} className={cn(selectedIds.includes(patient.id) && 'bg-muted/50')}>
                        <TableCell>
                            <Checkbox 
                                onCheckedChange={(checked) => onSelectionChange(patient.id, !!checked)}
                                checked={selectedIds.includes(patient.id)}
                            />
                        </TableCell>
                        <TableCell className="font-medium">{`${patient.name} ${patient.paternalLastName} ${patient.maternalLastName}`}</TableCell>
                        <TableCell>{patient.expediente || 'N/A'}</TableCell>
                        <TableCell>{patient.curp || 'N/A'}</TableCell>
                        <TableCell>{patient.phoneNumber || 'N/A'}</TableCell>
                        <TableCell>{patient.lastAppointmentDate ? new Date(patient.lastAppointmentDate).toLocaleDateString('es-MX') : 'Nunca'}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export function DuplicatesManager({ initialDuplicates }: DuplicatesManagerProps) {
    const [activeTab, setActiveTab] = useState('expediente');
    const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);
    const [expandedItems, setExpandedItems] = useState<string[]>([]);
    const [isDeleting, startDeleteTransition] = useTransition();
    const { toast } = useToast();
    
    const accordionKeys = useMemo(() => ({
        expediente: initialDuplicates.byExpediente.map((group, index) => `expediente-${group[0].expediente}-${index}`),
        curp: initialDuplicates.byCurp.map((group, index) => `curp-${group[0].curp}-${index}`),
        name: initialDuplicates.byName.map((group, index) => `name-${group[0].name}-${index}`),
    }), [initialDuplicates]);

    const handleSelectionChange = (id: string, isSelected: boolean) => {
        setSelectedPatientIds(prev => {
            const newSet = new Set(prev);
            if (isSelected) {
                newSet.add(id);
            } else {
                newSet.delete(id);
            }
            return Array.from(newSet);
        });
    };

    const handleDeleteSelected = () => {
        if (selectedPatientIds.length === 0) {
            toast({ title: "Nada seleccionado", description: "Por favor, selecciona los registros duplicados que deseas eliminar." });
            return;
        }

        startDeleteTransition(async () => {
            const result = await deletePatients(selectedPatientIds);
            if(result.success) {
                toast({
                    title: "Limpieza Completada",
                    description: result.message,
                    duration: 8000
                });
                setSelectedPatientIds([]);
            } else {
                toast({
                    title: "Error en la Eliminación",
                    description: result.message,
                    variant: "destructive"
                });
            }
        });
    };
    
    const toggleAllAccordions = () => {
        const currentKeys = accordionKeys[activeTab as keyof typeof accordionKeys];
        if (expandedItems.length === currentKeys.length) {
            setExpandedItems([]);
        } else {
            setExpandedItems(currentKeys);
        }
    };

    const handleSelectFirstInEachGroup = () => {
        const currentGroups = initialDuplicates[activeTab as keyof typeof initialDuplicates];
        const idsToSelect = currentGroups.map(group => group[0]?.id).filter(Boolean);
        
        setSelectedPatientIds(prev => Array.from(new Set([...prev, ...idsToSelect])));
        
        toast({
            title: "Selección Rápida",
            description: `Se han seleccionado los primeros registros de cada grupo.`
        });
    };

    const renderDuplicateList = (groups: Patient[][], criteria: 'expediente' | 'curp' | 'name') => {
        if (groups.length === 0) {
            return <p className="text-muted-foreground text-center py-8">No se encontraron duplicados por este criterio.</p>;
        }

        return (
             <Accordion type="multiple" className="w-full space-y-4" value={expandedItems} onValueChange={setExpandedItems}>
                {groups.map((group, index) => {
                    const identifier = group[0][criteria] || `${group[0].name} ${group[0].paternalLastName}`;
                    const key = `${criteria}-${identifier}-${index}`;
                    
                    return (
                        <AccordionItem value={key} key={key} className="border rounded-lg">
                            <AccordionTrigger className="p-4 bg-muted/50 hover:no-underline rounded-t-lg">
                                <div className="flex items-center gap-4">
                                     <Badge variant="destructive">{group.length} Registros</Badge>
                                     <span className="font-mono text-sm">{identifier}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-0">
                                <DuplicateGroup group={group} onSelectionChange={handleSelectionChange} selectedIds={selectedPatientIds} />
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>
        );
    }
    
    return (
        <div className="space-y-6">
             <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>¡Importante!</AlertTitle>
                <AlertDescription>
                    El sistema no permitirá eliminar pacientes que tengan citas registradas para preservar el historial. Si necesitas eliminar un paciente con citas, primero debes eliminar sus citas manualmente. Se recomienda conservar el registro con la información más completa o la fecha de última cita más reciente.
                </AlertDescription>
            </Alert>
            <div className="flex justify-end items-center gap-2">
                 <Button 
                    variant="outline"
                    onClick={toggleAllAccordions}
                >
                    <ChevronsUpDown className="mr-2 h-4 w-4" />
                    Desplegar/Cerrar Todos
                </Button>
                 <Button 
                    variant="outline"
                    onClick={handleSelectFirstInEachGroup}
                >
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Seleccionar Primeros
                </Button>
                <Button 
                    variant="destructive"
                    onClick={handleDeleteSelected}
                    disabled={isDeleting || selectedPatientIds.length === 0}
                >
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Eliminar {selectedPatientIds.length > 0 ? `${selectedPatientIds.length} Seleccionado(s)` : 'Seleccionados'}
                </Button>
            </div>
            <Tabs defaultValue="expediente" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="expediente">Por No. de Expediente ({initialDuplicates.byExpediente.length})</TabsTrigger>
                    <TabsTrigger value="curp">Por CURP ({initialDuplicates.byCurp.length})</TabsTrigger>
                    <TabsTrigger value="name">Por Nombre ({initialDuplicates.byName.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="expediente" className="mt-4">
                    {renderDuplicateList(initialDuplicates.byExpediente, 'expediente')}
                </TabsContent>
                <TabsContent value="curp" className="mt-4">
                    {renderDuplicateList(initialDuplicates.byCurp, 'curp')}
                </TabsContent>
                <TabsContent value="name" className="mt-4">
                    {renderDuplicateList(initialDuplicates.byName, 'name')}
                </TabsContent>
            </Tabs>
        </div>
    );
}
