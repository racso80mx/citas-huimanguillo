
'use server';
import React from 'react';
import LabPageContent from './page-content';
import { getLabStudies, getLabSettings, getAnnouncements } from '@/lib/data';

export default async function LaboratorioPage() {
  const [initialStudies, initialSettings, initialAnnouncements] = await Promise.all([
    getLabStudies(),
    getLabSettings(),
    getAnnouncements(),
  ]);

  return (
    <LabPageContent
      initialStudies={initialStudies}
      initialSettings={initialSettings}
      initialAnnouncements={initialAnnouncements}
    />
  );
}
