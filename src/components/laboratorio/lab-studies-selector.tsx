'use client';
import React, { useState, useMemo } from 'react';
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
import { Input } from '../ui/input';
import { Search, X, FlaskConical } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');

  // Filter studies based on search term
  const filteredStudies = useMemo(() => {
    if (!searchTerm.trim()) return allStudies;
    const term = searchTerm.toLowerCase();
    return allStudies.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.section.toLowerCase().includes(term)
    );
  }, [allStudies, searchTerm]);

  // Group filtered studies by section
  const groupedStudies = useMemo(() => {
    return filteredStudies.reduce((acc, study) => {
      if (study.available) {
        (acc[study.section] = acc[study.section] || []).push(study);
      }
      return acc;
    }, {} as Record<string, LabStudy[]>);
  }, [filteredStudies]);

  const handleStudyToggle = (study: LabStudy) => {
    const isSelected = selectedStudies.some((s) => s.id === study.id);
    if (isSelected) {
      onSelectionChange(selectedStudies.filter((s) => s.id !== study.id));
    } else {
      onSelectionChange([...selectedStudies, study]);
    }
  };

  const removeStudy = (id: string) => {
    onSelectionChange(selectedStudies.filter((s) => s.id !== id));
  };

  const selectedCount = selectedStudies.length;

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold font-headline">Catálogo de Estudios</CardTitle>
        <CardDescription>
          Busca y selecciona los estudios que necesitas. Has seleccionado{' '}
          <span className="font-bold text-primary">{selectedCount}</span>{' '}
          estudio(s).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar estudio (ej. Glucosa, Sangre...)"
            className="pl-9 h-11"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Selected Studies Area */}
        {selectedStudies.length > 0 && (
          <div className="bg-muted/30 p-3 rounded-lg border border-dashed">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Estudios Seleccionados:</p>
            <div className="flex flex-wrap gap-2">
              {selectedStudies.map((study) => (
                <Badge 
                  key={study.id} 
                  variant="secondary" 
                  className="pl-2 pr-1 py-1 flex items-center gap-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                >
                  <span className="text-xs">{study.name}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStudy(study.id);
                    }}
                    className="rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Catalog Accordion */}
        <ScrollArea className="h-[400px] w-full pr-4 border rounded-md p-2">
          {Object.keys(groupedStudies).length > 0 ? (
            <Accordion type="multiple" className="w-full">
              {Object.entries(groupedStudies).map(([section, studies]) => (
                <AccordionItem value={section} key={section} className="border-b last:border-0">
                  <AccordionTrigger className="hover:no-underline py-3 px-2">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-primary/60" />
                      <span className="text-sm font-semibold">{section}</span>
                      <Badge variant="outline" className="ml-auto text-[10px] h-5">
                        {studies.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-4 px-2">
                    <div className="space-y-3">
                      {studies.map((study) => (
                        <div
                          key={study.id}
                          className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors group"
                          onClick={() => handleStudyToggle(study)}
                        >
                          <Checkbox
                            id={`check-${study.id}`}
                            checked={selectedStudies.some(
                              (s) => s.id === study.id
                            )}
                            onCheckedChange={() => handleStudyToggle(study)}
                            className="mt-1"
                          />
                          <div className="grid gap-1 flex-1">
                            <label
                              htmlFor={`check-${study.id}`}
                              className="text-sm font-medium leading-none cursor-pointer group-hover:text-primary transition-colors"
                            >
                              {study.name}
                            </label>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                              <p className="text-[11px] text-muted-foreground">
                                <strong className="text-foreground/70">Muestra:</strong> {study.sampleType}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                <strong className="text-foreground/70">Ayuno:</strong> {study.fastingHours}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Search className="h-10 w-10 opacity-20 mb-2" />
              <p className="text-sm italic">No se encontraron estudios que coincidan.</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
