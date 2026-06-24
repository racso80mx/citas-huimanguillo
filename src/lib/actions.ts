
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
export async function updateServiceTypes(types: ServiceType[]) { 
    const res = await data.updateServiceTypes(types);
    revalidatePath('/admin');
    revalidatePath('/citas-medicas');
    return res;
}
export async function getSpecialties() { return data.getSpecialtiesData(); }
export async function updateSpecialties(specialties: Specialty[]) { 
    const res = await data.updateSpecialties(specialties);
    revalidatePath('/admin');
    return res;
}

// --- PACIENTES ---
export async function getPatients(options?: any) { return data.getPatientsData(options); }
export async function getPatientCounts() { return data.getPatientCounts(); }
export async function savePatient(patient: Omit<Patient, 'id'>, id?: string) { 
    const res = await data.savePatient(patient, id);
    revalidatePath('/archivo');
    return res;
}
export async function updatePatient(id: string, patient: Partial<Patient>) { 
    const res = await data.updatePatient(id, patient);
    revalidatePath('/archivo');
    return res;
}
export async function updatePatientStatus(id: string, status: string) { 
    const res = await data.updatePatientStatus(id, status);
    revalidatePath('/archivo');
    return res;
}
export async function deletePatient(id: string) { 
    const res = await data.deletePatient(id);
    revalidatePath('/archivo');
    return res;
}
export async function deletePatients(ids: string[]) { 
    const res = await data.deletePatients(ids);
    revalidatePath('/archivo');
    return res;
}
export async function getPatientByCURP(curp: string) { return data.getPatientByCURP(curp); }

// --- CITAS ---
export async function getAppointments() { return data.getAppointmentsData(); }
export async function getLabAppointments() { return data.getLabAppointmentsData(); }
export async function getXRayAppointments() { return data.getXRayAppointmentsData(); }
export async function getUltrasoundAppointments() { return data.getUltrasoundAppointmentsData(); }
export async function getVaccineAppointments() { return data.getVaccineAppointmentsData(); }

export async function updateAppointmentStatus(appointmentId: string, status: string, type: any) {
    const res = await data.updateAppointmentStatus(appointmentId, status, type);
    revalidatePath('/reports');
    return res;
}
export async function deleteAppointment(id: string) { 
    const res = await data.deleteAppointment(id);
    revalidatePath('/');
    return res;
}
export async function deleteLabAppointment(id: string) { 
    const res = await data.deleteLabAppointment(id);
    revalidatePath('/laboratorio');
    return res;
}
export async function deleteXRayAppointment(id: string) { 
    const res = await data.deleteXRayAppointment(id);
    revalidatePath('/rayos-x');
    return res;
}
export async function deleteUltrasoundAppointment(id: string) { 
    const res = await data.deleteUltrasoundAppointment(id);
    revalidatePath('/ultrasonidos');
    return res;
}
export async function deleteVaccineAppointment(id: string) { 
    const res = await data.deleteVaccineAppointment(id);
    revalidatePath('/vacunas');
    return res;
}

export async function rescheduleAppointment(id: string, date: string, type: any) { 
    const res = await data.rescheduleAppointment(id, date, type);
    revalidatePath('/reports');
    return res;
}
export async function cloneAppointment(id: string, date: string, type: any, time?: string) { 
    const res = await data.cloneAppointment(id, date, type, time);
    revalidatePath('/reports');
    return res;
}
export async function getAppointmentsForCalendar(month: number, year: number) { return data.getAppointmentsForCalendar(month, year); }
export async function getAppointmentsForClinic(clinicId: string) { return data.getAppointmentsForClinic(clinicId); }
export async function getAvailableSlotsForDate(clinicId: string, date: string) { return data.getAvailableSlotsForDate(clinicId, date); }

export async function saveNewAppointment(appointment: any, patient: any, isDouble: boolean, colonia?: string) {
    const res = await data.saveNewAppointment(appointment, patient, isDouble, colonia);
    revalidatePath('/citas-medicas');
    revalidatePath('/archivo');
    return res;
}
export async function saveNewLabAppointment(appointment: any, patient: any) { 
    const res = await data.saveNewLabAppointment(appointment, patient);
    revalidatePath('/laboratorio');
    return res;
}
export async function saveNewXRayAppointment(appointment: any, patient: any) { 
    const res = await data.saveNewXRayAppointment(appointment, patient);
    revalidatePath('/rayos-x');
    return res;
}
export async function saveNewUltrasoundAppointment(appointment: any, patient: any) { 
    const res = await data.saveNewUltrasoundAppointment(appointment, patient);
    revalidatePath('/ultrasonidos');
    return res;
}
export async function saveNewVaccineAppointment(appointment: any, patient: any) { 
    const res = await data.saveNewVaccineAppointment(appointment, patient);
    revalidatePath('/vacunas');
    return res;
}

// --- CLÍNICAS Y COLONIAS ---
export async function getClinics() { return data.getClinicsData(); }
export async function updateClinics(clinics: Clinic[]) { 
    const res = await data.updateClinics(clinics);
    revalidatePath('/admin');
    revalidatePath('/citas-medicas');
    return res;
}
export async function deleteClinic(id: string) { 
    const res = await data.deleteClinic(id);
    revalidatePath('/admin');
    return res;
}
export async function getColonias() { return data.getColoniasData(); }
export async function updateColonias(colonias: Colonia[]) { 
    const res = await data.updateColonias(colonias);
    revalidatePath('/admin');
    return res;
}

