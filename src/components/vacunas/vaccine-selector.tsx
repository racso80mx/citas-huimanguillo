'use client';
import React from 'react';
import type { Vaccine } from '@/lib/definitions';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

type VaccineSelectorProps = {
  allVaccines: Vaccine[];
  selectedVaccines: Vaccine[];
  onSelectionChange: (vaccines: Vaccine[]) => void;
};

export function VaccineSelector({
  allVaccines,
  selectedVaccines,
  onSelectionChange,
}: VaccineSelectorProps) {

  const handleVaccineToggle = (vaccine: Vaccine) => {
    const isSelected = selectedVaccines.some((v) => v.id === vaccine.id);
    if (isSelected) {
      onSelectionChange(selectedVaccines.filter((v) => v.id !== vaccine.id));
    } else {
      onSelectionChange([...selectedVaccines, vaccine]);
    }
  };
  
  const selectedCount = selectedVaccines.length;

  return (
    <Card>
       <CardHeader>
        <CardTitle>Catálogo de Vacunas</CardTitle>
        <CardDescription>
          Selecciona las vacunas que necesitas. Has seleccionado{' '}
          <span className="font-bold text-primary">{selectedCount}</span>{' '}
          vacuna(s).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72 w-full pr-4">
           <div className="space-y-4">
            {allVaccines.map((vaccine) => (
              <div
                key={vaccine.id}
                className="flex items-start gap-4 p-2 rounded-md hover:bg-accent/50 cursor-pointer"
                onClick={() => handleVaccineToggle(vaccine)}
              >
                <Checkbox
                  id={vaccine.id}
                  checked={selectedVaccines.some((v) => v.id === vaccine.id)}
                  onCheckedChange={() => handleVaccineToggle(vaccine)}
                  className="mt-1"
                />
                <div className="grid gap-1.5 leading-none flex-1">
                  <Label
                    htmlFor={vaccine.id}
                    className="font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {vaccine.name}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    <strong>Protege contra:</strong> {vaccine.description}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Edad:</strong> {vaccine.applicationAge}
                  </p>
                   <p className="text-sm text-muted-foreground">
                    <strong>Sexo:</strong> {vaccine.sex}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
