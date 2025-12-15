'use server';

import { revalidateTag } from 'next/cache';
import {
  saveAppointment as dataSaveAppointment,
  saveLabAppointment as dataSaveLabAppointment,
  saveXRayAppointment as dataSaveXRayAppointment,
  saveUltrasoundAppointment as dataSaveUltrasoundAppointment,
  getAppointmentsByDate,
  getLabAppointmentsByDate,
  getXRayAppointmentsByDate,
  getUltrasoundAppointmentsByDate
} from './data-server';
import {
    deleteAppointment as deleteDataAppointment,
    deleteLabAppointment as deleteDataLabAppointment,
    deleteXRayAppointment as deleteDataXRayAppointment,
    deleteUltrasoundAppointment as deleteDataUltrasoundAppointment,
} from './data-client';
import {
  verifyClinicPassword as dataVerifyClinicPassword,
  verifyXRayPassword as dataVerifyXRayPassword,
  verifyUltrasoundPassword as dataVerifyUltrasoundPassword,
  verifyLabPassword as dataVerifyLabPassword,
  updateClinics as dataUpdateClinics,
  updateColonias as dataUpdateColonias,
  updateAnnouncements as dataUpdateAnnouncements,
  getClinics as dataGetClinics,
  getColonias as dataGetColonias,
  getAnnouncements as dataGetAnnouncements,
  updateLabSettings as dataUpdateLabSettings,
  getLabSettings as dataGetLabSettings,
  updateLabStudies as dataUpdateLabStudies,
  getLabStudies as dataGetLabStudies,
  getXRaySettings as dataGetXRaySettings,
  updateXRaySettings as dataUpdateXRaySettings,
  getXRayStudies as dataGetXRayStudies,
  updateXRayStudies as dataUpdateXRayStudies,
  getUltrasoundSettings as dataGetUltrasoundSettings,
  updateUltrasoundSettings as dataUpdateUltrasoundSettings,
  getUltrasoundStudies as dataGetUltrasoundStudies,
  updateUltrasoundStudies as dataUpdateUltrasoundStudies,
} from './data';


import type {
  Appointment,
  Clinic,
  Colonia,
  LabAppointment,
  LabSettings,
  LabStudy,
  Patient,
  UltrasoundAppointment,
  UltrasoundSettings,
  UltrasoundStudy,
  XRayAppointment,
  XRaySettings,
  XRayStudy,
} from './definitions';

export async function saveNewAppointment(
  appointmentData: Omit<Appointment, 'id' | 'patientId' | 'patient'>,
  patientData: Omit<Patient, 'id'>
): Promise<{ success: boolean; data?: Appointment; error?: string }> {
  try {
    const appointmentsOnDate = await getAppointmentsByDate(new Date(appointmentData.date));

    const isTimeSlotTaken = appointmentsOnDate.some(
      (app) => app.clinicId === appointmentData.clinicId && app.time === appointmentData.time
    );
    if (isTimeSlotTaken) {
      throw new Error(`El horario de ${appointmentData.time} ya no está disponible. Por favor, selecciona otro.`);
    }

    const curpExistsOnDate = appointmentsOnDate.some(
      (app) => app.patient.curp.toUpperCase() === patientData.curp.toUpperCase()
    );
    if (curpExistsOnDate) {
      throw new Error('Ya existe una cita agendada con esta CURP para el día seleccionado.');
    }

    const newAppointment = await dataSaveAppointment(appointmentData, patientData);
    revalidateTag('appointments');
    return { success: true, data: newAppointment };
  } catch (e: any) {
    return { success: false, error: e.message || 'Error al guardar la cita.' };
  }
}

