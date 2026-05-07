
'use server';

import { revalidatePath } from 'next/cache';
import * as data from './data';
import type { PatientStatus, AppointmentStatus, Holiday, SpecialActionDay, Prescription, Specialty, LabStudy, XRayStudy, UltrasoundStudy, Vaccine, MedicalConsultation } from './definitions';

/**
 * ARCHIVO DE ACCIONES DE SERVIDOR (SERVER ACTIONS)
 * Actúa como puente puro entre la UI y el módulo de datos.
 */

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

export async function normalizeExpedientesAction() {
  const res = await data.normalizePatientExpedientes();
  if (res.success) {
    revalidatePath('/admin/duplicates');
    revalidatePath('/archivo');
  }
  return res;
}

export async function getSpecialties() { return data.getSpecialties(); }
export async function updateSpecialties(specialties: Specialty[]) {
    const res = await data.updateSpecialties(specialties);
    if (res.success) revalidatePath('/admin');
    return res;
}

export async function bulkInsertDoctors(chunk: any[]) {
    const specialtiesData = await data.getSpecialties();
    const specialtiesList = specialtiesData.map(s => s.name);
    const res = await data.bulkInsertDoctors(chunk, specialtiesList);
    if (res.success) revalidatePath('/admin');
    return res;
}

export async function deleteClinic(id: string) {
    const res = await data.deleteClinic(id);
    if (res.success) revalidatePath('/admin');
    return res;
}

export async function getPatientCounts() { return data.getPatientCounts(); }
export async function getPatientByCURP(curp: string) {
  const p = await data.getPatientByCURP(curp);
  return p ? { success: true, data: p } : { success: false };
}
export async function getPatients(options?: any) { return data.getPatients(options); }
export async function savePatient(patient: any, id?: string) {
  const res = await data.savePatient(patient, id);
  revalidatePath('/archivo'); revalidatePath('/admin');
  return res;
}
export async function updatePatient(id: string, patientData: any) {
  const res = await data.updatePatient(id, patientData);
  revalidatePath('/archivo'); revalidatePath('/admin');
  return res;
}
export async function deletePatient(id: string) {
  const res = await data.deletePatient(id);
  revalidatePath('/archivo'); revalidatePath('/admin');
  return res;
}
export async function deletePatients(ids: string[]) {
  const res = await data.deletePatients(ids);
  revalidatePath('/admin/duplicates'); revalidatePath('/archivo'); revalidatePath('/admin');
  return res;
}
export async function updatePatientStatus(id: string, status: PatientStatus) {
  const res = await data.updatePatientStatus(id, status);
  revalidatePath('/archivo'); revalidatePath('/admin');
  return res;
}

export async function getAppointments() { return data.getAppointments(); }
export async function getAppointmentsForClinic(clinicId: string) { return data.getAppointmentsForClinic(clinicId); }
export async function getAppointmentsForCalendar(month: number, year: number) { return data.getAppointmentsForCalendar(month, year); }
export async function getLabAppointments() { return data.getLabAppointments(); }
export async function getXRayAppointments() { return data.getXRayAppointments(); }
export async function getUltrasoundAppointments() { return data.getUltrasoundAppointments(); }
export async function getVaccineAppointments() { return data.getVaccineAppointments(); }

export async function saveNewAppointment(appointment: any, patient: any, colonia: any) {
  const res = await data.saveAppointment(appointment, patient, colonia);
  if (res.success) { revalidatePath('/citas-medicas'); revalidatePath('/admin'); revalidatePath('/reports'); }
  return res;
}
export async function saveNewLabAppointment(appointment: any, patient: any) {
  const res = await data.saveLabAppointment(appointment, patient);
  if (res.success) { revalidatePath('/laboratorio'); revalidatePath('/admin'); revalidatePath('/reports'); }
  return res;
}
export async function saveNewXRayAppointment(appointment: any, patient: any) {
  const res = await data.saveNewXRayAppointment(appointment, patient);
  if (res.success) { revalidatePath('/rayos-x'); revalidatePath('/admin'); revalidatePath('/reports'); }
  return res;
}
export async function saveNewUltrasoundAppointment(appointment: any, patient: any) {
  const res = await data.saveNewUltrasoundAppointment(appointment, patient);
  if (res.success) { revalidatePath('/ultrasonidos'); revalidatePath('/admin'); revalidatePath('/reports'); }
  return res;
}
export async function saveNewVaccineAppointment(appointment: any, patient: any) {
  const res = await data.saveNewVaccineAppointment(appointment, patient);
  if (res.success) { revalidatePath('/vacunas'); revalidatePath('/admin'); revalidatePath('/reports'); }
  return res;
}

