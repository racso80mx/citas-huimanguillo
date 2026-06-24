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

// --- SERVICE TYPES ---
export async function getServiceTypes() {
    return data.getServiceTypes();
}

export async function updateServiceTypes(serviceTypes: ServiceType[]) {
    const res = await data.updateServiceTypes(serviceTypes);
    if (res.success) revalidatePath('/');
    return res;
}

// --- SPECIALTIES ---
export async function getSpecialties() {
    return data.getSpecialties();
}

export async function updateSpecialties(specialties: Specialty[]) {
    const res = await data.updateSpecialties(specialties);
    if (res.success) revalidatePath('/');
    return res;
}

// --- PATIENTS ---
export async function getPatients(options?: any) {
    return data.getPatients(options);
}

export async function getPatientByCURP(curp: string) {
    return data.getPatientByCURP(curp);
}

export async function savePatient(patient: Omit<Patient, 'id'>, id?: string) {
    const res = await data.savePatient(patient, id);
    if (res.success) revalidatePath('/archivo');
    return res;
}

export async function updatePatient(id: string, patient: Partial<Patient>) {
    const res = await data.updatePatient(id, patient);
    if (res.success) revalidatePath('/archivo');
    return res;
}

export async function updatePatientStatus(id: string, status: PatientStatus) {
    const res = await data.updatePatientStatus(id, status);
    if (res.success) revalidatePath('/archivo');
    return res;
}

export async function deletePatient(id: string) {
    const res = await data.deletePatient(id);
    if (res.success) revalidatePath('/archivo');
    return res;
}

export async function bulkInsertPatients(patients: any[]) {
    const res = await data.bulkInsertPatients(patients);
    if (res.success) revalidatePath('/archivo');
    return res;
}

export async function deletePatients(ids: string[]) {
    const res = await data.deletePatients(ids);
    if (res.success) revalidatePath('/archivo');
    return res;
}

export async function scanDuplicates(criteria: 'expediente' | 'curp' | 'name') {
    return data.scanDuplicates(criteria);
}

export async function normalizeExpedientesAction() {
    return data.normalizeExpedientesAction();
}

export async function applyStatusUpdateChunk(expedientes: string[], status: PatientStatus) {
    return data.applyStatusUpdateChunk(expedientes, status);
}

// --- APPOINTMENTS ---
export async function getAppointments() {
    return data.getAppointments();
}

export async function saveNewAppointment(appointment: any, patient: any, isDouble: boolean, colonia: any) {
    const res = await data.saveNewAppointment(appointment, patient, isDouble, colonia);
    if (res.success) revalidatePath('/citas-medicas');
    return res;
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus, type: string) {
    const res = await data.updateAppointmentStatus(id, status, type);
    revalidatePath('/admin');
    revalidatePath('/reports');
    return res;
}

export async function deleteAppointment(id: string) {
    const res = await data.deleteAppointment(id);
    revalidatePath('/admin');
    revalidatePath('/reports');
    return res;
}

export async function getAppointmentsForCalendar(month: number, year: number) {
    return data.getAppointmentsForCalendar(month, year);
}

export async function getAppointmentsForClinic(clinicId: string) {
    return data.getAppointmentsForClinic(clinicId);
}

export async function getAttendedPatientsForClinic(clinicId: string) {
    return data.getAttendedPatientsForClinic(clinicId);
}

export async function getAppointmentCountOnDate(clinicId: string, date: string) {
    return data.getAppointmentCountOnDate(clinicId, date);
}

export async function rescheduleAppointment(id: string, newDate: string, type: string) {
    const res = await data.rescheduleAppointment(id, newDate, type);
    revalidatePath('/admin');
    revalidatePath('/reports');
    return res;
}

export async function cloneAppointment(id: string, newDate: string, type: string, newTime?: string) {
    const res = await data.cloneAppointment(id, newDate, type, newTime);
    revalidatePath('/admin');
    revalidatePath('/reports');
    return res;
}

export async function getAvailableSlotsForDate(clinicId: string, date: string) {
    const allApps = await data.getAppointments();
    const clinics = await data.getClinics();
    const clinic = clinics.find(c => c.id === clinicId);
    if (!clinic) return { timeSlots: [], tokens: [] };

    const dateStr = date.split('T')[0];
    const booked = allApps.filter(a => a.clinicId === clinicId && a.date.split('T')[0] === dateStr);
    const takenTimes = booked.map(a => a.time);

    if (clinic.bookingMode === 'token') {
        const tokens = Array.from({ length: clinic.dailySlots }, (_, i) => i + 1);
        const available = tokens.filter(t => !takenTimes.includes(`Ficha ${t}`));
        return { tokens: available };
    } else {
        const start = new Date(`1970-01-01T${clinic.startTime}:00`);
        const end = new Date(`1970-01-01T${clinic.endTime}:00`);
        const duration = clinic.consultationDuration || 30;
        const slots = [];
        let current = start;
        while (current < end) {
            const timeStr = current.toTimeString().substring(0, 5);
            if (!takenTimes.includes(timeStr) && timeStr !== clinic.breakTime) {
                slots.push(timeStr);
            }
            current = new Date(current.getTime() + duration * 60000);
        }
        return { timeSlots: slots };
    }
}