export async function saveNewLabAppointment(
  appointmentData: Omit<LabAppointment, 'id' | 'patientId' | 'patient'>,
  patientData: Omit<Patient, 'id'>,
  settings: { dailySlots: number; weekendBookingEnabled: boolean }
): Promise<{ success: boolean; data?: LabAppointment; error?: string }> {
  try {
    const appointmentsOnDate = await getLabAppointmentsByDate(new Date(appointmentData.date));
    if (appointmentsOnDate.length >= settings.dailySlots) {
      throw new Error('No hay más cupos para este día.');
    }
    
    const curpExistsOnDate = appointmentsOnDate.some(
      (app) => app.patient.curp.toUpperCase() === patientData.curp.toUpperCase()
    );
    if (curpExistsOnDate) {
      throw new Error('Ya existe una cita de laboratorio agendada con esta CURP para el día seleccionado.');
    }

    const newAppointment = await dataSaveLabAppointment(appointmentData, patientData);
    revalidateTag('labAppointments');
    return { success: true, data: newAppointment };
  } catch (e: any) {
    return { success: false, error: e.message || 'Error al guardar la cita de laboratorio.' };
  }
}


export async function saveNewXRayAppointment(
  appointmentData: Omit<XRayAppointment, 'id' | 'patientId' | 'patient'>,
  patientData: Omit<Patient, 'id'>,
): Promise<{ success: boolean; data?: XRayAppointment; error?: string }> {
   try {
    const appointmentsOnDate = await getXRayAppointmentsByDate(new Date(appointmentData.date));
    
    const isTimeSlotTaken = appointmentsOnDate.some(
      (app) => app.time === appointmentData.time
    );

    if (isTimeSlotTaken) {
      throw new Error(`El horario de ${appointmentData.time} ya no está disponible. Por favor, selecciona otro.`);
    }
    
    const curpExistsOnDate = appointmentsOnDate.some(
      (app) => app.patient.curp.toUpperCase() === patientData.curp.toUpperCase()
    );

    if (curpExistsOnDate) {
      throw new Error('Ya existe una cita de Rayos X agendada con esta CURP para el día seleccionado.');
    }

    const newAppointment = await dataSaveXRayAppointment(appointmentData, patientData);
    revalidateTag('xRayAppointments');
    return { success: true, data: newAppointment };
  } catch (e: any) {
    return { success: false, error: e.message || 'Error al guardar la cita de Rayos X.' };
  }
}

export async function saveNewUltrasoundAppointment(
  appointmentData: Omit<UltrasoundAppointment, 'id' | 'patientId' | 'patient'>,
  patientData: Omit<Patient, 'id'>,
): Promise<{ success: boolean; data?: UltrasoundAppointment; error?: string }> {
   try {
    const appointmentsOnDate = await getUltrasoundAppointmentsByDate(new Date(appointmentData.date));
    
    const isTimeSlotTaken = appointmentsOnDate.some(
      (app) => app.time === appointmentData.time
    );

    if (isTimeSlotTaken) {
      throw new Error(`El horario de ${appointmentData.time} ya no está disponible. Por favor, selecciona otro.`);
    }
    
    const curpExistsOnDate = appointmentsOnDate.some(
      (app) => app.patient.curp.toUpperCase() === patientData.curp.toUpperCase()
    );

    if (curpExistsOnDate) {
      throw new Error('Ya existe una cita de Ultrasonido agendada con esta CURP para el día seleccionado.');
    }

    const newAppointment = await dataSaveUltrasoundAppointment(appointmentData, patientData);
    revalidateTag('ultrasoundAppointments');
    return { success: true, data: newAppointment };
  } catch (e: any) {
    return { success: false, error: e.message || 'Error al guardar la cita de Ultrasonido.' };
  }
}



// =====================================================================
// Delete Actions
// =====================================================================

export async function deleteAppointment(id: string) {
  try {
    await deleteDataAppointment(id);
    revalidateTag('appointments');
    return { success: true, message: 'Cita eliminada con éxito.' };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Error desconocido al eliminar la cita.';
    return {
      success: false,
      message: errorMessage,
    };
  }
}

