'use client';
import React from 'react';
import PageContent from './page-content';
import type { DailyAvailability, Colonia, Clinic, Appointment } from '@/lib/definitions';
import { getAnnouncements, getColonias, getAppointments, getClinics } from '@/lib/data';

export default function HomePage() {
    const [pageProps, setPageProps] = React.useState<{
        initialAnnouncements: string[];
        initialColonias: Colonia[];
        initialClinics: Clinic[];
    } | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        async function loadData() {
            try {
                const [announcements, colonias, clinics] = await Promise.all([
                    getAnnouncements(),
                    getColonias(),
                    getClinics(),
                ]);
                setPageProps({
                    initialAnnouncements: announcements,
                    initialColonias: colonias,
                    initialClinics: clinics,
                });
            } catch (err) {
                console.error("Failed to load initial page data:", err);
                setError("No se pudieron cargar los datos necesarios para la página.");
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, []);

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen">Cargando...</div>;
    }

    if (error || !pageProps) {
        return <div className="flex justify-center items-center h-screen text-red-500">{error}</div>;
    }

    return <PageContent {...pageProps} />;
}
