
'use server';
import React from 'react';
import XRayPageContent from './page-content';
import { getXRayStudies, getXRaySettings, getAnnouncements } from '@/lib/data';

export default async function XRayPage() {
  const [initialStudies, initialSettings, initialAnnouncements] = await Promise.all([
    getXRayStudies(),
    getXRaySettings(),
    getAnnouncements(),
  ]);

  return (
    <XRayPageContent
      initialStudies={initialStudies}
      initialSettings={initialSettings}
      initialAnnouncements={initialAnnouncements}
    />
  );
}
