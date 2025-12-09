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
import { updateAnnouncements } from '@/lib/actions';
import { getAnnouncements as getAnnouncementsClient } from '@/lib/data-client';
import { Loader2, Trash2, PlusCircle, Megaphone } from 'lucide-react';

export function AnnouncementsManager() {
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSavingTransition] = useTransition();
  const { toast } = useToast();

  const fetchAnnouncements = async () => {
      setIsLoading(true);
      const data = await getAnnouncementsClient();
      setAnnouncements(data);
      setIsLoading(false);
    };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleAnnouncementChange = (index: number, value: string) => {
    const newAnnouncements = [...announcements];
    newAnnouncements[index] = value;
    setAnnouncements(newAnnouncements);
  };

  const addAnnouncement = () => {
    if (announcements.length < 4) {
      setAnnouncements([...announcements, '']);
    } else {
      toast({
        title: 'Límite alcanzado',
        description: 'Puedes agregar un máximo de 4 avisos.',
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
          title: 'Avisos Guardados',
          description: 'Los avisos se han actualizado. Se requiere un reinicio del servidor para que los cambios se reflejen en la UI de reserva.',
          className: 'bg-accent text-accent-foreground',
          duration: 8000,
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
          <CardTitle>Gestionar Avisos</CardTitle>
          <CardDescription>
            Publica mensajes que se mostrarán en la página de reservas.
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
        <CardTitle className='flex items-center gap-2'><Megaphone /> Gestionar Avisos</CardTitle>
        <CardDescription>
          Publica mensajes que se mostrarán en la página de reservas. (Máximo 4)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {announcements.map((announcement, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={announcement}
              onChange={(e) => handleAnnouncementChange(index, e.target.value)}
              placeholder={`Aviso ${index + 1}`}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeAnnouncement(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {announcements.length < 4 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={addAnnouncement}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Agregar Aviso
          </Button>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Guardando...' : 'Guardar Avisos'}
        </Button>
      </CardFooter>
    </Card>
  );
}