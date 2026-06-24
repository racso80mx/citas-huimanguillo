'use server';

import { revalidatePath } from 'next/cache';
import * as data from './data';
import type { 
    Patient, 
    PatientStatus, 
    Appointment, 
    AppointmentStatus, 
    Holiday, 
    SpecialActionDay, 
    Prescription, 
    Specialty, 
    ServiceType, 
    LabStudy, 
    LabSettings,
    XRayStudy, 
    XRaySettings,
    UltrasoundStudy, 
    UltrasoundSettings,
    Vaccine, 
    VaccineSettings,
    VaccineAppointment,
    MedicalConsultation,
    Cie10Record,
    ModuleSettings,
    AdminSettings,
    ArchiveSettings,
    PharmacySettings,
    WarehouseSettings,
    BISettings
} from './definitions';

// --- MODULE SETTINGS ---
export async function getModuleSettings() { return data.getModuleSettings(); }
export async function updateModuleSettings(settings: ModuleSettings) { return data.updateModuleSettings(settings); }

// --- SERVICE TYPES ---
export async function getServiceTypes() { return data.getServiceTypes(); }
export async function updateServiceTypes(serviceTypes: ServiceType[]) { return data.updateServiceTypes(serviceTypes); }

// --- SPECIALTIES ---
export async function getSpecialties() { return data.getSpecialties(); }
export async function updateSpecialties(specialties: Specialty[]) { return data.updateSpecialties(specialties); }

// --- PATIENTS ---
export async function getPatients(options?: any) { return data.getPatients(options); }
export async function getPatientByCURP(curp: string) { return data.getPatientByCURP(curp); }
export async function savePatient(patient: Omit<Patient, 'id'>, id?: string) { return data.savePatient(patient, id); }
export async function updatePatient(id: string, patient: Partial<Patient>) { return data.updatePatient(id, patient); }
export async function updatePatientStatus(id: string, status: PatientStatus) { return data.updatePatientStatus(id, status); }
export async function deletePatient(id: string) { return data.deletePatient(id); }
export async function bulkInsertPatients(patients: any[]) { return data.bulkInsertPatients(patients); }
export async function deletePatients(ids: string[]) { return data.deletePatients(ids); }
export async function scanDuplicates(criteria: 'expediente' | 'curp' | 'name') { return data.scanDuplicates(criteria); }
export async function normalizeExpedientesAction() { return data.normalizeExpedientesAction(); }
export async function applyStatusUpdateChunk(expedientes: string[], status: PatientStatus) { return data.applyStatusUpdateChunk(expedientes, status); }

// --- APPOINTMENTS (GENERAL) ---
export async function getAppointments() { return data.getAppointments(); }
export async function saveNewAppointment(appointment: any, patient: any, isDouble: boolean, colonia: any) { return data.saveNewAppointment(appointment, patient, isDouble, colonia); }
export async function updateAppointmentStatus(id: string, status: AppointmentStatus, type: string) { return data.updateAppointmentStatus(id, status, type); }
export async function deleteAppointment(id: string) { return data.deleteAppointment(id); }
export async function getAppointmentsForCalendar(month: number, year: number) { return data.getAppointmentsForCalendar(month, year); }
export async function getAppointmentsForClinic(clinicId: string) { return data.getAppointmentsForClinic(clinicId); }
export async function getAttendedPatientsForClinic(clinicId: string) { return data.getAttendedPatientsForClinic(clinicId); }
export async function getAppointmentCountOnDate(clinicId: string, date: string) { return data.getAppointmentCountOnDate(clinicId, date); }
export async function rescheduleAppointment(id: string, newDate: string, type: string) { return data.rescheduleAppointment(id, newDate, type); }
export async function cloneAppointment(id: string, newDate: string, type: string, newTime?: string) { return data.cloneAppointment(id, newDate, type, newTime); }

// --- LAB, XRAY, US, VACCINE ---
export async function getLabAppointments() { return data.getLabAppointments(); }
export async function saveNewLabAppointment(app: any, patient: any) { return data.saveNewLabAppointment(app, patient); }
export async function deleteLabAppointment(id: string) { return data.deleteLabAppointment(id); }

export async function getXRayAppointments() { return data.getXRayAppointments(); }
export async function saveNewXRayAppointment(app: any, patient: any) { return data.saveNewXRayAppointment(app, patient); }
export async function deleteXRayAppointment(id: string) { return data.deleteXRayAppointment(id); }

export async function getUltrasoundAppointments() { return data.getUltrasoundAppointments(); }
export async function saveNewUltrasoundAppointment(app: any, patient: any) { return data.saveNewUltrasoundAppointment(app, patient); }
export async function deleteUltrasoundAppointment(id: string) { return data.deleteUltrasoundAppointment(id); }

