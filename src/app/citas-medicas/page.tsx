'use server';
import React from 'react';
import PageContent from './page-content';
import { getAnnouncements, getColonias, getClinics } from '@/lib/data';

export default async function CitasMedicasPage() {
    const [initialAnnouncements, initialColonias, initialClinics] = await Promise.all([
        getAnnouncements(),
        getColonias(),
        getClinics(),
    ]);

    return (
        <PageContent
            initialAnnouncements={initialAnnouncements}
            initialColonias={initialColonias}
            initialClinics={initialClinics}
        />
    );
}
