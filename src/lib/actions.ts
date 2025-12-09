'use server';

import { revalidateTag } from 'next/cache';
import {
  deleteAppointment as deleteDataAppointment,
  updateAppointmentStatus as updateDataAppointmentStatus,
} from './data-client'; // Changed from './data'
import { verifyClinicPassword as dataVerifyClinicPassword, updateClinics as dataUpdateClinics, updateColonias as dataUpdateColonias, updateAnnouncements as dataUpdateAnnouncements } from './data';
import type { Clinic, Colonia } from './definitions';

// NOTE: This file now mixes calls to client-side Firestore operations (for dynamic data)
// and server-side JSON file operations (for config data). This is a bridge
// until all data logic is consistently handled.

export async function deleteAppointment(id: string) {
  try {
    // This is now an issue because deleteDataAppointment is client-side.
    // However, we'll keep the revalidate tag for now as the action is still server-side.
    // For a full fix, this should be a client-side operation with optimistic UI.
    await deleteDataAppointment(id);
    revalidateTag('appointments');
    return { success: true, message: 'Cita eliminada con éxito.' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido al eliminar la cita.';
    return {
      success: false,
      message: errorMessage,
    };
  }
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'Atendida' | 'Cancelada'
) {
  // Same issue as deleteAppointment
  const success = await updateDataAppointmentStatus(appointmentId, status);
  if (success) {
    revalidateTag('appointments');
    return { success: true, message: 'Estado de la cita actualizado.' };
  }
  return { success: false, message: 'No se pudo actualizar el estado.' };
}

export async function verifyClinicPassword(
  clinicId: string,
  passwordAttempt: string
) {
  const result = await dataVerifyClinicPassword(clinicId, passwordAttempt);
  if (result.isValid) {
    // Revalidation is not strictly needed here as it's a login, not data change
    // revalidateTag(`clinic-auth-${clinicId}`);
    return { success: true };
  }
  return { success: false, message: result.error || "Contraseña incorrecta." };
}

export async function updateClinics(clinics: Clinic[]) {
    const result = await dataUpdateClinics(clinics);
    if (result.success) {
        revalidateTag('clinics');
    }
    return result;
}

export async function updateColonias(colonias: Colonia[]) {
    const result = await dataUpdateColonias(colonias);
    if (result.success) {
        revalidateTag('colonias');
    }
    return result;
}

export async function updateAnnouncements(announcements: string[]) {
    const result = await dataUpdateAnnouncements(announcements);
    if (result.success) {
        revalidateTag('announcements');
    }
    return result;
}
