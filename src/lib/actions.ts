'use server';

import { revalidateTag } from 'next/cache';
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
import type { Clinic, Colonia, LabSettings, LabStudy, XRaySettings, XRayStudy, UltrasoundSettings, UltrasoundStudy } from './definitions';


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
    return { success: true, message: 'Cita de laboratorio eliminada con éxito.' };
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
      return { success: true, message: 'Cita de Ultrasonido eliminada con éxito.' };
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
    if(result.isValid) {
        return { success: true };
    }
    return { success: false, message: result.error || 'Contraseña incorrecta.' };
}

export async function verifyXRayPassword(passwordAttempt: string) {
    const result = await dataVerifyXRayPassword(passwordAttempt);
    if(result.isValid) {
        return { success: true };
    }
    return { success: false, message: result.error || 'Contraseña incorrecta.' };
}

export async function verifyUltrasoundPassword(passwordAttempt: string) {
    const result = await dataVerifyUltrasoundPassword(passwordAttempt);
    if(result.isValid) {
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
