'use server';
import React from 'react';
import UltrasoundPageContent from './page-content';
import { getUltrasoundStudies, getUltrasoundSettings, getAnnouncements, getHolidays } from '@/lib/actions';

export default async function UltrasoundPage() {
  const [initialStudies, initialSettings, initialAnnouncements, initialHolidays] = await Promise.all([
    getUltrasoundStudies(),
    getUltrasoundSettings(),
    getAnnouncements(),
    getHolidays(),
  ]);

  return (
    <UltrasoundPageContent
      initialStudies={initialStudies}
      initialSettings={initialSettings}
      initialAnnouncements={initialAnnouncements}
      initialHolidays={initialHolidays}
    />
  );
}
