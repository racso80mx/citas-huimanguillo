'use server';

import { revalidatePath } from 'next/cache';
import {
  getPatientByCURP as dataGetPatientByCURP,
  saveAppointment as dataSaveAppointment,
  saveLabAppointment as dataSaveLabAppointment,
  saveXRayAppointment as dataSaveXRayAppointment,
  saveUltrasoundAppointment as dataSaveUltrasoundAppointment,
  saveVaccineAppointment as dataSaveVaccineAppointment,
  getAppointments as dataGetAppointments,
  getAppointmentsForClinic as dataGetAppointmentsForClinic,
  getLabAppointments as dataGetLabAppointments,
  getXRayAppointments as dataGetXRayAppointments,
  getUltrasoundAppointments as dataGetUltrasoundAppointments,
  getVaccineAppointments as dataGetVaccineAppointments,
  deleteAppointment as dataDeleteAppointment,
  deleteLabAppointment as dataDeleteLabAppointment,
  deleteXRayAppointment as dataDeleteXRayAppointment,
  deleteUltrasoundAppointment as dataDeleteUltrasoundAppointment,
  deleteVaccineAppointment as dataDeleteVaccineAppointment,
  verifyClinicPassword as dataVerifyClinicPassword,
  verifyXRayPassword as dataVerifyXRayPassword,
  verifyUltrasoundPassword as dataVerifyUltrasoundPassword,
  verifyLabPassword as dataVerifyLabPassword,
  verifyVaccinePassword as dataVerifyVaccinePassword,
  updateClinics as dataUpdateClinics,
  updateColonias as dataUpdateColonias,
  updateAnnouncements as dataUpdateAnnouncements,
  getClinics as dataGetClinics,
  getColonias as dataGetColonias,
  getAnnouncements as dataGetAnnouncements,
  getLabSettings as dataGetLabSettings,
  getLabStudies as dataGetLabStudies,
  updateLabSettings as dataUpdateLabSettings,
  updateLabStudies as dataUpdateLabStudies,
  getXRaySettings as dataGetXRaySettings,
  getXRayStudies as dataGetXRayStudies,
  updateXRaySettings as dataUpdateXRaySettings,
  updateXRayStudies as dataUpdateXRayStudies,
  getUltrasoundSettings as dataGetUltrasoundSettings,
  getUltrasoundStudies as dataGetUltrasoundStudies,
  updateUltrasoundStudies as dataUpdateUltrasoundStudies,
  updateUltrasoundSettings as dataUpdateUltrasoundSettings,
  getVaccineSettings as dataGetVaccineSettings,
  getVaccines as dataGetVaccines,
  updateVaccineSettings as dataUpdateVaccineSettings,
  updateVaccines as dataUpdateVaccines,
  getUsers as dataGetUsers,
  updateUsers as dataUpdateUsers,
  updatePatient as dataUpdatePatient,
  getModuleSettings as dataGetModuleSettings,
  updateModuleSettings as dataUpdateModuleSettings,
  updateAppointmentStatus as dataUpdateAppointmentStatus,
  rescheduleAppointment as dataRescheduleAppointment,
  createBackupData,
  restoreBackupData,
  cleanupOldRecords,
  getLogs as dataGetLogs,
  cloneAppointment as dataCloneAppointment,
  logActivity
} from './data';

import type {
  Appointment,
  AppointmentStatus,
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
  ModuleSettings,
  Vaccine,
  VaccineSettings,
  VaccineAppointment,
  User,
} from './definitions';
import { toast } from '@/hooks/use-toast';
import { generateAppointmentPDF, generateLabAppointmentPDF, generateXRayAppointmentPDF, generateUltrasoundAppointmentPDF, generateVaccineAppointmentPDF } from './utils';

export async function getPatientByCURP(curp: string): Promise<{ success: boolean; data?: Patient; error?: string }> {
  try {
    const patient = await dataGetPatientByCURP(curp);
    if (patient) {
      return { success: true, data: patient };
    }
    return { success: false, error: 'No se encontró paciente con esa CURP.' };
  } catch (e: any) {
    return { success: false, error: e.message || 'Error al buscar el paciente.' };
  }
}

