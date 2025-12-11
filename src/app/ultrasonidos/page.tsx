'use server';
import React from 'react';
import UltrasoundPageContent from './page-content';
import { getUltrasoundStudies, getUltrasoundSettings } from '@/lib/data';

export default async function UltrasoundPage() {
  const [initialStudies, initialSettings] = await Promise.all([
    getUltrasoundStudies(),
    getUltrasoundSettings(),
  ]);

  return (
    <UltrasoundPageContent
      initialStudies={initialStudies}
      initialSettings={initialSettings}
    />
  );
}
