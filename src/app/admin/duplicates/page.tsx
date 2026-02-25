'use client';
import React from 'react';
import { DuplicatesManager } from '@/components/admin/duplicates-manager';
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

export default function DuplicatesPage() {
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
                    <CardTitle className="text-3xl font-bold font-headline">Mantenimiento de Base de Datos</CardTitle>
                    <CardDescription>
                        Herramientas para encontrar duplicados y realizar actualizaciones masivas de estatus sin saturar el sistema.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <DuplicatesManager />
                </CardContent>
            </Card>
        </div>
    );
}
