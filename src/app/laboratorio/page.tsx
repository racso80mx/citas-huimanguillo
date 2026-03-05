'use server';
import React from 'react';
import LabPageContent from './page-content';
import { getLabStudies, getLabSettings, getAnnouncements, getHolidays } from '@/lib/actions';

export default async function LaboratorioPage() {
  const [initialStudies, initialSettings, initialAnnouncements, initialHolidays] = await Promise.all([
    getLabStudies(),
    getLabSettings(),
    getAnnouncements(),
    getHolidays(),
  ]);

  return (
    <LabPageContent
      initialStudies={initialStudies}
      initialSettings={initialSettings}
      initialAnnouncements={initialAnnouncements}
      initialHolidays={initialHolidays}
    />
  );
}