export async function getVaccineAppointments() { return data.getVaccineAppointments(); }
export async function saveNewVaccineAppointment(app: any, patient: any) { return data.saveNewVaccineAppointment(app, patient); }
export async function deleteVaccineAppointment(id: string) { return data.deleteVaccineAppointment(id); }

// --- GLOBAL SETTINGS & CATALOGS ---
export async function getAnnouncements() { return data.getAnnouncements(); }
export async function updateAnnouncementsData(messages: string[]) { return data.updateAnnouncementsData(messages); }

export async function getClinics() { return data.getClinics(); }
export async function updateClinics(clinics: any[]) { return data.updateClinics(clinics); }
export async function deleteClinicData(id: string) { return data.deleteClinicData(id); }
export async function bulkInsertDoctors(doctors: any[]) { return data.bulkInsertDoctors(doctors); }

export async function getHolidays() { return data.getHolidays(); }
export async function updateHolidaysData(holidays: any[]) { return data.updateHolidaysData(holidays); }

export async function getSpecialActionDays() { return data.getSpecialActionDays(); }
export async function updateSpecialActionDaysData(days: any[]) { return data.updateSpecialActionDaysData(days); }

// --- AUTH SETTINGS ---
export async function getAdminSettings() { return data.getAdminSettings(); }
export async function updateAdminSettingsData(s: any) { return data.updateAdminSettingsData(s); }

export async function getArchiveSettings() { return data.getArchiveSettings(); }
export async function updateArchiveSettingsData(s: any) { return data.updateArchiveSettingsData(s); }

export async function getPharmacySettings() { return data.getPharmacySettings(); }
export async function updatePharmacySettingsData(s: any) { return data.updatePharmacySettingsData(s); }

export async function getWarehouseSettings() { return data.getWarehouseSettings(); }
export async function updateWarehouseSettingsData(s: any) { return data.updateWarehouseSettingsData(s); }

export async function getBISettings() { return data.getBISettings(); }
export async function updateBISettingsData(s: any) { return data.updateBISettingsData(s); }

// --- INVENTORY ---
export async function getMedications() { return data.getMedications(); }
export async function bulkInsertMedications(m: any[]) { return data.bulkInsertMedications(m); }
export async function deleteAllMedications() { return data.deleteAllMedications(); }

export async function getSupplies() { return data.getSupplies(); }
export async function bulkInsertSupplies(m: any[]) { return data.bulkInsertSupplies(m); }
export async function deleteAllSupplies() { return data.deleteAllSupplies(); }

// --- BI & BACKUP ---
export async function getBIData() { return data.getBIData(); }
export async function logActivity(action: string, details: string) { return data.logActivity(action, details); }
export async function getLogs() { return data.getLogs(); }
export async function cleanupOldRecords() { return data.cleanupOldRecords(); }
export async function downloadBackupAction() { return data.downloadBackupAction(); }

// --- CIE-10 LOGIC ---
export async function bulkInsertCie10Glossary(items: any[]) { return data.bulkInsertCie10Glossary(items); }
export async function bulkInsertCie10Catalog(items: any[]) { return data.bulkInsertCie10Catalog(items); }
export async function deleteAllCie10Glossary() { return data.deleteAllCie10Glossary(); }
export async function deleteAllCie10Catalog() { return data.deleteAllCie10Catalog(); }
export async function searchCie10(term: string) { return data.searchCie10(term); }

// --- MEDICAL LOGIC ---
export async function saveMedicalConsultationReal(c: any) { return data.saveMedicalConsultationReal(c); }
export async function getConsultationsByPatientId(id: string) { return data.getConsultationsByPatientIdReal(id); }
export async function getPrescriptionsByPatientId(id: string) { return data.getPrescriptionsByPatientId(id); }
export async function getPendingPrescriptionsReal(filters?: any) { return data.getPendingPrescriptionsReal(filters); }

export async function createPrescriptionReal(p: any) { return data.createPrescriptionReal(p); }
export async function updatePrescriptionReal(id: string, p: any) { return data.updatePrescriptionReal(id, p); }
export async function dispensePrescriptionReal(id: string, items: any[]) { return data.dispensePrescriptionReal(id, items); }
export async function deletePrescriptionReal(id: string) { return data.deletePrescriptionReal(id); }
export async function deleteMedicalConsultationReal(id: string) { return data.deleteMedicalConsultationReal(id); }
export async function getPrescriptionHistoryReal(filters?: any) { return data.getPrescriptionHistoryReal(filters); }
export async function getPatientPrescriptionsCountTodayAction(patientId: string) { return data.getPatientPrescriptionsCountToday(patientId); }
