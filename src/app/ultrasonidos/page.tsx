
'use server';
import React from 'react';
import UltrasoundPageContent from './page-content';
import { getUltrasoundStudies, getUltrasoundSettings, getAnnouncements } from '@/lib/data';

export default async function UltrasoundPage() {
  const [initialStudies, initialSettings, initialAnnouncements] = await Promise.all([
    getUltrasoundStudies(),
    getUltrasoundSettings(),
    getAnnouncements(),
  ]);

  return (
    <UltrasoundPageContent
      initialStudies={initialStudies}
      initialSettings={initialSettings}
      initialAnnouncements={initialAnnouncements}
    />
  );
}
