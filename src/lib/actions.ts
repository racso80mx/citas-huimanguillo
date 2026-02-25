'use server';

import { revalidatePath } from 'next/cache';
import * as data from './data';
import type { PatientStatus, AppointmentStatus } from './definitions';

// =====================================================================
// MAINTENANCE ACTIONS
// =====================================================================

export async function scanDuplicates(criteria: 'expediente' | 'curp' | 'name') {
  return data.findDuplicatePatients(criteria);
}

export async function applyStatusUpdateChunk(expedientes: string[], status: PatientStatus) {
  const res = await data.bulkUpdateStatusChunk(expedientes, status);
  if (res.success) {
    revalidatePath('/admin/duplicates');
    revalidatePath('/archivo');
  }
  return res;
}

// =====================================================================
// PATIENT ACTIONS
// =====================================================================

export async function getPatientByCURP(curp: string) {
  const p = await data.getPatientByCURP(curp);
  return p ? { success: true, data: p } : { success: false };
}

export async function getPatients(options?: any) {
  return data.getPatients();
}

export async function savePatient(patient: any, id?: string) {
  const res = await data.savePatient(patient, id);
  revalidatePath('/archivo');
  revalidatePath('/admin');
  return res;
}

export async function updatePatient(id: string, patientData: any) {
  const res = await data.updatePatient(id, patientData);
  revalidatePath('/archivo');
  revalidatePath('/admin');
  return res;
}

export async function deletePatient(id: string) {
  const res = await data.deletePatient(id);
  revalidatePath('/archivo');
  revalidatePath('/admin');
  return res;
}

export async function deletePatients(ids: string[]) {
  const res = await data.deletePatients(ids);
  revalidatePath('/admin/duplicates');
  revalidatePath('/archivo');
  revalidatePath('/admin');
  return res;
}

export async function updatePatientStatus(id: string, status: PatientStatus) {
  const res = await data.updatePatientStatus(id, status);
  revalidatePath('/archivo');
  revalidatePath('/admin');
  return res;
}

// =====================================================================
// APPOINTMENT ACTIONS
// =====================================================================

export async function getAppointments() { return data.getAppointments(); }
export async function getAppointmentsForClinic(clinicId: string) { return data.getAppointmentsForClinic(clinicId); }
export async function getLabAppointments() { return data.getLabAppointments(); }
export async function getXRayAppointments() { return data.getXRayAppointments(); }
export async function getUltrasoundAppointments() { return data.getUltrasoundAppointments(); }
export async function getVaccineAppointments() { return data.getVaccineAppointments(); }

