'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { getSlotsConfiguration, updateSlotsConfiguration } from '@/lib/actions';
import { Loader2, Save, Settings } from 'lucide-react';

export function SlotsManager() {
  const [slotsConfig, setSlotsConfig] = useState<{ [key: number]: number }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoading(true);
      const data = await getSlotsConfiguration();
      setSlotsConfig(data);
      setIsLoading(false);
    };
    fetchConfig();
  }, []);

  const handleSlotChange = (consultorio: number, value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) && value !== '') return;
    
    // Clamp the value between 0 and 15
    const clampedValue = isNaN(numValue) ? 0 : Math.max(0, Math.min(15, numValue));
    
    setSlotsConfig(prev => ({
        ...prev,
        [consultorio]: clampedValue,
    }));
  };
  
  const handleSave = () => {
    startSavingTransition(async () => {
      const result = await updateSlotsConfiguration(slotsConfig);
      if (result.success) {
        toast({
          title: 'Configuración Guardada',
          description: 'Los cupos por consultorio se han actualizado.',
          className: 'bg-accent text-accent-foreground',
        });
      } else {
        toast({
          title: 'Error',
          description: result.message || 'No se pudo guardar la configuración.',
          variant: 'destructive',
        });
      }
    });
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Configurar Cupos por Clínica</CardTitle>
          <CardDescription>
            Define el máximo de citas diarias para cada núcleo básico (máx. 15).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className='flex items-center gap-2'><Settings /> Configurar Cupos por Clínica</CardTitle>
        <CardDescription>
          Define el máximo de citas diarias para cada núcleo básico (máx. 15).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Object.keys(slotsConfig).sort((a,b) => parseInt(a) - parseInt(b)).map(key => {
            const consultorio = parseInt(key, 10);
            return (
                 <div key={consultorio} className="space-y-2">
                    <Label htmlFor={`slots-${consultorio}`}>Núcleo Básico {consultorio}</Label>
                    <Input
                        id={`slots-${consultorio}`}
                        type="number"
                        min="0"
                        max="15"
                        value={slotsConfig[consultorio] || ''}
                        onChange={(e) => handleSlotChange(consultorio, e.target.value)}
                        placeholder="0"
                    />
                </div>
            )
        })}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isSaving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </CardFooter>
    </Card>
  );
}
