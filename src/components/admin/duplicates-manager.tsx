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
import { Trash2, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deletePatients } from '@/lib/actions';

type DuplicatesData = {
    byExpediente: Patient[][];
    byCurp: Patient[][];
    byName: Patient[][];
};

type DuplicatesManagerProps = {
    initialDuplicates: DuplicatesData;
};

const DuplicateGroup = ({ group, onSelectionChange }: { group: Patient[], onSelectionChange: (id: string, isSelected: boolean) => void }) => {
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
                    <TableRow key={patient.id}>
                        <TableCell>
                            <Checkbox 
                                onCheckedChange={(checked) => onSelectionChange(patient.id, !!checked)}
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
    const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);
    const [isDeleting, startDeleteTransition] = useTransition();
    const { toast } = useToast();

    const handleSelectionChange = (id: string, isSelected: boolean) => {
        setSelectedPatientIds(prev => {
            if (isSelected) {
                return [...prev, id];
            } else {
                return prev.filter(patientId => patientId !== id);
            }
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
                // We don't have a way to easily refresh server data from here without a full page reload,
                // so we'll just clear selections and let the user see the result after a manual refresh.
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

    const renderDuplicateList = (groups: Patient[][], criteria: string) => {
        if (groups.length === 0) {
            return <p className="text-muted-foreground text-center py-8">No se encontraron duplicados por {criteria}.</p>;
        }

        return (
             <Accordion type="multiple" className="w-full space-y-4">
                {groups.map((group, index) => {
                    const key = group[0].expediente || group[0].curp || `${group[0].name}-${index}`;
                    return (
                        <AccordionItem value={key} key={key} className="border rounded-lg">
                            <AccordionTrigger className="p-4 bg-muted/50 hover:no-underline rounded-t-lg">
                                <div className="flex items-center gap-4">
                                     <Badge variant="destructive">{group.length} Registros</Badge>
                                     <span className="font-mono text-sm">{key}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-0">
                                <DuplicateGroup group={group} onSelectionChange={handleSelectionChange} />
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
            <div className="flex justify-end">
                <Button 
                    variant="destructive"
                    onClick={handleDeleteSelected}
                    disabled={isDeleting || selectedPatientIds.length === 0}
                >
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Eliminar {selectedPatientIds.length > 0 ? `${selectedPatientIds.length} Seleccionado(s)` : 'Seleccionados'}
                </Button>
            </div>
            <Tabs defaultValue="expediente">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="expediente">Por No. de Expediente ({initialDuplicates.byExpediente.length})</TabsTrigger>
                    <TabsTrigger value="curp">Por CURP ({initialDuplicates.byCurp.length})</TabsTrigger>
                    <TabsTrigger value="name">Por Nombre ({initialDuplicates.byName.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="expediente" className="mt-4">
                    {renderDuplicateList(initialDuplicates.byExpediente, 'No. de Expediente')}
                </TabsContent>
                <TabsContent value="curp" className="mt-4">
                    {renderDuplicateList(initialDuplicates.byCurp, 'CURP')}
                </TabsContent>
                <TabsContent value="name" className="mt-4">
                    {renderDuplicateList(initialDuplicates.byName, 'Nombre')}
                </TabsContent>
            </Tabs>
        </div>
    );
}