export async function deleteLabAppointment(id: string) {
  try {
    await deleteDataLabAppointment(id);
    revalidateTag('labAppointments');
    return {
      success: true,
      message: 'Cita de laboratorio eliminada con éxito.',
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Error desconocido al eliminar la cita.';
    return {
      success: false,
      message: errorMessage,
    };
  }
}

export async function deleteXRayAppointment(id: string) {
  try {
    await deleteDataXRayAppointment(id);
    revalidateTag('xRayAppointments');
    return { success: true, message: 'Cita de Rayos X eliminada con éxito.' };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Error desconocido al eliminar la cita.';
    return {
      success: false,
      message: errorMessage,
    };
  }
}

export async function deleteUltrasoundAppointment(id: string) {
  try {
    await deleteDataUltrasoundAppointment(id);
    revalidateTag('ultrasoundAppointments');
    return {
      success: true,
      message: 'Cita de Ultrasonido eliminada con éxito.',
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Error desconocido al eliminar la cita.';
    return {
      success: false,
      message: errorMessage,
    };
  }
}

// =====================================================================
// Config & Settings Actions
// =====================================================================

export async function verifyClinicPassword(
  clinicId: string,
  passwordAttempt: string
) {
  const result = await dataVerifyClinicPassword(clinicId, passwordAttempt);
  if (result.isValid) {
    return { success: true };
  }
  return { success: false, message: result.error || 'Contraseña incorrecta.' };
}

export async function verifyLabPassword(passwordAttempt: string) {
  const result = await dataVerifyLabPassword(passwordAttempt);
  if (result.isValid) {
    return { success: true };
  }
  return { success: false, message: result.error || 'Contraseña incorrecta.' };
}

export async function verifyXRayPassword(passwordAttempt: string) {
  const result = await dataVerifyXRayPassword(passwordAttempt);
  if (result.isValid) {
    return { success: true };
  }
  return { success: false, message: result.error || 'Contraseña incorrecta.' };
}

export async function verifyUltrasoundPassword(passwordAttempt: string) {
  const result = await dataVerifyUltrasoundPassword(passwordAttempt);
  if (result.isValid) {
    return { success: true };
  }
  return { success: false, message: result.error || 'Contraseña incorrecta.' };
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

// Lab
export async function updateLabSettings(settings: LabSettings) {
  const result = await dataUpdateLabSettings(settings);
  if (result.success) {
    revalidateTag('labSettings');
  }
  return result;
}

export async function updateLabStudies(studies: LabStudy[]) {
  const result = await dataUpdateLabStudies(studies);
  if (result.success) {
    revalidateTag('labStudies');
  }
  return result;
}

// X-Ray
export async function updateXRaySettings(settings: XRaySettings) {
  const result = await dataUpdateXRaySettings(settings);
  if (result.success) {
    revalidateTag('xRaySettings');
  }
  return result;
}

export async function updateXRayStudies(studies: XRayStudy[]) {
  const result = await dataUpdateXRayStudies(studies);
  if (result.success) {
    revalidateTag('xRayStudies');
  }
  return result;
}

// Ultrasound
export async function updateUltrasoundSettings(settings: UltrasoundSettings) {
  const result = await dataUpdateUltrasoundSettings(settings);
  if (result.success) {
    revalidateTag('ultrasoundSettings');
  }
  return result;
}

export async function updateUltrasoundStudies(studies: UltrasoundStudy[]) {
  const result = await dataUpdateUltrasoundStudies(studies);
  if (result.success) {
    revalidateTag('ultrasoundStudies');
  }
  return result;
}

// Server actions to fetch static data for client components that can't be server components
export async function getClinics() {
  return await dataGetClinics();
}

export async function getColonias() {
  return await dataGetColonias();
}

export async function getAnnouncements() {
  return await dataGetAnnouncements();
}

export async function getLabSettings() {
  return await dataGetLabSettings();
}

export async function getLabStudies() {
  return await dataGetLabStudies();
}

export async function getXRaySettings() {
  return await dataGetXRaySettings();
}

export async function getXRayStudies() {
  return await dataGetXRayStudies();
}

export async function getUltrasoundSettings() {
  return await dataGetUltrasoundSettings();
}

export async function getUltrasoundStudies() {
  return await dataGetUltrasoundStudies();
}
