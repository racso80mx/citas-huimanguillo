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
  logActivity,
  getClinicById,
  getAvailableSlotsForDate as dataGetAvailableSlotsForDate,
  getPatients as dataGetPatients,
  deletePatient as dataDeletePatient,
  updatePatientStatus as dataUpdatePatientStatus,
  savePatient as dataSavePatient,
  bulkInsertPatients as dataBulkInsertPatients,
  getArchiveSettings as dataGetArchiveSettings,
  updateArchiveSettings as dataUpdateArchiveSettings,
  verifyArchivePassword as dataVerifyArchivePassword,
} from './data';
import { v4 as uuidv4 } from 'uuid';
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
  ArchiveSettings,
  PatientStatus,
} from './definitions';

export async function getAvailableSlotsForDate(clinicId: string, date: string) {
    return dataGetAvailableSlotsForDate(clinicId, date);
}

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
  appointmentData: Omit<Appointment, 'id' | 'patientId' | 'patient' | 'appointmentNumber' | 'coloniaName'>,
  patientData: Omit<Patient, 'id'>,
  coloniaName: string | undefined
) {
  try {
    const result = await dataSaveAppointment(appointmentData, patientData, coloniaName);
    
    if (!result.success || !result.data) {
        throw new Error(result.error || "La capa de datos no devolvió los datos esperados.");
    }
        
    await logActivity('Creación Cita Médica', `Folio ${result.data.appointment.appointmentNumber} para ${patientData.name}.`);
    revalidatePath('/', 'layout');
    return { success: true, data: result.data };
  } catch (e: any) {
    console.error("Action Error: saveNewAppointment", e);
    return { success: false, error: e.message || 'Error al guardar la cita.' };
  }
}

export async function saveNewLabAppointment(
  appointmentData: Omit<LabAppointment, 'id' | 'patientId' | 'patient'>,
  patientData: Omit<Patient, 'id'>,
) {
  try {
    const result = await dataSaveLabAppointment(appointmentData, patientData);
    
     if (!result.success || !result.data) {
        throw new Error(result.error || "La capa de datos no devolvió los datos esperados.");
    }

    await logActivity('Creación Cita Laboratorio', `Folio ${result.data.appointmentNumber} para ${patientData.name}.`);
    revalidatePath('/', 'layout');
    return { success: true, data: result.data };
  } catch (e: any) {
    console.error("Action Error: saveNewLabAppointment", e);
    return {
      success: false,
      error: e.message || 'Error al guardar la cita de laboratorio.',
    };
  }
}

export async function saveNewXRayAppointment(
  appointmentData: Omit<XRayAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>,
) {
  try {
    const result = await dataSaveXRayAppointment(appointmentData, patientData);
    
    if (!result.success || !result.data) {
        throw new Error(result.error || "La capa de datos no devolvió los datos esperados.");
    }
    
    await logActivity('Creación Cita Rayos X', `Folio ${result.data.appointment.appointmentNumber} para ${patientData.name}.`);
    revalidatePath('/', 'layout');
    return { success: true, data: result.data };
  } catch (e: any) {
    console.error("Action Error: saveNewXRayAppointment", e);
    return {
      success: false,
      error: e.message || 'Error al guardar la cita de Rayos X.',
    };
  }
}

export async function saveNewUltrasoundAppointment(
  appointmentData: Omit<UltrasoundAppointment, 'id' | 'patientId' | 'patient' | 'status'>,
  patientData: Omit<Patient, 'id'>,
) {
  try {
    const result = await dataSaveUltrasoundAppointment(appointmentData, patientData);
    
    if (!result.success || !result.data) {
        throw new Error(result.error || "La capa de datos no devolvió los datos esperados.");
    }
    
    await logActivity('Creación Cita Ultrasonido', `Folio ${result.data.appointment.appointmentNumber} para ${patientData.name}.`);
    revalidatePath('/', 'layout');
    return { success: true, data: result.data };
  } catch (e: any) {
    console.error("Action Error: saveNewUltrasoundAppointment", e);
    return {
      success: false,
      error: e.message || 'Error al guardar la cita de Ultrasonido.',
    };
  }
}

export async function saveNewVaccineAppointment(
  appointmentData: Omit<VaccineAppointment, 'id' | 'patientId' | 'patient'>,
  patientData: Omit<Patient, 'id'>,
) {
  try {
    const result = await dataSaveVaccineAppointment(appointmentData, patientData);

    if (!result.success || !result.data) {
        throw new Error(result.error || "La capa de datos no devolvió los datos esperados.");
    }
    
    await logActivity('Creación Cita Vacunación', `Folio ${result.data.appointmentNumber} para ${patientData.name}.`);
    revalidatePath('/', 'layout');
    return { success: true, data: result.data };
  } catch (e: any) {
    console.error("Action Error: saveNewVaccineAppointment", e);
    return {
      success: false,
      error: e.message || 'Error al guardar la cita de Vacunación.',
    };
  }
}

