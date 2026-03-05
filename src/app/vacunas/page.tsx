'use server';
import React from 'react';
import VaccinePageContent from './page-content';
import { getVaccines, getVaccineSettings, getColonias, getClinics, getAnnouncements, getHolidays } from '@/lib/actions';

export default async function VacunasPage() {
  const [
    initialVaccines,
    initialSettings,
    initialColonias,
    initialClinics,
    initialAnnouncements,
    initialHolidays,
  ] = await Promise.all([
    getVaccines(),
    getVaccineSettings(),
    getColonias(),
    getClinics(),
    getAnnouncements(),
    getHolidays(),
  ]);

  return (
    <VaccinePageContent
      initialVaccines={initialVaccines}
      initialSettings={initialSettings}
      initialColonias={initialColonias}
      initialClinics={initialClinics}
      initialAnnouncements={initialAnnouncements}
      initialHolidays={initialHolidays}
    />
  );
}
