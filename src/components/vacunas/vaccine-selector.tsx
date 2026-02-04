'use client';
import React from 'react';
import type { Vaccine } from '@/lib/definitions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel
} from '@/components/ui/select';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '../ui/card';

type VaccineSelectorProps = {
  allVaccines: Vaccine[];
  onVaccineSelect: (vaccine: Vaccine) => void;
  selectedVaccine: Vaccine | undefined;
};

export function VaccineSelector({
  allVaccines,
  onVaccineSelect,
  selectedVaccine
}: VaccineSelectorProps) {
    const availableVaccines = allVaccines.filter(v => v.available);

    const handleSelect = (vaccineId: string) => {
        const vaccine = availableVaccines.find(v => v.id === vaccineId);
        if (vaccine) {
            onVaccineSelect(vaccine);
        }
    }

  return (
    <div>
        <Select onValueChange={handleSelect} value={selectedVaccine?.id}>
            <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona una vacuna..." />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Vacunas Disponibles</SelectLabel>
                    {availableVaccines.map(vaccine => (
                        <SelectItem key={vaccine.id} value={vaccine.id}>{vaccine.name}</SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
        {selectedVaccine && (
            <Card className="mt-4 bg-accent/30">
                <CardHeader>
                    <CardTitle className="text-lg">Información de la Vacuna</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                    <p><strong>Descripción:</strong> {selectedVaccine.description}</p>
                    <p><strong>Edad de Aplicación:</strong> {selectedVaccine.applicationAge}</p>
                    <p><strong>Sexo:</strong> {selectedVaccine.sex}</p>
                </CardContent>
            </Card>
        )}
    </div>
  );
}