export async function deleteAppointment(id: string) { const folio = await data.deleteAppointment(id); revalidatePath('/admin'); revalidatePath('/reports'); return { success: true, folio }; }
export async function deleteLabAppointment(id: string) { const folio = await data.deleteLabAppointment(id); revalidatePath('/admin'); revalidatePath('/reports'); return { success: true, folio }; }
export async function deleteXRayAppointment(id: string) { const folio = await data.deleteXRayAppointment(id); revalidatePath('/admin'); revalidatePath('/reports'); return { success: true, folio }; }
export async function deleteUltrasoundAppointment(id: string) { const folio = await data.deleteUltrasoundAppointment(id); revalidatePath('/admin'); revalidatePath('/reports'); return { success: true, folio }; }
export async function deleteVaccineAppointment(id: string) { const folio = await data.deleteVaccineAppointment(id); revalidatePath('/admin'); revalidatePath('/reports'); return { success: true, folio }; }

export async function updateAppointmentStatus(id: string, status: AppointmentStatus, type: string) {
  const res = await data.updateAppointmentStatus(id, status, type);
  revalidatePath('/admin'); revalidatePath('/reports');
  return res;
}
export async function rescheduleAppointment(id: string, date: string, type: string) {
  const res = await data.rescheduleAppointment(id, date, type);
  if (res.success) { revalidatePath('/admin'); revalidatePath('/reports'); }
  return res;
}
export async function cloneAppointment(id: string, date: string, type: string, time?: string) {
  const res = await data.cloneAppointment(id, date, type, time);
  if (res.success) { revalidatePath('/admin'); revalidatePath('/reports'); }
  return res;
}
export async function getAvailableSlotsForDate(clinicId: string, date: string) { return data.getAvailableSlotsForDate(clinicId, date); }

export async function createPrescription(prescription: Omit<Prescription, 'id' | 'folio' | 'status'>) {
    const res = await data.createPrescription(prescription);
    if (res.success) { revalidatePath('/reports'); revalidatePath('/farmacia'); }
    return res;
}
export async function getPendingPrescriptions(filter?: any) { return data.getPendingPrescriptions(filter); }
export async function getPrescriptionHistory(filter: any) { return data.getPrescriptionHistory(filter); }
export async function dispensePrescription(prescriptionId: string, itemsToDispense?: any) {
    const res = await data.dispensePrescription(prescriptionId, itemsToDispense);
    if (res.success) { revalidatePath('/farmacia'); revalidatePath('/archivo-consulta'); }
    return res;
}
export async function getPatientPrescriptionsCountTodayAction(patientId: string) { return data.getPatientPrescriptionsCountToday(patientId); }

export async function getMedications() { return data.getMedications(); }
export async function bulkInsertMedications(chunk: any[]) { return data.bulkInsertMedications(chunk); }
export async function deleteAllMedications() { return data.deleteAllMedications(); }
export async function getSupplies() { return data.getSupplies(); }
export async function bulkInsertSupplies(chunk: any[]) { return data.bulkInsertSupplies(chunk); }
export async function deleteAllSupplies() { return data.deleteAllSupplies(); }

export async function getAnnouncements() { return data.getAnnouncements(); }
export async function updateAnnouncements(messages: string[]) {
  const res = await data.updateAnnouncements(messages);
  revalidatePath('/citas-medicas'); revalidatePath('/laboratorio'); revalidatePath('/rayos-x'); revalidatePath('/ultrasonidos'); revalidatePath('/vacunas');
  return res;
}

export async function getClinics() { return data.getClinics(); }
export async function updateClinics(clinics: any[]) { 
  const res = await data.updateClinics(clinics);
  revalidatePath('/citas-medicas'); revalidatePath('/admin'); revalidatePath('/reports'); revalidatePath('/archivo');
  return res;
}
export async function getColonias() { return data.getColonias(); }
export async function updateColonias(colonias: any[]) {
  const res = await data.updateColonias(colonias);
  revalidatePath('/citas-medicas'); revalidatePath('/vacunas'); revalidatePath('/admin'); revalidatePath('/archivo');
  return res;
}

export async function getModuleSettings() { 
  return data.getModuleSettings();
}
export async function updateModuleSettings(settings: any) {
  const res = await data.updateModuleSettings(settings);
  revalidatePath('/'); revalidatePath('/admin'); revalidatePath('/citas-medicas');
  return res;
}

export async function getLabSettings() { return data.getLabSettings(); }
export async function updateLabSettings(settings: any) {
  const res = await data.updateLabSettings(settings);
  revalidatePath('/laboratorio'); revalidatePath('/reports');
  return res;
}
export async function getLabStudies() { return data.getLabStudies(); }
export async function updateLabStudies(studies: LabStudy[]) { return data.updateLabStudies(studies); }

export async function getXRaySettings() { return data.getXRaySettings(); }
export async function updateXRaySettings(settings: any) {
  const res = await data.updateXRaySettings(settings);
  revalidatePath('/rayos-x'); revalidatePath('/reports');
  return res;
}
export async function getXRayStudies() { return data.getXRayStudies(); }
export async function updateXRayStudies(studies: XRayStudy[]) { return data.updateXRayStudies(studies); }

export async function getUltrasoundSettings() { return data.getUltrasoundSettings(); }
export async function updateUltrasoundSettings(settings: any) {
  const res = await data.updateUltrasoundSettings(settings);
  revalidatePath('/ultrasonidos'); revalidatePath('/reports');
  return res;
}
export async function getUltrasoundStudies() { return data.getUltrasoundStudies(); }
export async function updateUltrasoundStudies(studies: UltrasoundStudy[]) { return data.updateUltrasoundStudies(studies); }