export async function saveNewAppointment(appointment: any, patient: any, colonia: any) {
  const res = await data.saveAppointment(appointment, patient, colonia);
  if (res.success) {
    revalidatePath('/citas-medicas');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return res;
}

export async function saveNewLabAppointment(appointment: any, patient: any) {
  const res = await data.saveLabAppointment(appointment, patient);
  if (res.success) {
    revalidatePath('/laboratorio');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return res;
}

export async function saveNewXRayAppointment(appointment: any, patient: any) {
  const res = await data.saveNewXRayAppointment(appointment, patient);
  if (res.success) {
    revalidatePath('/rayos-x');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return res;
}

export async function saveNewUltrasoundAppointment(appointment: any, patient: any) {
  const res = await data.saveNewUltrasoundAppointment(appointment, patient);
  if (res.success) {
    revalidatePath('/ultrasonidos');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return res;
}

export async function saveNewVaccineAppointment(appointment: any, patient: any) {
  const res = await data.saveNewVaccineAppointment(appointment, patient);
  if (res.success) {
    revalidatePath('/vacunas');
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return res;
}

export async function deleteAppointment(id: string) {
  const res = await data.deleteAppointment(id);
  revalidatePath('/admin');
  revalidatePath('/reports');
  return { success: true, folio: res };
}

export async function deleteLabAppointment(id: string) {
  const res = await data.deleteLabAppointment(id);
  revalidatePath('/admin');
  revalidatePath('/reports');
  return { success: true, folio: res };
}

export async function deleteXRayAppointment(id: string) {
  const res = await data.deleteXRayAppointment(id);
  revalidatePath('/admin');
  revalidatePath('/reports');
  return { success: true, folio: res };
}

export async function deleteUltrasoundAppointment(id: string) {
  const res = await data.deleteUltrasoundAppointment(id);
  revalidatePath('/admin');
  revalidatePath('/reports');
  return { success: true, folio: res };
}

export async function deleteVaccineAppointment(id: string) {
  const res = await data.deleteVaccineAppointment(id);
  revalidatePath('/admin');
  revalidatePath('/reports');
  return { success: true, folio: res };
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus, type: string) {
  const res = await data.updateAppointmentStatus(id, status, type);
  revalidatePath('/admin');
  revalidatePath('/reports');
  return res;
}

export async function rescheduleAppointment(id: string, date: string, type: string) {
  const res = await data.rescheduleAppointment(id, date, type);
  if (res.success) {
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return res;
}

export async function cloneAppointment(id: string, date: string, type: string, time?: string) {
  const res = await data.cloneAppointment(id, date, type, time);
  if (res.success) {
    revalidatePath('/admin');
    revalidatePath('/reports');
  }
  return res;
}

export async function getAvailableSlotsForDate(clinicId: string, date: string) {
  return data.getAvailableSlotsForDate(clinicId, date);
}

// =====================================================================
// SETTINGS ACTIONS
// =====================================================================

export async function getClinics() { return data.getClinics(); }
export async function updateClinics(clinics: any[]) { return data.updateClinics(clinics); }
export async function getColonias() { return data.getColonias(); }
export async function updateColonias(colonias: any[]) { return data.updateColonias(colonias); }

export async function getAnnouncements() { return data.getAnnouncements(); }
export async function updateAnnouncements(messages: string[]) { return data.updateAnnouncements(messages); }

export async function getModuleSettings() { return data.getModuleSettings(); }
export async function updateModuleSettings(settings: any) { return data.updateModuleSettings(settings); }

export async function getLabSettings() { return data.getLabSettings(); }
export async function updateLabSettings(settings: any) { return data.updateLabSettings(settings); }
export async function getLabStudies() { return data.getLabStudies(); }
export async function updateLabStudies(studies: any[]) { return data.updateLabStudies(studies); }

export async function getXRaySettings() { return data.getXRaySettings(); }
export async function updateXRaySettings(settings: any) { return data.updateXRaySettings(settings); }
export async function getXRayStudies() { return data.getXRayStudies(); }
export async function updateXRayStudies(studies: any[]) { return data.updateXRayStudies(studies); }

export async function getUltrasoundSettings() { return data.getUltrasoundSettings(); }
export async function updateUltrasoundSettings(settings: any) { return data.updateUltrasoundSettings(settings); }
export async function getUltrasoundStudies() { return data.getUltrasoundStudies(); }
export async function updateUltrasoundStudies(studies: any[]) { return data.updateUltrasoundStudies(studies); }

export async function getVaccineSettings() { return data.getVaccineSettings(); }
export async function updateVaccineSettings(settings: any) { return data.updateVaccineSettings(settings); }
export async function getVaccines() { return data.getVaccines(); }
export async function updateVaccines(vaccines: any[]) { return data.updateVaccines(vaccines); }

export async function getUsers() { return data.getUsers(); }
export async function updateUsers(users: any[]) { return data.updateUsers(users); }

export async function getArchiveSettings() { return data.getArchiveSettings(); }
export async function updateArchiveSettings(settings: any) { return data.updateArchiveSettings(settings); }

// =====================================================================
// AUTH & LOGS ACTIONS
// =====================================================================

export async function verifyArchivePassword(password: string) { return data.verifyArchivePassword(password); }
export async function verifyClinicPassword(id: string, password: string) { return data.verifyClinicPassword(id, password); }
export async function verifyLabPassword(password: string) { return data.verifyLabPassword(password); }
export async function verifyXRayPassword(password: string) { return data.verifyXRayPassword(password); }
export async function verifyUltrasoundPassword(password: string) { return data.verifyUltrasoundPassword(password); }
export async function verifyVaccinePassword(password: string) { return data.verifyVaccinePassword(password); }

export async function getLogs() { return data.getLogs(); }

// =====================================================================
// DATA MANAGEMENT ACTIONS
// =====================================================================

export async function downloadBackupAction() {
  const backup = await data.createBackupData();
  return { success: true, data: backup };
}

export async function cleanupOldRecordsAction() {
  return data.cleanupOldRecords();
}

export async function bulkInsertPatients(chunk: any[]) {
  return data.bulkInsertPatients(chunk);
}

export async function getBIData() {
  const [
    appointments,
    labAppointments,
    xRayAppointments,
    ultrasoundAppointments,
    vaccineAppointments,
    clinics,
    colonias
  ] = await Promise.all([
    data.getAppointments(),
    data.getLabAppointments(),
    data.getXRayAppointments(),
    data.getUltrasoundAppointments(),
    data.getVaccineAppointments(),
    data.getClinics(),
    data.getColonias()
  ]);

  return {
    appointments,
    labAppointments,
    xRayAppointments,
    ultrasoundAppointments,
    vaccineAppointments,
    clinics,
    colonias
  };
}