// --- OTHER SERVICES APPOINTMENTS ---
export async function getLabAppointments() { return data.getLabAppointmentsReal(); }
export async function saveNewLabAppointment(app: any, patient: any) { 
    const res = await data.saveNewLabAppointment(app, patient);
    revalidatePath('/laboratorio');
    return res;
}
export async function deleteLabAppointment(id: string) { 
    const res = await data.deleteLabAppointment(id);
    revalidatePath('/admin');
    return res;
}

export async function getXRayAppointments() { return data.getXRayAppointments(); }
export async function saveNewXRayAppointment(app: any, patient: any) { 
    const res = await data.saveNewXRayAppointment(app, patient);
    revalidatePath('/rayos-x');
    return res;
}
export async function deleteXRayAppointment(id: string) { 
    const res = await data.deleteXRayAppointment(id);
    revalidatePath('/admin');
    return res;
}

export async function getUltrasoundAppointments() { return data.getUltrasoundAppointments(); }
export async function saveNewUltrasoundAppointment(app: any, patient: any) { 
    const res = await data.saveNewUltrasoundAppointment(app, patient);
    revalidatePath('/ultrasonidos');
    return res;
}
export async function deleteUltrasoundAppointment(id: string) { 
    const res = await data.deleteUltrasoundAppointment(id);
    revalidatePath('/admin');
    return res;
}

export async function getVaccineAppointments() { return data.getVaccineAppointments(); }
export async function saveNewVaccineAppointment(app: any, patient: any) { 
    const res = await data.saveNewVaccineAppointment(app, patient);
    revalidatePath('/vacunas');
    return res;
}
export async function deleteVaccineAppointment(id: string) { 
    const res = await data.deleteVaccineAppointment(id);
    revalidatePath('/admin');
    return res;
}

// --- SETTINGS & CONFIG ---
export async function getAnnouncements() {
    return data.getAnnouncements();
}

export async function updateAnnouncements(messages: string[]) {
    const res = await data.updateAnnouncements(messages);
    if (res.success) revalidatePath('/');
    return res;
}

export async function getClinics() {
    return data.getClinics();
}

export async function updateClinics(clinics: any[]) {
    const res = await data.updateClinics(clinics);
    if (res.success) revalidatePath('/');
    return res;
}

export async function deleteClinic(id: string) {
    const res = await data.deleteClinic(id);
    if (res.success) revalidatePath('/');
    return res;
}

export async function bulkInsertDoctors(doctors: any[]) {
    return data.bulkInsertDoctors(doctors);
}

export async function getHolidays() {
    return data.getHolidays();
}

export async function updateHolidays(holidays: Holiday[]) {
    const res = await data.updateHolidays(holidays);
    if (res.success) revalidatePath('/');
    return res;
}

export async function getSpecialActionDays() {
    return data.getSpecialActionDays();
}

export async function updateSpecialActionDays(days: SpecialActionDay[]) {
    const res = await data.updateSpecialActionDays(days);
    if (res.success) revalidatePath('/');
    return res;
}

export async function getModuleSettings() {
    return data.getModuleSettings();
}

export async function updateModuleSettings(settings: ModuleSettings) {
    const res = await data.updateModuleSettings(settings);
    if (res.success) revalidatePath('/');
    return res;
}

// --- MODULE SPECIFIC SETTINGS ---
export async function getAdminSettings() { return data.getAdminSettings(); }
export async function updateAdminSettings(s: AdminSettings) { return data.updateAdminSettings(s); }

export async function getArchiveSettings() { return data.getArchiveSettings(); }
export async function updateArchiveSettings(s: ArchiveSettings) { return data.updateArchiveSettings(s); }

export async function getPharmacySettings() { return data.getPharmacySettings(); }
export async function updatePharmacySettings(s: PharmacySettings) { return data.updatePharmacySettings(s); }

export async function getWarehouseSettings() { return data.getWarehouseSettings(); }
export async function updateWarehouseSettings(s: WarehouseSettings) { return data.updateWarehouseSettings(s); }

export async function getBISettings() { return data.getBISettings(); }
export async function updateBISettings(s: BISettings) { return data.updateBISettings(s); }

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

// --- CATALOGS ---
export async function getLabStudies() { return data.getLabStudies(); }
export async function updateLabStudies(s: LabStudy[]) { 
    const res = await data.updateLabStudies(s);
    revalidatePath('/laboratorio');
    return res;
}

