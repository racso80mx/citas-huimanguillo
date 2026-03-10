
'use server';

import { revalidatePath } from 'next/cache';
import * as data from './data';
import type { PatientStatus, AppointmentStatus, Holiday } from './definitions';

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

export async function getPatientCounts() {
  return data.getPatientCounts();
}

export async function getPatientByCURP(curp: string) {
  const p = await data.getPatientByCURP(curp);
  return p ? { success: true, data: p } : { success: false };
}

export async function getPatients(options?: { 
  status?: string, 
  searchName?: string, 
  searchCurp?: string, 
  searchExpediente?: string,
  limitNum?: number 
}) {
  return data.getPatients(options);
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
  const db = data.updatePatientStatus(id, status);
  revalidatePath('/archivo');
  revalidatePath('/admin');
  return db;
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
// PHARMACY ACTIONS
// =====================================================================

export async function getMedications() {
  return data.getMedications();
}

export async function bulkInsertMedications(chunk: any[]) {
  return data.bulkInsertMedications(chunk);
}

export async function deleteAllMedications() {
  return data.deleteAllMedications();
}

export async function getPharmacySettings() {
  return data.getPharmacySettings();
}

export async function updatePharmacySettings(settings: any) {
  const res = await data.updatePharmacySettings(settings);
  revalidatePath('/farmacia');
  return res;
}

export async function verifyPharmacyPassword(password: string) {
  return data.verifyPharmacyPassword(password);
}

// =====================================================================
// SETTINGS ACTIONS
// =====================================================================

export async function getClinics() { return data.getClinics(); }
export async function updateClinics(clinics: any[]) { 
  const res = await data.updateClinics(clinics);
  revalidatePath('/citas-medicas');
  revalidatePath('/admin');
  revalidatePath('/reports');
  revalidatePath('/archivo');
  return res;
}

export async function getColonias() { return data.getColonias(); }
export async function updateColonias(colonias: any[]) {
  const res = await data.updateColonias(colonias);
  revalidatePath('/citas-medicas');
  revalidatePath('/vacunas');
  revalidatePath('/admin');
  revalidatePath('/archivo');
  return res;
}

export async function getAnnouncements() { return data.getAnnouncements(); }
export async function updateAnnouncements(messages: string[]) {
  const res = await data.updateAnnouncements(messages);
  revalidatePath('/citas-medicas');
  revalidatePath('/laboratorio');
  revalidatePath('/rayos-x');
  revalidatePath('/ultrasonidos');
  revalidatePath('/vacunas');
  return res;
}

export async function getModuleSettings() { return data.getModuleSettings(); }
export async function updateModuleSettings(settings: any) {
  const res = await data.updateModuleSettings(settings);
  revalidatePath('/');
  revalidatePath('/admin');
  return res;
}

export async function getLabSettings() { return data.getLabSettings(); }
export async function updateLabSettings(settings: any) {
  const res = await data.updateLabSettings(settings);
  revalidatePath('/laboratorio');
  revalidatePath('/reports');
  return res;
}

export async function getLabStudies() { return data.getLabStudies(); }
export async function updateLabStudies(studies: any[]) {
  const res = await data.updateLabStudies(studies);
  revalidatePath('/laboratorio');
  revalidatePath('/reports');
  return res;
}

export async function getXRaySettings() { return data.getXRaySettings(); }
export async function updateXRaySettings(settings: any) {
  const res = await data.updateXRaySettings(settings);
  revalidatePath('/rayos-x');
  revalidatePath('/reports');
  return res;
}

export async function getXRayStudies() { return data.getXRayStudies(); }
export async function updateXRayStudies(studies: any[]) {
  const res = await data.updateXRayStudies(studies);
  revalidatePath('/rayos-x');
  revalidatePath('/reports');
  return res;
}

export async function getUltrasoundSettings() { return data.getUltrasoundSettings(); }
export async function updateUltrasoundSettings(settings: any) {
  const res = await data.updateUltrasoundSettings(settings);
  revalidatePath('/ultrasonidos');
  revalidatePath('/reports');
  return res;
}

export async function getUltrasoundStudies() { return data.getUltrasoundStudies(); }
export async function updateUltrasoundStudies(studies: any[]) {
  const res = await data.updateUltrasoundStudies(studies);
  revalidatePath('/ultrasonidos');
  revalidatePath('/reports');
  return res;
}

export async function getVaccineSettings() { return data.getVaccineSettings(); }
export async function updateVaccineSettings(settings: any) {
  const res = await data.updateVaccineSettings(settings);
  revalidatePath('/vacunas');
  revalidatePath('/reports');
  return res;
}

export async function getVaccines() { return data.getVaccines(); }
export async function updateVaccines(vaccines: any[]) {
  const res = await data.updateVaccines(vaccines);
  revalidatePath('/vacunas');
  revalidatePath('/reports');
  return res;
}

export async function getUsers() { return data.getUsers(); }
export async function updateUsers(users: any[]) { return data.updateUsers(users); }

export async function getArchiveSettings() { return data.getArchiveSettings(); }
export async function updateArchiveSettings(settings: any) {
  const res = await data.updateArchiveSettings(settings);
  revalidatePath('/archivo');
  return res;
}

export async function getHolidays() { return data.getHolidays(); }
export async function updateHolidays(holidays: Holiday[]) {
  const res = await data.updateHolidays(holidays);
  revalidatePath('/citas-medicas');
  revalidatePath('/laboratorio');
  revalidatePath('/rayos-x');
  revalidatePath('/ultrasonidos');
  revalidatePath('/vacunas');
  return res;
}

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
