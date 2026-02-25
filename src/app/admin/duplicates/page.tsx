'use server';
import React from 'react';
import { DuplicatesManager } from '@/components/admin/duplicates-manager';
import { getDuplicatePatients } from '@/lib/actions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function DuplicatesPage() {
    const { byExpediente, byCurp, byName } = await getDuplicatePatients();
    
    return (
        <div className="container mx-auto px-4 py-8 md:py-12">
             <div className="mb-6">
                <Button asChild variant="outline">
                    <Link href="/admin">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al Panel de Administración
                    </Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-bold font-headline">Gestor de Pacientes Duplicados</CardTitle>
                    <CardDescription>
                        Utiliza esta herramienta para encontrar y eliminar registros de pacientes duplicados. 
                        Los duplicados se agrupan por No. de Expediente, CURP y Nombre completo.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <DuplicatesManager 
                        initialDuplicates={{ byExpediente, byCurp, byName }} 
                    />
                </CardContent>
            </Card>
        </div>
    );
}