export async function saveNewAppointment(
  appointmentData: Omit<Appointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>
): Promise<{ success: boolean; data?: { appointment: Appointment, clinic: Clinic }; error?: string }> {
  try {
    
    const { appointment, clinic } = await dataSaveAppointment(
      appointmentData,
      patientData
    );

    await logActivity('Creación Cita Médica', `Folio ${appointment.appointmentNumber} para ${patientData.name}.`);

    toast({
        title: 'Cita Confirmada',
        description: `Tu cita ha sido agendada con éxito. Folio: ${appointment.appointmentNumber}`,
        duration: 10000,
    });

    generateAppointmentPDF(appointment, clinic);

    revalidatePath('/citas-medicas');
    revalidatePath('/admin');
    revalidatePath('/reports');
    return { success: true, data: { appointment: appointment, clinic: clinic } };
  } catch (e: any) {
    return { success: false, error: e.message || 'Error al guardar la cita.' };
  }
}

export async function saveNewLabAppointment(
  appointmentData: Omit<LabAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>,
  settings: { dailySlots: number, weekendBookingEnabled: boolean }
): Promise<{ success: boolean; data?: LabAppointment; error?: string }> {
  try {
    const { appointment: newAppointment } = await dataSaveLabAppointment(
      appointmentData,
      patientData,
      settings
    );

    await logActivity('Creación Cita Laboratorio', `Folio ${newAppointment.appointmentNumber} para ${patientData.name}.`);

    toast({
        title: 'Cita Confirmada',
        description: `Tu cita de laboratorio ha sido agendada. Folio: ${newAppointment.appointmentNumber}`,
        duration: 10000,
    });

    generateLabAppointmentPDF(newAppointment);

    revalidatePath('/laboratorio');
    revalidatePath('/admin');
    revalidatePath('/reports');
    return { success: true, data: newAppointment };
  } catch (e: any) {
    return {
      success: false,
      error: e.message || 'Error al guardar la cita de laboratorio.',
    };
  }
}

export async function saveNewXRayAppointment(
  appointmentData: Omit<XRayAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>,
  study: XRayStudy
): Promise<{ success: boolean; data?: XRayAppointment; error?: string }> {
  try {
    const { appointment: newAppointment } = await dataSaveXRayAppointment(
      appointmentData,
      patientData
    );
    
    await logActivity('Creación Cita Rayos X', `Folio ${newAppointment.appointmentNumber} para ${patientData.name}.`);

    toast({
        title: 'Cita Confirmada',
        description: `Tu cita de Rayos X ha sido agendada. Folio: ${newAppointment.appointmentNumber}`,
        duration: 10000,
    });

    generateXRayAppointmentPDF(newAppointment, study);

    revalidatePath('/rayos-x');
    revalidatePath('/admin');
    revalidatePath('/reports');
    return { success: true, data: newAppointment };
  } catch (e: any) {
    return {
      success: false,
      error: e.message || 'Error al guardar la cita de Rayos X.',
    };
  }
}

export async function saveNewUltrasoundAppointment(
  appointmentData: Omit<UltrasoundAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>,
  study: UltrasoundStudy,
): Promise<{ success: boolean; data?: UltrasoundAppointment; error?: string }> {
  try {

    const { appointment: newAppointment } = await dataSaveUltrasoundAppointment(
      appointmentData,
      patientData
    );
    
    await logActivity('Creación Cita Ultrasonido', `Folio ${newAppointment.appointmentNumber} para ${patientData.name}.`);

    toast({
        title: 'Cita Confirmada',
        description: `Tu cita de Ultrasonido ha sido agendada. Folio: ${newAppointment.appointmentNumber}`,
        duration: 10000,
    });

    generateUltrasoundAppointmentPDF(newAppointment, study);

    revalidatePath('/ultrasonidos');
    revalidatePath('/admin');
    revalidatePath('/reports');
    return { success: true, data: newAppointment };
  } catch (e: any) {
    return {
      success: false,
      error: e.message || 'Error al guardar la cita de Ultrasonido.',
    };
  }
}

