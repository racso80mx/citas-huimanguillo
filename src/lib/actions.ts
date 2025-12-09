'use server';

import { revalidateTag } from 'next/cache';
import {
  deleteAppointment as deleteDataAppointment,
  updateAppointmentStatus as updateDataAppointmentStatus,
} from './data-client';
import { 
  verifyClinicPassword as dataVerifyClinicPassword, 
  updateClinics as dataUpdateClinics, 
  updateColonias as dataUpdateColonias, 
  updateAnnouncements as dataUpdateAnnouncements 
} from './data';
import type { Clinic, Colonia } from './definitions';


export async function deleteAppointment(id: string) {
  try {
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
    return { success: true };
  }
  return { success: false, message: result.error || "Contraseña incorrecta." };
}

export async function updateClinics(clinics: Clinic[]) {
    const result = await dataUpdateClinics(clinics);
    if (result.success) {
        // Revalidation is not needed for static files in this manner,
        // but we'll leave the tag in case the data source changes back.
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
