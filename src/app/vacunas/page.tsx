
'use server';
import React from 'react';
import VaccinePageContent from './page-content';
import { getVaccines, getVaccineSettings, getColonias, getClinics, getAnnouncements } from '@/lib/data';

export default async function VacunasPage() {
  const [
    initialVaccines,
    initialSettings,
    initialColonias,
    initialClinics,
    initialAnnouncements,
  ] = await Promise.all([
    getVaccines(),
    getVaccineSettings(),
    getColonias(),
    getClinics(),
    getAnnouncements(),
  ]);

  return (
    <VaccinePageContent
      initialVaccines={initialVaccines}
      initialSettings={initialSettings}
      initialColonias={initialColonias}
      initialClinics={initialClinics}
      initialAnnouncements={initialAnnouncements}
    />
  );
}