// =====================================================================
// Admin & Other Actions
// =====================================================================

export async function cloneAppointment(originalAppointmentId: string, newDate: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine', newTimeOrToken?: string) {
    const result = await dataCloneAppointment(originalAppointmentId, newDate, type, newTimeOrToken);
    if(result.success) {
      await logActivity('Clonación de Cita', `Folio original ${result.originalFolio} clonado a nuevo folio ${result.data.appointmentNumber}.`);
      revalidatePath('/', 'layout');
    }
    return result;
}

export async function updatePatient(patientId: string, patientData: Partial<Omit<Patient, 'id'>>) {
    const result = await dataUpdatePatient(patientId, patientData);
    if (result.success) {
        await logActivity('Actualización de Paciente', `Datos del paciente con ID ${patientId} actualizados.`);
        revalidatePath('/', 'layout');
    }
    return result;
}

export async function deleteAppointment(id: string) { const deletedFolio = await dataDeleteAppointment(id); await logActivity('Eliminación Cita Médica', `Se eliminó el folio: ${deletedFolio}.`); revalidatePath('/', 'layout'); return { success: true }; }
export async function deleteLabAppointment(id: string) { const deletedFolio = await dataDeleteLabAppointment(id); await logActivity('Eliminación Cita Laboratorio', `Se eliminó el folio: ${deletedFolio}.`); revalidatePath('/', 'layout'); return { success: true }; }
export async function deleteXRayAppointment(id: string) { const deletedFolio = await dataDeleteXRayAppointment(id); await logActivity('Eliminación Cita Rayos X', `Se eliminó el folio: ${deletedFolio}.`); revalidatePath('/', 'layout'); return { success: true }; }
export async function deleteUltrasoundAppointment(id: string) { const deletedFolio = await dataDeleteUltrasoundAppointment(id); await logActivity('Eliminación Cita Ultrasonido', `Se eliminó el folio: ${deletedFolio}.`); revalidatePath('/', 'layout'); return { success: true }; }
export async function deleteVaccineAppointment(id: string) { const deletedFolio = await dataDeleteVaccineAppointment(id); await logActivity('Eliminación Cita Vacunación', `Se eliminó el folio: ${deletedFolio}.`); revalidatePath('/', 'layout'); return { success: true }; }

export async function verifyClinicPassword(clinicId: string, passwordAttempt: string) { const result = await dataVerifyClinicPassword(clinicId, passwordAttempt); return result.isValid ? { success: true } : { success: false, message: result.error || 'Contraseña incorrecta.' }; }
export async function verifyLabPassword(passwordAttempt: string) { const result = await dataVerifyLabPassword(passwordAttempt); return result.isValid ? { success: true } : { success: false, message: 'Contraseña incorrecta.' }; }
export async function verifyXRayPassword(passwordAttempt: string) { const result = await dataVerifyXRayPassword(passwordAttempt); return result.isValid ? { success: true } : { success: false, message: 'Contraseña incorrecta.' }; }
export async function verifyUltrasoundPassword(passwordAttempt: string) { const result = await dataVerifyUltrasoundPassword(passwordAttempt); return result.isValid ? { success: true } : { success: false, message: 'Contraseña incorrecta.' }; }
export async function verifyVaccinePassword(passwordAttempt: string) { const result = await dataVerifyVaccinePassword(passwordAttempt); return result.isValid ? { success: true } : { success: false, message: 'Contraseña incorrecta.' }; }

