'use server';
import React from 'react';
import XRayPageContent from './page-content';
import { getXRayStudies, getXRaySettings } from '@/lib/data';

export default async function XRayPage() {
  const [initialStudies, initialSettings] = await Promise.all([
    getXRayStudies(),
    getXRaySettings(),
  ]);

  return (
    <XRayPageContent
      initialStudies={initialStudies}
      initialSettings={initialSettings}
    />
  );
}
