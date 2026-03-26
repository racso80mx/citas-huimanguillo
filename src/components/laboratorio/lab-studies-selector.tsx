'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import { Search, X, FlaskConical, Command, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Filter studies based on search term (name or code)
  const filteredResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return allStudies.filter(
      (s) =>
        s.available && (
          s.name.toLowerCase().includes(term) ||
          (s.code && s.code.toLowerCase().includes(term)) ||
          s.section.toLowerCase().includes(term)
        )
    ).slice(0, 8); // Limit to 8 results for the quick grid
  }, [allStudies, searchTerm]);

  // Reset selection index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredResults]);

  // Handle clicks outside the search area to close results
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStudyToggle = (study: LabStudy) => {
    const isAlreadySelected = selectedStudies.some((s) => s.id === study.id);
    if (isAlreadySelected) {
      onSelectionChange(selectedStudies.filter((s) => s.id !== study.id));
    } else {
      onSelectionChange([...selectedStudies, study]);
      toast({ 
        title: 'Estudio agregado', 
        description: `${study.code ? `[${study.code}] ` : ''}${study.name}`,
        duration: 2000
      });
    }
    // Clear search after adding if it was via quick search
    if (isSearchFocused) {
        setSearchTerm('');
        setIsSearchFocused(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!filteredResults.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % filteredResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleStudyToggle(filteredResults[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
    }
  };

  const removeStudy = (id: string) => {
    onSelectionChange(selectedStudies.filter((s) => s.id !== id));
  };

  // Group all studies by section for the catalog view below
  const groupedCatalog = useMemo(() => {
    return allStudies.reduce((acc, study) => {
      if (study.available) {
        (acc[study.section] = acc[study.section] || []).push(study);
      }
      return acc;
    }, {} as Record<string, LabStudy[]>);
  }, [allStudies]);

  const selectedCount = selectedStudies.length;

  return (
    <Card className="shadow-md border-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold font-headline flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Catálogo de Estudios
        </CardTitle>
        <CardDescription>
          Busca por nombre o código. Has seleccionado{' '}
          <span className="font-bold text-primary">{selectedCount}</span>{' '}
          estudio(s).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Unified Intelligent Search */}
        <div className="relative" ref={searchRef}>
          <div className="relative">
            <Search className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors",
                isSearchFocused ? "text-primary" : "text-muted-foreground"
            )} />
            <Input
              ref={inputRef}
              placeholder="Buscar estudio o código (ej: EGO, Glucosa...)"
              className="pl-10 h-12 text-lg border-primary/20 shadow-sm focus-visible:ring-primary focus-visible:border-primary"
              value={searchTerm}
              onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsSearchFocused(true);
              }}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={handleKeyDown}
            />
            {searchTerm && (
                <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                    <X className="h-5 w-5" />
                </button>
            )}
          </div>

          {/* Quick Results Grid */}
          {isSearchFocused && filteredResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-2 bg-muted/50 border-b flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Resultados de búsqueda</span>
                <span className="flex items-center gap-1"><Command className="h-3 w-3" /> ENTER para agregar</span>
              </div>
              <div className="max-h-[350px] overflow-y-auto">
                {filteredResults.map((study, index) => {
                  const isSelected = selectedStudies.some(s => s.id === study.id);
                  return (
                    <div
                      key={study.id}
                      className={cn(
                        "flex items-center justify-between p-3 cursor-pointer transition-colors border-b last:border-0",
                        index === selectedIndex ? "bg-primary/10" : "hover:bg-accent",
                        isSelected && "opacity-60"
                      )}
                      onClick={() => handleStudyToggle(study)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          {study.code && (
                            <Badge variant="outline" className="font-mono text-[10px] py-0 bg-background">
                              {study.code}
                            </Badge>
                          )}
                          <span className="font-bold text-sm">{study.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium uppercase">{study.section}</span>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <div className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded border",
                            index === selectedIndex ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"
                        )}>
                            SELECCIONAR
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Selected Studies Area */}
        {selectedStudies.length > 0 && (
          <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 shadow-inner">
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black uppercase text-primary tracking-widest">
                Estudios Seleccionados ({selectedCount}):
                </p>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-[10px] hover:text-destructive"
                    onClick={() => onSelectionChange([])}
                >
                    Limpiar todo
                </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedStudies.map((study) => (
                <Badge 
                  key={study.id} 
                  variant="secondary" 
                  className="pl-3 pr-1.5 py-1.5 flex items-center gap-2 bg-background border-primary/20 text-foreground shadow-sm hover:shadow-md transition-all group"
                >
                  <span className="text-xs font-bold">
                    {study.code ? <span className="text-primary mr-1">[{study.code}]</span> : ''}
                    {study.name}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStudy(study.id);
                    }}
                    className="rounded-full hover:bg-destructive hover:text-destructive-foreground p-0.5 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Catalog Accordion (Standard view for exploration) */}
        <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Explorar Catálogo</h4>
            <ScrollArea className="h-[350px] w-full pr-4 border rounded-xl bg-card p-2">
            {Object.keys(groupedCatalog).length > 0 ? (
                <Accordion type="multiple" className="w-full">
                {Object.entries(groupedCatalog).map(([section, studies]) => (
                    <AccordionItem value={section} key={section} className="border-b last:border-0">
                    <AccordionTrigger className="hover:no-underline py-3 px-2">
                        <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-primary/60" />
                        <span className="text-sm font-semibold">{section}</span>
                        <Badge variant="outline" className="ml-auto text-[10px] h-5 px-1.5 bg-muted/50">
                            {studies.length}
                        </Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-4 px-2">
                        <div className="space-y-2">
                        {studies.map((study) => {
                            const isChecked = selectedStudies.some((s) => s.id === study.id);
                            return (
                                <div
                                key={study.id}
                                className={cn(
                                    "flex items-start gap-3 p-2.5 rounded-lg border border-transparent transition-all cursor-pointer group",
                                    isChecked ? "bg-primary/5 border-primary/10 shadow-sm" : "hover:bg-accent/50"
                                )}
                                onClick={() => handleStudyToggle(study)}
                                >
                                <Checkbox
                                    id={`cat-check-${study.id}`}
                                    checked={isChecked}
                                    onCheckedChange={() => handleStudyToggle(study)}
                                    className="mt-1"
                                />
                                <div className="grid gap-1 flex-1">
                                    <label
                                    htmlFor={`cat-check-${study.id}`}
                                    className={cn(
                                        "text-sm font-bold leading-none cursor-pointer transition-colors",
                                        isChecked ? "text-primary" : "group-hover:text-primary"
                                    )}
                                    >
                                    {study.code && <span className="font-mono text-[11px] text-primary/70 mr-2">[{study.code}]</span>}
                                    {study.name}
                                    </label>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 opacity-70">
                                    <p className="text-[10px] font-medium">
                                        Muestra: {study.sampleType}
                                    </p>
                                    <p className="text-[10px] font-medium">
                                        Ayuno: {study.fastingHours}
                                    </p>
                                    </div>
                                </div>
                                </div>
                            );
                        })}
                        </div>
                    </AccordionContent>
                    </AccordionItem>
                ))}
                </Accordion>
            ) : (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Search className="h-10 w-10 opacity-20 mb-2" />
                <p className="text-sm italic">No hay estudios disponibles.</p>
                </div>
            )}
            </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