export async function saveNewVaccineAppointment(
  appointmentData: Omit<VaccineAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>
): Promise<{ success: boolean; data?: VaccineAppointment; error?: string }> {
  try {
    const { appointment: newAppointment } = await dataSaveVaccineAppointment(
      appointmentData,
      patientData
    );

    await logActivity('Creación Cita Vacunación', `Folio ${newAppointment.appointmentNumber} para ${patientData.name}.`);

    toast({
        title: 'Cita Confirmada',
        description: `Tu cita de Vacunación ha sido agendada. Folio: ${newAppointment.appointmentNumber}`,
        duration: 10000,
    });

    generateVaccineAppointmentPDF(newAppointment);

    revalidatePath('/vacunas');
    revalidatePath('/admin');
    revalidatePath('/reports');
    return { success: true, data: newAppointment };
  } catch (e: any) {
    return {
      success: false,
      error: e.message || 'Error al guardar la cita de Vacunación.',
    };
  }
}

export async function cloneAppointment(
  originalAppointmentId: string,
  newDate: string,
  type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'
): Promise<{ success: boolean; message: string; data?: any }> {
    const result = await dataCloneAppointment(originalAppointmentId, newDate, type);
    if(result.success) {
      await logActivity('Clonación de Cita', `Folio original ${result.originalFolio} clonado a nuevo folio ${result.data.appointmentNumber}.`);
    }
    return result;
}

export async function updatePatient(patientId: string, patientData: Partial<Omit<Patient, 'id'>>) {
    try {
        const result = await dataUpdatePatient(patientId, patientData);
        if (result.success) {
            await logActivity('Actualización de Paciente', `Datos del paciente con ID ${patientId} actualizados.`);
            revalidatePath('/admin');
            revalidatePath('/reports');
            revalidatePath('/citas-medicas');
            revalidatePath('/laboratorio');
            revalidatePath('/rayos-x');
            revalidatePath('/ultrasonidos');
            revalidatePath('/vacunas');
        }
        return result;
    } catch (error: any) {
        return { success: false, message: error.message || 'Error updating patient.' };
    }
}

// =====================================================================
// Delete Actions
// =====================================================================

export async function deleteAppointment(id: string) {
  try {
    const deletedFolio = await dataDeleteAppointment(id);
    await logActivity('Eliminación Cita Médica', `Se eliminó el folio: ${deletedFolio}.`);
    revalidatePath('/citas-medicas');
    revalidatePath('/admin');
    revalidatePath('/reports');
    return { success: true, message: 'Cita eliminada con éxito.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error desconocido al eliminar la cita.' };
  }
}

export async function deleteLabAppointment(id: string) {
  try {
    const deletedFolio = await dataDeleteLabAppointment(id);
    await logActivity('Eliminación Cita Laboratorio', `Se eliminó el folio: ${deletedFolio}.`);
    revalidatePath('/laboratorio');
    revalidatePath('/admin');
    revalidatePath('/reports');
    return { success: true, message: 'Cita de laboratorio eliminada con éxito.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error desconocido al eliminar la cita.' };
  }
}

export async function deleteXRayAppointment(id: string) {
  try {
    const deletedFolio = await dataDeleteXRayAppointment(id);
    await logActivity('Eliminación Cita Rayos X', `Se eliminó el folio: ${deletedFolio}.`);
    revalidatePath('/rayos-x');
    revalidatePath('/admin');
    revalidatePath('/reports');
    return { success: true, message: 'Cita de Rayos X eliminada con éxito.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error desconocido al eliminar la cita.' };
  }
}

export async function deleteUltrasoundAppointment(id: string) {
  try {
    const deletedFolio = await dataDeleteUltrasoundAppointment(id);
    await logActivity('Eliminación Cita Ultrasonido', `Se eliminó el folio: ${deletedFolio}.`);
    revalidatePath('/ultrasonidos');
    revalidatePath('/admin');
    revalidatePath('/reports');
    return { success: true, message: 'Cita de Ultrasonido eliminada con éxito.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error desconocido al eliminar la cita.' };
  }
}

