
'use server';
import React from 'react';
import PageContent from './page-content';
import { 
    getAnnouncements, 
    getColonias, 
    getClinics, 
    getHolidays, 
    getSpecialActionDays, 
    getSpecialties,
    getServiceTypes
} from '@/lib/actions';

export default async function CitasMedicasPage() {
    const [
        initialAnnouncements, 
        initialColonias, 
        initialClinics, 
        initialHolidays, 
        initialSpecialActionDays, 
        initialSpecialties,
        initialServiceTypes
    ] = await Promise.all([
        getAnnouncements(),
        getColonias(),
        getClinics(),
        getHolidays(),
        getSpecialActionDays(),
        getSpecialties(),
        getServiceTypes()
    ]);

    return (
        <PageContent
            initialAnnouncements={initialAnnouncements}
            initialColonias={initialColonias}
            initialClinics={initialClinics}
            initialHolidays={initialHolidays}
            initialSpecialActionDays={initialSpecialActionDays}
            initialServiceTypes={initialServiceTypes}
            initialSpecialties={initialSpecialties}
        />
    );
}
