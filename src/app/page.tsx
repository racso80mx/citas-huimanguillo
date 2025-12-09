'use server'; // Keep this as a server component
import React from 'react';
import PageContent from './page-content';
import { getAnnouncements, getColonias, getClinics } from '@/lib/data';

export default async function HomePage() {
    // Fetch data directly on the server. Since these now read from local JSON files,
    // this is a fast, synchronous-like operation. No need for spinners or client-side fetching.
    const [initialAnnouncements, initialColonias, initialClinics] = await Promise.all([
        getAnnouncements(),
        getColonias(),
        getClinics(),
    ]);

    return (
        <PageContent
            initialAnnouncements={initialAnnouncements}
            initialColonias={initialColonias}
            initialClinics={initialClinics}
        />
    );
}
