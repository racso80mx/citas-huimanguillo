'use client';
import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { runMigrationAction } from '@/lib/actions';
import { Loader2, DatabaseZap } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function MigrationManager({ onMigrationSuccess }: { onMigrationSuccess?: () => void }) {
  const [isMigrating, startMigrationTransition] = useTransition();
  const [migrationDone, setMigrationDone] = useState(false);
  const { toast } = useToast();

  const handleMigration = () => {
    startMigrationTransition(async () => {
      const result = await runMigrationAction();
      if (result.success) {
        const statsSummary = Object.entries(result.stats)
          .filter(([, count]) => count > 0)
          .map(([key, count]) => `${count} ${key}`)
          .join(', ');

        toast({
          title: 'Migración Completada',
          description: `Se migraron los siguientes registros nuevos: ${statsSummary || 'Ninguno'}.`,
          duration: 10000,
        });
        setMigrationDone(true);
        onMigrationSuccess?.();
      } else {
        toast({
          title: 'Error en la Migración',
          description: result.message || 'No se pudieron migrar los datos.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <DatabaseZap /> Acción Única: Migrar Datos a la Nube
        </CardTitle>
        <CardDescription className="text-destructive/90">
          Este proceso leerá todos los datos de los archivos `.json` locales y los copiará a la base de datos en la nube (Cloud Firestore).
          Solo se agregarán los registros que no existan. Esta acción solo debe realizarse una vez.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isMigrating || migrationDone}>
              {isMigrating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
              {migrationDone ? 'Migración Realizada' : (isMigrating ? 'Migrando...' : 'Iniciar Migración de Datos')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro de iniciar la migración?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción copiará los datos de los archivos locales a la base de datos en la nube.
                Es un proceso seguro que no duplicará datos, pero está diseñado para ejecutarse una sola vez.
                ¿Deseas continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleMigration} className="bg-destructive hover:bg-destructive/90">
                Sí, Iniciar Migración
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