export async function getXRayStudies() { return data.getXRayStudies(); }
export async function updateXRayStudies(s: XRayStudy[]) { 
    const res = await data.updateXRayStudies(s);
    revalidatePath('/rayos-x');
    return res;
}

export async function getUltrasoundStudies() { return data.getUltrasoundStudies(); }
export async function updateUltrasoundStudies(s: UltrasoundStudy[]) { 
    const res = await data.updateUltrasoundStudies(s);
    revalidatePath('/ultrasonidos');
    return res;
}

export async function getVaccines() { return data.getVaccines(); }
export async function updateVaccines(s: Vaccine[]) { 
    const res = await data.updateVaccines(s);
    revalidatePath('/vacunas');
    return res;
}

export async function getMedications() { return data.getMedications(); }
export async function bulkInsertMedications(m: any[]) { 
    const res = await data.bulkInsertMedications(m);
    revalidatePath('/archivo-consulta');
    revalidatePath('/farmacia');
    return res;
}
export async function deleteAllMedications() { 
    const res = await data.deleteAllMedications();
    revalidatePath('/farmacia');
    return res;
}

export async function getSupplies() { return data.getSupplies(); }
export async function bulkInsertSupplies(s: any[]) { 
    const res = await data.bulkInsertSupplies(s);
    revalidatePath('/archivo-consulta');
    revalidatePath('/almacen');
    return res;
}
export async function deleteAllSupplies() { 
    const res = await data.deleteAllSupplies();
    revalidatePath('/almacen');
    return res;
}

export async function getColoniasRaw() {
    return data.getColonias();
}

// --- BUSINESS INTELLIGENCE & LOGS ---
export async function getBIData() { return data.getBIData(); }
export async function logActivity(action: string, details: string) { return data.logActivity(action, details); }
export async function getLogs() { return data.getLogs(); }
export async function cleanupOldRecords() { 
    const res = await data.cleanupOldRecords();
    revalidatePath('/admin');
    return res;
}
export async function downloadBackupAction() { return data.downloadBackupAction(); }

// --- CIE-10 ---
export async function bulkInsertCie10Glossary(data_arr: any[]) { return data.bulkInsertCie10Glossary(data_arr); }
export async function bulkInsertCie10Catalog(data_arr: any[]) { return data.bulkInsertCie10Catalog(data_arr); }
export async function deleteAllCie10Glossary() { return data.deleteAllCie10Glossary(); }
export async function deleteAllCie10Catalog() { return data.deleteAllCie10Catalog(); }
export async function searchCie10(term: string) { return data.searchCie10(term); }

// --- CONSULTATIONS & PRESCRIPTIONS ---
export async function saveMedicalConsultation(c: any) { 
    const res = await data.saveMedicalConsultation(c);
    revalidatePath('/reports');
    return res;
}

export async function getConsultationsByPatientId(id: string) { return data.getConsultationsByPatientId(id); }
export async function getPrescriptionsByPatientId(id: string) { return data.getPrescriptionsByPatientId(id); }
export async function getPendingPrescriptions(f?: any) { return data.getPendingPrescriptions(f); }

export async function createPrescription(p: any) { 
    const res = await data.createPrescription(p);
    revalidatePath('/reports');
    revalidatePath('/farmacia');
    return res;
}

export async function updatePrescription(id: string, p: any) { 
    const res = await data.updatePrescription(id, p);
    revalidatePath('/reports');
    revalidatePath('/farmacia');
    return res;
}

export async function dispensePrescription(id: string, items: any[]) { 
    const res = await data.dispensePrescription(id, items);
    revalidatePath('/farmacia');
    revalidatePath('/reports');
    return res;
}

export async function deletePrescription(id: string) { 
    const res = await data.deletePrescription(id);
    revalidatePath('/reports');
    return res;
}

export async function deleteMedicalConsultation(id: string) { 
    const res = await data.deleteMedicalConsultation(id);
    revalidatePath('/reports');
    return res;
}

export async function getPrescriptionHistory(f: any) { return data.getPrescriptionHistory(f); }
export async function getPatientPrescriptionsCountTodayAction(id: string) { return data.getPatientPrescriptionsCountToday(id); }

// --- SECURITY VERIFICATIONS ---
export async function verifyAdminPassword(p: string) { return data.verifyAdminPassword(p); }
export async function verifyCitasMedicasPassword(p: string) { return data.verifyCitasMedicasPassword(p); }
export async function verifyXRayPassword(p: string) { return data.verifyXRayPassword(p); }
export async function verifyUltrasoundPassword(p: string) { return data.verifyUltrasoundPassword(p); }
export async function verifyLabPassword(p: string) { return data.verifyLabPassword(p); }
export async function verifyVaccinePassword(p: string) { return data.verifyVaccinePassword(p); }
export async function verifyClinicPassword(id: string, p: string) {
    const clinics = await data.getClinics();
    const clinic = clinics.find(c => c.id === id);
    return { success: clinic?.password === p };
}
