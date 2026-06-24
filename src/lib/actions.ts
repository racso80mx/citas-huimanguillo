
'use server';

import { revalidatePath } from 'next/cache';
import * as data from './data';
import type { 
    Patient, 
    Appointment, 
    Holiday, 
    SpecialActionDay, 
    LabStudy, 
    LabSettings,
    XRayStudy, 
    XRaySettings,
    UltrasoundStudy, 
    UltrasoundSettings,
    Vaccine, 
    VaccineSettings,
    ModuleSettings,
    AdminSettings,
    ArchiveSettings,
    PharmacySettings,
    WarehouseSettings,
    BISettings,
    Clinic,
    Colonia,
    ServiceType,
    Specialty
} from './definitions';

// --- MÓDULOS ---
export async function getModuleSettings() { return data.getModuleSettings(); }
export async function updateModuleSettings(settings: ModuleSettings) { 
    const res = await data.updateModuleSettings(settings);
    revalidatePath('/');
    return res;
}

// --- CATÁLOGOS ---
export async function getServiceTypes() { return data.getServiceTypesData(); }
export async function updateServiceTypes(types: ServiceType[]) { return data.updateServiceTypes(types); }
export async function getSpecialties() { return data.getSpecialtiesData(); }
export async function updateSpecialties(specialties: Specialty[]) { return data.updateSpecialties(specialties); }

// --- PACIENTES ---
export async function getPatients(options?: any) { return data.getPatientsData(options); }
export async function getPatientCounts() { return data.getPatientCounts(); }
export async function savePatient(patient: Omit<Patient, 'id'>, id?: string) { return data.savePatient(patient, id); }
export async function updatePatient(id: string, patient: Partial<Patient>) { return data.updatePatient(id, patient); }
export async function updatePatientStatus(id: string, status: string) { return data.updatePatientStatus(id, status); }
export async function deletePatient(id: string) { return data.deletePatient(id); }
export async function deletePatients(ids: string[]) { return data.deletePatients(ids); }
export async function getPatientByCURP(curp: string) { return data.getPatientByCURP(curp); }

// --- CITAS ---
export async function getAppointments() { return data.getAppointmentsData(); }
export async function getLabAppointments() { return data.getLabAppointmentsData(); }
export async function getXRayAppointments() { return data.getXRayAppointmentsData(); }
export async function getUltrasoundAppointments() { return data.getUltrasoundAppointmentsData(); }
export async function getVaccineAppointments() { return data.getVaccineAppointmentsData(); }

export async function updateAppointmentStatus(appointmentId: string, status: string, type: any) {
    return data.updateAppointmentStatus(appointmentId, status, type);
}
export async function deleteAppointment(id: string) { return data.deleteAppointment(id); }
export async function deleteLabAppointment(id: string) { return data.deleteLabAppointment(id); }
export async function deleteXRayAppointment(id: string) { return data.deleteXRayAppointment(id); }
export async function deleteUltrasoundAppointment(id: string) { return data.deleteUltrasoundAppointment(id); }
export async function deleteVaccineAppointment(id: string) { return data.deleteVaccineAppointment(id); }

export async function rescheduleAppointment(id: string, date: string, type: any) { return data.rescheduleAppointment(id, date, type); }
export async function cloneAppointment(id: string, date: string, type: any, time?: string) { return data.cloneAppointment(id, date, type, time); }
export async function getAppointmentsForCalendar(month: number, year: number) { return data.getAppointmentsForCalendar(month, year); }
export async function getAppointmentsForClinic(clinicId: string) { return data.getAppointmentsForClinic(clinicId); }
export async function getAvailableSlotsForDate(clinicId: string, date: string) { return data.getAvailableSlotsForDate(clinicId, date); }

