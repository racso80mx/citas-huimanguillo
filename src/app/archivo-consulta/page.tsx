'use server';
import React from 'react';
import PageContent from './page-content';
import { getModuleSettings } from '@/lib/data';

export default async function ArchivoConsultaPage() {
    const moduleSettings = await getModuleSettings();
    
    if (!moduleSettings.archivoConsultaEnabled) {
        return (
            <div className="container mx-auto px-4 py-8 md:py-12 text-center">
                <h1 className="text-2xl font-bold">Módulo Deshabilitado</h1>
                <p className="text-muted-foreground mt-2">
                    El módulo de consulta de padrón no está activo. Contacta al administrador.
                </p>
            </div>
        )
    }

    return (
        <div className="w-full">
            <PageContent />
        </div>
    );
}
