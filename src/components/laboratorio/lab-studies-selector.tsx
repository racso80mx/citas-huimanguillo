'use client';
import React from 'react';
import type { LabStudy } from '@/lib/definitions';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

type LabStudiesSelectorProps = {
  allStudies: LabStudy[];
  selectedStudies: LabStudy[];
  onSelectionChange: (studies: LabStudy[]) => void;
};

export function LabStudiesSelector({
  allStudies,
  selectedStudies,
  onSelectionChange,
}: LabStudiesSelectorProps) {
  const groupedStudies = allStudies.reduce((acc, study) => {
    if (study.available) {
        (acc[study.section] = acc[study.section] || []).push(study);
    }
    return acc;
  }, {} as Record<string, LabStudy[]>);

  const handleStudyToggle = (study: LabStudy) => {
    const isSelected = selectedStudies.some((s) => s.id === study.id);
    if (isSelected) {
      onSelectionChange(selectedStudies.filter((s) => s.id !== study.id));
    } else {
      onSelectionChange([...selectedStudies, study]);
    }
  };

  const selectedCount = selectedStudies.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Catálogo de Estudios</CardTitle>
        <CardDescription>
          Selecciona los estudios que necesitas. Has seleccionado{' '}
          <span className="font-bold text-primary">{selectedCount}</span>{' '}
          estudio(s).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72 w-full pr-4">
          <Accordion type="multiple" className="w-full">
            {Object.entries(groupedStudies).map(([section, studies]) => (
              <AccordionItem value={section} key={section}>
                <AccordionTrigger>{section}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {studies.map((study) => (
                      <div
                        key={study.id}
                        className="flex items-start gap-4 p-2 rounded-md hover:bg-accent/50 cursor-pointer"
                        onClick={() => handleStudyToggle(study)}
                      >
                        <Checkbox
                          id={study.id}
                          checked={selectedStudies.some(
                            (s) => s.id === study.id
                          )}
                          onCheckedChange={() => handleStudyToggle(study)}
                          className="mt-1"
                        />
                        <div className="grid gap-1.5 leading-none flex-1">
                          <label
                            htmlFor={study.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {study.name}
                          </label>
                          <p className="text-sm text-muted-foreground">
                            <strong>Muestra:</strong> {study.sampleType}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            <strong>Ayuno:</strong> {study.fastingHours}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
