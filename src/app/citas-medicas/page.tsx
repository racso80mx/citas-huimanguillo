'use server';
import React from 'react';
import PageContent from './page-content';
import { getAnnouncements, getColonias, getClinics, getHolidays } from '@/lib/actions';

export default async function CitasMedicasPage() {
    const [initialAnnouncements, initialColonias, initialClinics, initialHolidays] = await Promise.all([
        getAnnouncements(),
        getColonias(),
        getClinics(),
        getHolidays(),
    ]);

    return (
        <PageContent
            initialAnnouncements={initialAnnouncements}
            initialColonias={initialColonias}
            initialClinics={initialClinics}
            initialHolidays={initialHolidays}
        />
    );
}