// --- BULK INSERTS & MANTENIMIENTO ---
export async function bulkInsertPatients(patients: any[]) { 
    const res = await data.bulkInsertPatients(patients);
    revalidatePath('/archivo');
    return res;
}
export async function bulkInsertDoctors(doctors: any[]) { 
    const res = await data.bulkInsertDoctors(doctors);
    revalidatePath('/admin');
    revalidatePath('/citas-medicas');
    return res;
}
export async function scanDuplicates(criteria: string) { return data.scanDuplicates(criteria); }
export async function applyStatusUpdateChunk(expedientes: string[], status: string) { 
    const res = await data.applyStatusUpdateChunk(expedientes, status);
    revalidatePath('/archivo');
    return res;
}
export async function normalizeExpedientesAction() { 
    const res = await data.normalizeExpedientesAction();
    revalidatePath('/archivo');
    return res;
}
export async function downloadBackupAction() { return data.downloadBackupAction(); }
export async function cleanupOldRecords() { 
    const res = await data.cleanupOldRecords();
    revalidatePath('/');
    return res;
}

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
export async function saveMedicalConsultation(consultation: any) { 
    const res = await data.saveMedicalConsultation(consultation);
    revalidatePath('/reports');
    return res;
}
export async function deleteMedicalConsultation(id: string) { 
    const res = await data.deleteMedicalConsultation(id);
    revalidatePath('/reports');
    return res;
}
export async function getConsultationByAppointmentId(appId: string) { return data.getConsultationByAppointmentId(appId); }

export async function getPrescriptionsByPatientId(patientId: string) { return data.getPrescriptionsByPatientId(patientId); }
export async function createPrescription(p: any) { 
    const res = await data.createPrescription(p);
    revalidatePath('/farmacia');
    return res;
}
export async function updatePrescription(id: string, p: any) { 
    const res = await data.updatePrescription(id, p);
    revalidatePath('/farmacia');
    return res;
}
export async function deletePrescription(id: string) { 
    const res = await data.deletePrescription(id);
    revalidatePath('/farmacia');
    return res;
}
export async function dispensePrescription(id: string, items: any[]) { 
    const res = await data.dispensePrescription(id, items);
    revalidatePath('/farmacia');
    return res;
}

export async function getPendingPrescriptions(filters: any) { return data.getPendingPrescriptions(filters); }
export async function getPrescriptionHistory(filters: any) { return data.getPrescriptionHistory(filters); }
export async function getPatientPrescriptionsCountTodayAction(patientId: string) { return data.getPatientPrescriptionsCountTodayAction(patientId); }
export async function getAppointmentCountOnDate(clinicId: string, date: string) { return data.getAppointmentCountOnDate(clinicId, date); }

// --- OTROS ---
export async function getAnnouncements() { return data.getAnnouncementsData(); }
export async function updateAnnouncements(messages: string[]) { 
    const res = await data.updateAnnouncements(messages);
    revalidatePath('/');
    return res;
}
export async function getHolidays() { return data.getHolidaysData(); }
export async function updateHolidays(holidays: Holiday[]) { 
    const res = await data.updateHolidays(holidays);
    revalidatePath('/');
    return res;
}
export async function getSpecialActionDays() { return data.getSpecialActionDaysData(); }
export async function updateSpecialActionDays(items: SpecialActionDay[]) { 
    const res = await data.updateSpecialActionDays(items);
    revalidatePath('/');
    return res;
}

export async function searchCie10(term: string) { return data.searchCie10Data(term); }
export async function getLabSettings() { return data.getLabSettings(); }
export async function updateLabSettings(s: LabSettings) { 
    const res = await data.updateLabSettings(s);
    revalidatePath('/laboratorio');
    return res;
}
export async function getXRaySettings() { return data.getXRaySettings(); }
export async function updateXRaySettings(s: XRaySettings) { 
    const res = await data.updateXRaySettings(s);
    revalidatePath('/rayos-x');
    return res;
}
export async function getUltrasoundSettings() { return data.getUltrasoundSettings(); }
export async function updateUltrasoundSettings(s: UltrasoundSettings) { 
    const res = await data.updateUltrasoundSettings(s);
    revalidatePath('/ultrasonidos');
    return res;
}
export async function getVaccineSettings() { return data.getVaccineSettings(); }
export async function updateVaccineSettings(s: VaccineSettings) { 
    const res = await data.updateVaccineSettings(s);
    revalidatePath('/vacunas');
    return res;
}

export async function getLabStudies() { return data.getLabStudies(); }
export async function updateLabStudies(s: LabStudy[]) { return data.updateLabStudies(s); }
export async function getXRayStudies() { return data.getXRayStudies(); }
export async function updateXRayStudies(s: XRayStudy[]) { return data.updateXRayStudies(s); }
export async function getUltrasoundStudies() { return data.getUltrasoundStudies(); }
export async function updateUltrasoundStudies(s: UltrasoundStudy[]) { return data.updateUltrasoundStudies(s); }
export async function getVaccines() { return data.getVaccines(); }
export async function updateVaccines(v: Vaccine[]) { return data.updateVaccines(v); }

export async function getMedications() { return data.getMedications(); }
export async function bulkInsertMedications(meds: any[]) { 
    const res = await data.bulkInsertMedications(meds);
    revalidatePath('/farmacia');
    return res;
}
export async function deleteAllMedications() { 
    const res = await data.deleteAllMedications();
    revalidatePath('/farmacia');
    return res;
}

export async function getSupplies() { return data.getSupplies(); }
export async function bulkInsertSupplies(supplies: any[]) { 
    const res = await data.bulkInsertSupplies(supplies);
    revalidatePath('/almacen');
    return res;
}
export async function deleteAllSupplies() { 
    const res = await data.deleteAllSupplies();
    revalidatePath('/almacen');
    return res;
}

export async function getAttendedPatientsForClinic(clinicId: string) { return data.getAttendedPatientsForClinic(clinicId); }