export async function saveNewAppointment(appointment: any, patient: any, isDouble: boolean, colonia?: string) {
    return data.saveNewAppointment(appointment, patient, isDouble, colonia);
}
export async function saveNewLabAppointment(appointment: any, patient: any) { return data.saveNewLabAppointment(appointment, patient); }
export async function saveNewXRayAppointment(appointment: any, patient: any) { return data.saveNewXRayAppointment(appointment, patient); }
export async function saveNewUltrasoundAppointment(appointment: any, patient: any) { return data.saveNewUltrasoundAppointment(appointment, patient); }
export async function saveNewVaccineAppointment(appointment: any, patient: any) { return data.saveNewVaccineAppointment(appointment, patient); }

// --- CLÍNICAS Y COLONIAS ---
export async function getClinics() { return data.getClinicsData(); }
export async function updateClinics(clinics: Clinic[]) { return data.updateClinics(clinics); }
export async function deleteClinic(id: string) { return data.deleteClinic(id); }
export async function getColonias() { return data.getColoniasData(); }
export async function updateColonias(colonias: Colonia[]) { return data.updateColonias(colonias); }

// --- BULK INSERTS & MANTENIMIENTO ---
export async function bulkInsertPatients(patients: any[]) { return data.bulkInsertPatients(patients); }
export async function bulkInsertDoctors(doctors: any[]) { return data.bulkInsertDoctors(doctors); }
export async function scanDuplicates(criteria: string) { return data.scanDuplicates(criteria); }
export async function applyStatusUpdateChunk(expedientes: string[], status: string) { return data.applyStatusUpdateChunk(expedientes, status); }
export async function normalizeExpedientesAction() { return data.normalizeExpedientesAction(); }
export async function downloadBackupAction() { return data.downloadBackupAction(); }
export async function cleanupOldRecords() { return data.cleanupOldRecords(); }

export async function bulkInsertCie10Glossary(items: any[]) { return data.bulkInsertCie10Glossary(items); }
export async function bulkInsertCie10Catalog(items: any[]) { return data.bulkInsertCie10Catalog(items); }
export async function deleteAllCie10Glossary() { return data.deleteAllCie10Glossary(); }
export async function deleteAllCie10Catalog() { return data.deleteAllCie10Catalog(); }

// --- SEGURIDAD ---
export async function getAdminSettings() { return data.getAdminSettingsData(); }
export async function updateAdminSettings(settings: AdminSettings) { return data.updateAdminSettings(settings); }
export async function getArchiveSettings() { return data.getArchiveSettingsData(); }
export async function updateArchiveSettings(settings: ArchiveSettings) { return data.updateArchiveSettings(settings); }
export async function getPharmacySettings() { return data.getPharmacySettingsData(); }
export async function updatePharmacySettings(settings: PharmacySettings) { return data.updatePharmacySettings(settings); }
export async function getWarehouseSettings() { return data.getWarehouseSettingsData(); }
export async function updateWarehouseSettings(settings: WarehouseSettings) { return data.updateWarehouseSettings(settings); }
export async function getBISettings() { return data.getBISettingsData(); }
export async function updateBISettings(settings: BISettings) { return data.updateBISettings(settings); }

export async function verifyAdminPassword(p: string) { return data.verifyAdminPassword(p); }
export async function verifyArchivePassword(p: string) { return data.verifyArchivePassword(p); }
export async function verifyPharmacyPassword(p: string) { return data.verifyPharmacyPassword(p); }
export async function verifyWarehousePassword(p: string) { return data.verifyWarehousePassword(p); }
export async function verifyBIPassword(p: string) { return data.verifyBIPassword(p); }
export async function verifyCitasMedicasPassword(p: string) { return data.verifyCitasMedicasPassword(p); }
export async function verifyLabPassword(p: string) { return data.verifyLabPassword(p); }
export async function verifyXRayPassword(p: string) { return data.verifyXRayPassword(p); }
export async function verifyUltrasoundPassword(p: string) { return data.verifyUltrasoundPassword(p); }
export async function verifyVaccinePassword(p: string) { return data.verifyVaccinePassword(p); }
export async function verifyClinicPassword(id: string, p: string) { return data.verifyClinicPassword(id, p); }

// --- LOGS ---
export async function getLogs() { return data.getLogsData(); }
export async function logActivity(action: string, details: string) { return data.logActivity(action, details); }

