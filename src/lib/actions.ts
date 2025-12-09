'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import {
  deleteAppointment as deleteDataAppointment,
  updateAppointmentStatus as updateDataAppointmentStatus,
  verifyClinicPassword as dataVerifyClinicPassword,
} from './data';

// Note: Most data mutation logic has been moved to the client-side
// to work reliably with Firebase client authentication.
// These server actions remain for operations that benefit from server-side logic
// and cache revalidation, but don't perform direct DB writes themselves anymore in most cases.

export async function deleteAppointment(id: string) {
  try {
    // This function calls the client-side adapted data function.
    // Ensure that the actual Firestore operation happens where auth is available.
    await deleteDataAppointment(id);
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/reports');
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
    revalidatePath('/admin');
    revalidatePath('/reports');
    return { success: true, message: 'Estado de la cita actualizado.' };
  }
  return { success: false, message: 'No se pudo actualizar el estado.' };
}

export async function verifyClinicPassword(
  clinicId: string,
  passwordAttempt: string
) {
  // This remains a server action as it's a good security practice
  // to verify passwords on the server.
  const result = await dataVerifyClinicPassword(clinicId, passwordAttempt);
  if (result.isValid) {
    revalidateTag(`clinic-auth-${clinicId}`);
    return { success: true };
  }
  return { success: false, message: result.error || "Contraseña incorrecta." };
}
