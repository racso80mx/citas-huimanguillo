'use server';
import React from 'react';
import LabPageContent from './page-content';
import { getLabStudies, getLabSettings } from '@/lib/data';

export default async function LaboratorioPage() {
  // Fetch data directly on the server.
  const [initialStudies, initialSettings] = await Promise.all([
    getLabStudies(),
    getLabSettings(),
  ]);

  return (
    <LabPageContent
      initialStudies={initialStudies}
      initialSettings={initialSettings}
    />
  );
}
