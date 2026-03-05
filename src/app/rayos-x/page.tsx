'use server';
import React from 'react';
import XRayPageContent from './page-content';
import { getXRayStudies, getXRaySettings, getAnnouncements, getHolidays } from '@/lib/actions';

export default async function XRayPage() {
  const [initialStudies, initialSettings, initialAnnouncements, initialHolidays] = await Promise.all([
    getXRayStudies(),
    getXRaySettings(),
    getAnnouncements(),
    getHolidays(),
  ]);

  return (
    <XRayPageContent
      initialStudies={initialStudies}
      initialSettings={initialSettings}
      initialAnnouncements={initialAnnouncements}
      initialHolidays={initialHolidays}
    />
  );
}