export async function deleteVaccineAppointment(id: string) {
  try {
    const deletedFolio = await dataDeleteVaccineAppointment(id);
    await logActivity('Eliminación Cita Vacunación', `Se eliminó el folio: ${deletedFolio}.`);
    revalidatePath('/vacunas');
    revalidatePath('/admin');
    revalidatePath('/reports');
    return { success: true, message: 'Cita de Vacunación eliminada con éxito.' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error desconocido al eliminar la cita.' };
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

export async function verifyVaccinePassword(passwordAttempt: string) {
  const result = await dataVerifyVaccinePassword(passwordAttempt);
  if (result.isValid) {
    return { success: true };
  }
  return { success: false, message: result.error || 'Contraseña incorrecta.' };
}

export async function updateClinics(clinics: Clinic[]) {
  const result = await dataUpdateClinics(clinics);
  if (result.success) {
    await logActivity('Actualización de Clínicas', `Se actualizó el catálogo de clínicas.`);
    revalidatePath('/citas-medicas');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return result;
}

export async function updateColonias(colonias: Colonia[]) {
  const result = await dataUpdateColonias(colonias);
  if (result.success) {
    await logActivity('Actualización de Colonias', `Se actualizó el catálogo de colonias.`);
    revalidatePath('/citas-medicas');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return result;
}

export async function updateAnnouncements(announcements: string[]) {
  const result = await dataUpdateAnnouncements(announcements);
  if (result.success) {
    await logActivity('Actualización de Avisos', `Avisos actualizados.`);
    revalidatePath('/citas-medicas');
    revalidatePath('/laboratorio');
    revalidatePath('/rayos-x');
    revalidatePath('/ultrasonidos');
    revalidatePath('/vacunas');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return result;
}

// Lab
export async function updateLabSettings(settings: LabSettings) {
  const result = await dataUpdateLabSettings(settings);
  if (result.success) {
    await logActivity('Actualización Configuración Laboratorio', `Ajustes del laboratorio actualizados.`);
    revalidatePath('/laboratorio');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return result;
}

export async function updateLabStudies(studies: LabStudy[]) {
  const result = await dataUpdateLabStudies(studies);
  if (result.success) {
    await logActivity('Actualización Estudios de Laboratorio', `Catálogo de estudios de lab actualizado.`);
    revalidatePath('/laboratorio');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return result;
}

// X-Ray
export async function updateXRaySettings(settings: XRaySettings) {
  const result = await dataUpdateXRaySettings(settings);
  if (result.success) {
    await logActivity('Actualización Configuración Rayos X', `Ajustes de Rayos X actualizados.`);
    revalidatePath('/rayos-x');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return result;
}

export async function updateXRayStudies(studies: XRayStudy[]) {
  const result = await dataUpdateXRayStudies(studies);
  if (result.success) {
    await logActivity('Actualización Estudios de Rayos X', `Catálogo de estudios de Rayos X actualizado.`);
    revalidatePath('/rayos-x');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return result;
}

// Ultrasound
export async function updateUltrasoundSettings(settings: UltrasoundSettings) {
  const result = await dataUpdateUltrasoundSettings(settings);
  if (result.success) {
    await logActivity('Actualización Configuración Ultrasonido', `Ajustes de Ultrasonido actualizados.`);
    revalidatePath('/ultrasonidos');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return result;
}

export async function updateUltrasoundStudies(studies: UltrasoundStudy[]) {
  const result = await dataUpdateUltrasoundStudies(studies);
  if (result.success) {
    await logActivity('Actualización Estudios de Ultrasonido', `Catálogo de estudios de ultrasonido actualizado.`);
    revalidatePath('/ultrasonidos');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return result;
}

// Vaccine
export async function updateVaccineSettings(settings: VaccineSettings) {
  const result = await dataUpdateVaccineSettings(settings);
  if (result.success) {
    await logActivity('Actualización Configuración Vacunación', `Ajustes de Vacunación actualizados.`);
    revalidatePath('/vacunas');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return result;
}

export async function updateVaccines(vaccines: Vaccine[]) {
  const result = await dataUpdateVaccines(vaccines);
  if (result.success) {
    await logActivity('Actualización de Vacunas', `Catálogo de vacunas actualizado.`);
    revalidatePath('/vacunas');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return result;
}

export async function updateModuleSettings(settings: ModuleSettings) {
    const result = await dataUpdateModuleSettings(settings);
    if (result.success) {
        await logActivity('Actualización de Módulos', `Configuración de módulos actualizada.`);
        revalidatePath('/', 'layout');
    }
    return result;
}

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'): Promise<{ success: boolean; message?: string }> {
    const result = await dataUpdateAppointmentStatus(appointmentId, status, type);
    if (result.success) {
        await logActivity('Actualización de Estado', `Cita en ${type} con ID ${appointmentId} actualizada a: ${status}.`);
        revalidatePath('/admin');
        revalidatePath('/reports');
    }
    return result;
}

export async function rescheduleAppointment(
  appointmentId: string,
  newDate: string,
  type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine'
): Promise<{ success: boolean; message: string; newTime?: string }> {
    try {
        const result = await dataRescheduleAppointment(appointmentId, newDate, type);
        if(result.success) {
            await logActivity('Cambio de Fecha Cita', `Cita ${appointmentId} movida a ${newDate}.`);
            revalidatePath('/admin');
            revalidatePath('/reports');
        }
        return result;
    } catch(e: any) {
        return { success: false, message: e.message || 'Ocurrió un error inesperado.' };
    }
}


// ========== Backup & Restore Actions ==========
export async function downloadBackupAction(): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const backupData = await createBackupData();
      return { success: true, data: backupData };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error al crear el respaldo.' };
    }
  }
  
export async function restoreBackupAction(backupData: any): Promise<{ success: boolean; message?: string; stats?: any }> {
  try {
    const stats = await restoreBackupData(backupData);
    await logActivity('Restauración de Respaldo', `Se restauraron un total de ${stats.addedCount} registros.`);
    revalidatePath('/', 'layout');
    return { success: true, stats, message: 'Restauración completada.' };
  } catch (e: any) {
    return { success: false, message: e.message || 'Error al restaurar el respaldo.' };
  }
}
  

export async function cleanupOldRecordsAction(): Promise<{ success: boolean; deletedCount?: number; message?: string }> {
    try {
        const { deletedCount } = await cleanupOldRecords();
        if (deletedCount > 0) {
            await logActivity('Limpieza de Registros', `Se eliminaron ${deletedCount} citas antiguas de meses anteriores.`);
        }
        revalidatePath('/admin', 'layout');
        return { success: true, deletedCount };
    } catch (e: any) {
        return { success: false, message: e.message || 'Error durante la limpieza de registros.' };
    }
}

export { 
    dataGetLogs as getLogs,
    dataGetClinics as getClinics, 
    dataGetColonias as getColonias, 
    dataGetAnnouncements as getAnnouncements, 
    dataGetUsers as getUsers,
    dataUpdateUsers as updateUsers,
    dataGetModuleSettings as getModuleSettings, 
    dataGetLabSettings as getLabSettings, 
    dataGetLabStudies as getLabStudies, 
    dataGetXRaySettings as getXRaySettings, 
    dataGetXRayStudies as getXRayStudies, 
    dataGetUltrasoundSettings as getUltrasoundSettings, 
    dataGetUltrasoundStudies as getUltrasoundStudies, 
    dataGetVaccineSettings as getVaccineSettings,
    dataGetVaccines as getVaccines,
    dataGetAppointments as getAppointments, 
    dataGetAppointmentsForClinic as getAppointmentsForClinic, 
    dataGetLabAppointments as getLabAppointments, 
    dataGetXRayAppointments as getXRayAppointments, 
    dataGetUltrasoundAppointments as getUltrasoundAppointments,
    dataGetVaccineAppointments as getVaccineAppointments,
};