// --- CONSULTAS Y RECETAS ---
export async function getConsultationsByPatientId(patientId: string) { return data.getConsultationsByPatientId(patientId); }
export async function saveMedicalConsultation(consultation: any) { return data.saveMedicalConsultation(consultation); }
export async function deleteMedicalConsultation(id: string) { return data.deleteMedicalConsultation(id); }
export async function getConsultationByAppointmentId(appId: string) { return data.getConsultationByAppointmentId(appId); }

export async function getPrescriptionsByPatientId(patientId: string) { return data.getPrescriptionsByPatientId(patientId); }
export async function createPrescription(p: any) { return data.createPrescription(p); }
export async function updatePrescription(id: string, p: any) { return data.updatePrescription(id, p); }
export async function deletePrescription(id: string) { return data.deletePrescription(id); }
export async function dispensePrescription(id: string, items: any[]) { return data.dispensePrescription(id, items); }

// --- OTROS ---
export async function getAnnouncements() { return data.getAnnouncementsData(); }
export async function updateAnnouncements(messages: string[]) { return data.updateAnnouncements(messages); }
export async function getHolidays() { return data.getHolidaysData(); }
export async function updateHolidays(holidays: Holiday[]) { return data.updateHolidays(holidays); }
export async function getSpecialActionDays() { return data.getSpecialActionDaysData(); }
export async function updateSpecialActionDays(items: SpecialActionDay[]) { return data.updateSpecialActionDays(items); }

export async function searchCie10(term: string) { return data.searchCie10Data(term); }
export async function getLabSettings() { return data.getLabSettings(); }
export async function updateLabSettings(s: LabSettings) { return data.updateLabSettings(s); }
export async function getXRaySettings() { return data.getXRaySettings(); }
export async function updateXRaySettings(s: XRaySettings) { return data.updateXRaySettings(s); }
export async function getUltrasoundSettings() { return data.getUltrasoundSettings(); }
export async function updateUltrasoundSettings(s: UltrasoundSettings) { return data.updateUltrasoundSettings(s); }
export async function getVaccineSettings() { return data.getVaccineSettings(); }
export async function updateVaccineSettings(s: VaccineSettings) { return data.updateVaccineSettings(s); }

export async function getLabStudies() { return data.getLabStudies(); }
export async function updateLabStudies(s: LabStudy[]) { return data.updateLabStudies(s); }
export async function getXRayStudies() { return data.getXRayStudies(); }
export async function updateXRayStudies(s: XRayStudy[]) { return data.updateXRayStudies(s); }
export async function getUltrasoundStudies() { return getRawCollection('ultrasoundStudies'); }
export async function updateUltrasoundStudies(s: UltrasoundStudy[]) { return data.updateUltrasoundStudies(s); }
export async function getVaccines() { return data.getVaccines(); }
export async function updateVaccines(v: Vaccine[]) { return data.updateVaccines(v); }

export async function getMedications() { return data.getMedications(); }
export async function bulkInsertMedications(meds: any[]) { return data.bulkInsertMedications(meds); }
export async function deleteAllMedications() { return data.deleteAllMedications(); }

export async function getSupplies() { return data.getSupplies(); }
export async function bulkInsertSupplies(supplies: any[]) { return data.bulkInsertSupplies(supplies); }
export async function deleteAllSupplies() { return data.deleteAllSupplies(); }

export async function getAttendedPatientsForClinic(clinicId: string) { return data.getAttendedPatientsForClinic(clinicId); }
export async function getPrescriptionHistory(filters: any) { return data.getPrescriptionHistory(filters); }
export async function getPendingPrescriptions(filters: any) { return data.getPendingPrescriptions(filters); }
export async function getPatientPrescriptionsCountTodayAction(patientId: string) { return data.getPatientPrescriptionsCountTodayAction(patientId); }
export async function getAppointmentCountOnDate(clinicId: string, date: string) { return data.getAppointmentCountOnDate(clinicId, date); }
