
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
import { useToast } from '@/hooks/use-toast';
import { updateAnnouncements, getAnnouncements } from '@/lib/actions';
import { Loader2, Trash2, PlusCircle, Megaphone, Save } from 'lucide-react';
import { Label } from '../ui/label';

export function AnnouncementsManager() {
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  const fetchAnnouncements = async () => {
      setIsLoading(true);
      try {
        const data = await getAnnouncements();
        setAnnouncements(data);
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleAnnouncementChange = (index: number, value: string) => {
    const newAnnouncements = [...announcements];
    newAnnouncements[index] = value.toUpperCase();
    setAnnouncements(newAnnouncements);
  };

  const addAnnouncement = () => {
    if (announcements.length < 4) {
      setAnnouncements([...announcements, '']);
    } else {
      toast({
        title: 'Límite alcanzado',
        description: 'Puedes agregar un máximo de 4 avisos importantes.',
        variant: 'destructive',
      });
    }
  };

  const removeAnnouncement = (index: number) => {
    const newAnnouncements = announcements.filter((_, i) => i !== index);
    setAnnouncements(newAnnouncements);
  };

  const handleSave = () => {
    startSavingTransition(async () => {
      const filteredAnnouncements = announcements.filter(
        (ann) => ann.trim() !== ''
      );
      const result = await updateAnnouncements(filteredAnnouncements);
      if (result.success) {
        toast({
          title: 'Avisos Publicados',
          description: 'Los avisos se verán reflejados en el portal de citas de inmediato.',
          className: 'bg-primary text-primary-foreground',
        });
        await fetchAnnouncements();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'No se pudieron guardar los avisos.',
          variant: 'destructive',
        });
      }
    });
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Avisos del Hospital</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-primary/10">
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-primary font-black uppercase text-sm'>
            <Megaphone className="h-5 w-5" /> Avisos para Pacientes
        </CardTitle>
        <CardDescription className="text-xs font-medium">
          Mensajes cortos que aparecen en el formulario de reserva (máximo 4).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {announcements.map((announcement, index) => (
          <div key={index} className="space-y-1">
            <Label className="text-[9px] font-black opacity-50 uppercase">Aviso {index + 1}</Label>
            <div className="flex items-center gap-2">
                <Input
                value={announcement}
                onChange={(e) => handleAnnouncementChange(index, e.target.value)}
                placeholder="Escribe el aviso..."
                className="font-bold h-10"
                />
                <Button
                variant="ghost"
                size="icon"
                onClick={() => removeAnnouncement(index)}
                className="text-destructive hover:bg-destructive/10 h-10 w-10"
                >
                <Trash2 className="h-4 w-4" />
                </Button>
            </div>
          </div>
        ))}
        {announcements.length < 4 && (
          <Button
            variant="outline"
            className="w-full h-11 border-dashed font-bold border-primary/20 text-primary"
            onClick={addAnnouncement}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuevo Aviso
          </Button>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving} className="w-full h-12 font-bold uppercase">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isSaving ? 'Actualizando...' : 'Sincronizar Avisos'}
        </Button>
      </CardFooter>
    </Card>
  );
}
