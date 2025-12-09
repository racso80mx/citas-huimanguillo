'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import {
  deleteAppointment as deleteDataAppointment,
  updateAppointmentStatus as updateDataAppointmentStatus,
  verifyClinicPassword as dataVerifyClinicPassword,
} from './data';

export async function deleteAppointment(id: string) {
  try {
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
  const result = await dataVerifyClinicPassword(clinicId, passwordAttempt);
  if (result.isValid) {
    revalidateTag(`clinic-auth-${clinicId}`);
    return { success: true };
  }
  return { success: false, message: result.error || "Contraseña incorrecta." };
}
