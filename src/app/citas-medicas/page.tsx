'use server';
import React from 'react';
import PageContent from './page-content';
import { getAnnouncements, getColonias, getClinics, getHolidays, getSpecialActionDays, getSpecialties } from '@/lib/actions';

export default async function CitasMedicasPage() {
    const [initialAnnouncements, initialColonias, initialClinics, initialHolidays, initialSpecialActionDays, initialSpecialties] = await Promise.all([
        getAnnouncements(),
        getColonias(),
        getClinics(),
        getHolidays(),
        getSpecialActionDays(),
        getSpecialties()
    ]);

    return (
        <PageContent
            initialAnnouncements={initialAnnouncements}
            initialColonias={initialColonias}
            initialClinics={initialClinics}
            initialHolidays={initialHolidays}
            initialSpecialActionDays={initialSpecialActionDays}
            initialSpecialties={initialSpecialties}
        />
    );
}