export async function updateClinics(clinics: Clinic[]) { const result = await dataUpdateClinics(clinics); if (result.success) { await logActivity('Actualización de Clínicas', `Se actualizó el catálogo de clínicas.`); revalidatePath('/', 'layout'); } return result; }
export async function updateColonias(colonias: Colonia[]) { const result = await dataUpdateColonias(colonias); if (result.success) { await logActivity('Actualización de Colonias', `Se actualizó el catálogo de colonias.`); revalidatePath('/', 'layout'); } return result; }
export async function updateAnnouncements(announcements: string[]) { const result = await dataUpdateAnnouncements(announcements); if (result.success) { await logActivity('Actualización de Avisos', `Avisos actualizados.`); revalidatePath('/', 'layout'); } return result; }
export async function updateLabSettings(settings: LabSettings) { const result = await dataUpdateLabSettings(settings); if (result.success) { await logActivity('Actualización Configuración Laboratorio', `Ajustes del laboratorio actualizados.`); revalidatePath('/', 'layout'); } return result; }
export async function updateLabStudies(studies: LabStudy[]) { const result = await dataUpdateLabStudies(studies); if (result.success) { await logActivity('Actualización Estudios de Laboratorio', `Catálogo de estudios de lab actualizado.`); revalidatePath('/', 'layout'); } return result; }
export async function updateXRaySettings(settings: XRaySettings) { const result = await dataUpdateXRaySettings(settings); if (result.success) { await logActivity('Actualización Configuración Rayos X', `Ajustes de Rayos X actualizados.`); revalidatePath('/', 'layout'); } return result; }
export async function updateXRayStudies(studies: XRayStudy[]) { const result = await dataUpdateXRayStudies(studies); if (result.success) { await logActivity('Actualización Estudios de Rayos X', `Catálogo de estudios de Rayos X actualizado.`); revalidatePath('/', 'layout'); } return result; }
export async function updateUltrasoundSettings(settings: UltrasoundSettings) { const result = await dataUpdateUltrasoundSettings(settings); if (result.success) { await logActivity('Actualización Configuración Ultrasonido', `Ajustes de Ultrasonido actualizados.`); revalidatePath('/', 'layout'); } return result; }
export async function updateUltrasoundStudies(studies: UltrasoundStudy[]) { const result = await dataUpdateUltrasoundStudies(studies); if (result.success) { await logActivity('Actualización Estudios de Ultrasonido', `Catálogo de estudios de ultrasonido actualizado.`); revalidatePath('/', 'layout'); } return result; }
export async function updateVaccineSettings(settings: VaccineSettings) { const result = await dataUpdateVaccineSettings(settings); if (result.success) { await logActivity('Actualización Configuración Vacunación', `Ajustes de Vacunación actualizados.`); revalidatePath('/', 'layout'); } return result; }
export async function updateVaccines(vaccines: Vaccine[]) { const result = await dataUpdateVaccines(vaccines); if (result.success) { await logActivity('Actualización de Vacunas', `Catálogo de vacunas actualizado.`); revalidatePath('/', 'layout'); } return result; }
export async function updateModuleSettings(settings: ModuleSettings) { const result = await dataUpdateModuleSettings(settings); if (result.success) { await logActivity('Actualización de Módulos', `Configuración de módulos actualizada.`); revalidatePath('/', 'layout'); } return result; }
export async function updateUsers(users: User[]) { const result = await dataUpdateUsers(users); if (result.success) { await logActivity('Actualización de Usuarios', `Se actualizó la lista de usuarios.`); revalidatePath('/admin'); } return result; }

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine') {
    const result = await dataUpdateAppointmentStatus(appointmentId, status, type);
    if (result.success) {
        await logActivity('Actualización de Estado', `Cita en ${type} con ID ${appointmentId} actualizada a: ${status}.`);
        revalidatePath('/', 'layout');
    }
    return result;
}

export async function rescheduleAppointment(appointmentId: string, newDate: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine') {
    const result = await dataRescheduleAppointment(appointmentId, newDate, type);
    if(result.success) {
        await logActivity('Cambio de Fecha Cita', `Cita ${appointmentId} movida a ${newDate}.`);
        revalidatePath('/', 'layout');
    }
    return result;
}

export async function getArchiveSettings() {
    return dataGetArchiveSettings();
}

export async function getPatients() { return dataGetPatients(); }
export async function deletePatient(patientId: string) { const result = await dataDeletePatient(patientId); if (result.success) { await logActivity('Eliminación Paciente', `Paciente con ID ${patientId} eliminado.`); revalidatePath('/archivo'); } return result; }
export async function updatePatientStatus(patientId: string, newStatus: PatientStatus) { const result = await dataUpdatePatientStatus(patientId, newStatus); if (result.success) { await logActivity('Actualización Estado Paciente', `Estado del paciente ${patientId} cambiado a ${newStatus}.`); revalidatePath('/archivo'); } return result; }
export async function savePatient(patient: Omit<Patient, 'id'>, id?: string) { const result = await dataSavePatient(patient, id); if (result.success) { await logActivity('Guardado de Paciente', `Paciente ${patient.name} ${patient.paternalLastName} guardado.`); revalidatePath('/archivo'); } return result; }
export async function bulkInsertPatients(patients: any[]) { const result = await dataBulkInsertPatients(patients); if(result.success) { await logActivity('Carga Masiva Pacientes', `Se procesaron ${result.processedCount} registros.`); revalidatePath('/archivo'); } return result; }
export async function updateArchiveSettings(settings: ArchiveSettings) { const result = await dataUpdateArchiveSettings(settings); if (result.success) { await logActivity('Actualización Contraseña Archivo', `Se actualizó la contraseña del módulo de archivo.`); revalidatePath('/admin', 'layout'); } return result; }

export async function verifyArchivePassword(passwordAttempt: string) { 
    const result = await dataVerifyArchivePassword(passwordAttempt);
    if(result.isValid) {
        return { success: true };
    }
    return { success: false, message: "Contraseña incorrecta." };
}

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
        revalidatePath('/', 'layout');
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