export async function getVaccineSettings() { return data.getVaccineSettings(); }
export async function updateVaccineSettings(settings: any) {
  const res = await data.updateVaccineSettings(settings);
  revalidatePath('/vacunas'); revalidatePath('/reports');
  return res;
}
export async function getVaccines() { return data.getVaccines(); }
export async function updateVaccines(vaccines: Vaccine[]) { return data.updateVaccines(vaccines); }

export async function getArchiveSettings() { return data.getArchiveSettings(); }
export async function updateArchiveSettings(settings: any) {
  const res = await data.updateArchiveSettings(settings);
  revalidatePath('/archivo');
  return res;
}

export async function getPharmacySettings() { return data.getPharmacySettings(); }
export async function updatePharmacySettings(settings: any) {
  const res = await data.updatePharmacySettings(settings);
  revalidatePath('/farmacia');
  return res;
}

export async function getWarehouseSettings() { return data.getWarehouseSettings(); }
export async function updateWarehouseSettings(settings: any) {
  const res = await data.updateWarehouseSettings(settings);
  revalidatePath('/almacen');
  return res;
}

export async function getBISettings() { return data.getBISettings(); }
export async function updateBISettings(settings: any) {
  const res = await data.updateBISettings(settings);
  revalidatePath('/bi');
  return res;
}

export async function getAdminSettings() { return data.getAdminSettings(); }
export async function updateAdminSettings(settings: any) { return data.updateAdminSettings(settings); }

export async function getHolidays() { return data.getHolidays(); }
export async function updateHolidays(holidays: Holiday[]) {
  const res = await data.updateHolidays(holidays);
  revalidatePath('/citas-medicas'); revalidatePath('/laboratorio'); revalidatePath('/rayos-x'); revalidatePath('/ultrasonidos'); revalidatePath('/vacunas');
  return res;
}

export async function getSpecialActionDays() { return data.getSpecialActionDays(); }
export async function updateSpecialActionDays(items: SpecialActionDay[]) {
    const res = await data.updateSpecialActionDays(items);
    revalidatePath('/citas-medicas'); revalidatePath('/admin');
    return res;
}

export async function getUsers() { return data.getUsers(); }
export async function updateUsers(users: any[]) { return data.updateUsers(users); }

export async function verifyArchivePassword(p: string) { return data.verifyArchivePassword(p); }
export async function verifyPharmacyPassword(p: string) { return data.verifyPharmacyPassword(p); }
export async function verifyWarehousePassword(p: string) { return data.verifyWarehousePassword(p); }
export async function verifyClinicPassword(id: string, p: string) { return data.verifyClinicPassword(id, p); }
export async function verifyLabPassword(p: string) { return data.verifyLabPassword(p); }
export async function verifyXRayPassword(p: string) { return data.verifyXRayPassword(p); }
export async function verifyUltrasoundPassword(p: string) { return data.verifyUltrasoundPassword(p); }
export async function verifyVaccinePassword(p: string) { return data.verifyVaccinePassword(p); }
export async function verifyBIPassword(p: string) { return data.verifyBIPassword(p); }
export async function verifyAdminPassword(p: string) { return data.verifyAdminPassword(p); }
export async function verifyCitasMedicasPassword(p: string) { return data.verifyCitasMedicasPassword(p); }

export async function getLogs() { return data.getLogs(); }
export async function logActivity(action: string, details: string) { return data.logActivity(action, details); }

export async function downloadBackupAction() {
  const backup = await data.createBackupData();
  return { success: true, data: backup };
}

export async function cleanupOldRecords() {
  const res = await data.cleanupOldRecords();
  revalidatePath('/admin');
  return res;
}

export async function bulkInsertPatients(chunk: any[]) {
  const res = await data.bulkInsertPatients(chunk);
  revalidatePath('/archivo');
  return res;
}

export async function getAppointmentCountOnDate(clinicId: string, date: string) {
    return data.getAppointmentCountOnDate(clinicId, date);
}

export async function saveMedicalConsultation(consultation: Omit<MedicalConsultation, 'id'>) {
    const res = await data.saveMedicalConsultation(consultation);
    if (res.success) {
        revalidatePath('/reports');
    }
    return res;
}

export async function getConsultationByAppointmentId(id: string) {
    return data.getConsultationByAppointmentId(id);
}

export async function getConsultationsByPatientId(patientId: string) {
    return data.getConsultationsByPatientId(patientId);
}

export async function bulkInsertCie10Glossary(chunk: any[]) {
    return data.bulkInsertCie10Glossary(chunk);
}

export async function bulkInsertCie10Catalog(chunk: any[]) {
    return data.bulkInsertCie10Catalog(chunk);
}

export async function deleteAllCie10Glossary() {
    return data.deleteAllCie10Glossary();
}

export async function deleteAllCie10Catalog() {
    return data.deleteAllCie10Catalog();
}

export async function searchCie10(term: string) {
    return data.searchCie10(term);
}
