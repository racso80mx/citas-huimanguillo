'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import {
  saveAppointment,
  getAppointmentsByDate,
  deleteAppointment as deleteDataAppointment,
  findPatientByCURP,
  savePatient,
  updateAppointmentStatus as updateDataAppointmentStatus,
  verifyClinicPassword as dataVerifyClinicPassword,
} from './data';
import type {
  Appointment,
  Clinic,
  Colonia,
  Patient,
  PatientType,
} from './definitions';
import { v4 as uuidv4 } from 'uuid';

type BookAppointmentArgs = {
  patient: Omit<Patient, 'id'>;
  date: string;
  time: string;
  clinicId: string;
  patientType: PatientType;
};


export async function bookAppointment(data: BookAppointmentArgs) {
  const { date, time, patient, clinicId } = data;

  const appointmentsOnDate = await getAppointmentsByDate(new Date(date));

  // Check if the specific time slot is already taken for the clinic
  const isTimeSlotTaken = appointmentsOnDate.some(
    (app) => app.clinicId === clinicId && app.time === time
  );

  if (isTimeSlotTaken) {
    return {
      success: false,
      message: `El horario de ${time} ya no está disponible. Por favor, selecciona otro.`,
    };
  }

  // Check if CURP already has an appointment on this date
  const curpExistsOnDate = appointmentsOnDate.some(
    (app) =>
      app.patient && app.patient.curp.toUpperCase() === patient.curp.toUpperCase()
  );

  if (curpExistsOnDate) {
    return {
      success: false,
      message:
        'Ya existe una cita agendada con esta CURP para el día seleccionado.',
    };
  }

  // Find or create patient
  let existingPatient = await findPatientByCURP(patient.curp);
  if (!existingPatient) {
    const newPatient = { ...patient, id: uuidv4() };
    await savePatient(newPatient);
    existingPatient = newPatient;
  } else {
    // If patient exists, update their info just in case (e.g. phone number)
    const updatedPatient = { ...existingPatient, ...patient };
    await savePatient(updatedPatient);
    existingPatient = updatedPatient;
  }

  // Create appointment number
  const appointmentNumber = uuidv4().split('-')[0].toUpperCase();

  const newAppointment: Appointment = {
    id: uuidv4(),
    appointmentNumber,
    patientId: existingPatient.id,
    clinicId,
    date,
    time,
    patientType: data.patientType,
    status: 'Pendiente',
    patient, // Embed patient data for convenience
  };

  const savedAppointment = await saveAppointment(newAppointment);

  if (!savedAppointment) {
    return {
      success: false,
      message: 'No se pudo guardar la cita en la base de datos.',
    };
  }

  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/reports');

  return {
    success: true,
    message: 'Cita agendada con éxito.',
    appointment: savedAppointment,
  };
}

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

// These functions will now be handled on the client-side to leverage the existing auth context.
// This file can be further cleaned up if these are the only server actions.
// For now, we will just comment them out to ensure they are not used.

// export async function updateAnnouncements(newAnnouncements: string[]) {
//   const result = await updateDataAnnouncements(newAnnouncements);
//   if (result) {
//     revalidatePath('/');
//     revalidatePath('/admin');
//     return { success: true, message: 'Avisos actualizados con éxito.' };
//   }
//   return { success: false, message: 'No se pudieron guardar los avisos.' };
// }

// export async function updateClinics(clinics: Clinic[]) {
//   const success = await updateDataClinics(clinics);
//   if (success) {
//     revalidatePath('/admin');
//     revalidatePath('/');
//     revalidateTag('clinics');
//     return { success: true, message: 'Núcleos actualizados con éxito.' };
//   }
//   return {
//     success: false,
//     message: 'No se pudo guardar la configuración de núcleos.',
//   };
// }

// export async function updateColonias(colonias: Colonia[]) {
//   const success = await updateDataColonias(colonias);
//   if (success) {
//     revalidatePath('/admin');
//     revalidatePath('/');
//     revalidateTag('colonias');
//     return { success: true, message: 'Colonias actualizadas con éxito.' };
//   }
//   return {
//     success: false,
//     message: 'No se pudo guardar la configuración de colonias.',
//   };
// }
