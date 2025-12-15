'use client';

// This file is a placeholder for client-side data fetching logic.
// For this version, all data fetching is handled server-side via Server Actions
// and data is passed as props, or handled via local JSON files in lib/data.ts.

// We can re-introduce client-side specific data-fetching functions here if needed in the future,
// for example, functions that use 'useSWR' or 'react-query' for client-state management.

import { getAppointments, getLabAppointments, getXRayAppointments, getUltrasoundAppointments, deleteAppointment, deleteLabAppointment, deleteXRayAppointment, deleteUltrasoundAppointment, getAppointmentsForClinic } from './actions';

// Re-exporting the server actions for use in client components.
// This is a common pattern to call server actions from the client.
export {
    getAppointments,
    getLabAppointments,
    getXRayAppointments,
    getUltrasoundAppointments,
    deleteAppointment,
    deleteLabAppointment,
    deleteXRayAppointment,
    deleteUltrasoundAppointment,
    getAppointmentsForClinic,
};
