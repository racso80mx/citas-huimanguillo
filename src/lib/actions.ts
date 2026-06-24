
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
    MedicalConsultation,
    Cie10Record
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
    revalidatePath('/reports');
    return res;
}

export async function deleteAppointment(id: string) {
    const res = await data.deleteAppointment(id);
    revalidatePath('/reports');
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

export async function updateModuleSettings(settings: any) {
    const res = await data.updateModuleSettings(settings);
    if (res.success) revalidatePath('/');
    return res;
}

export async function verifyAdminPassword(password: string) {
    return data.verifyAdminPassword(password);
}

export async function verifyCitasMedicasPassword(password: string) {
    const settings = await data.getModuleSettings();
    return { success: settings.citasMedicasPassword === password };
}

// --- PRESCRIPTIONS ---
export async function createPrescription(p: any) {
    const res = await data.createPrescription(p);
    return res;
}

export async function updatePrescription(id: string, p: any) {
    const res = await data.updatePrescription(id, p);
    return res;
}

export async function deletePrescription(id: string) {
    const res = await data.deletePrescription(id);
    return res;
}

export async function getPendingPrescriptions(filters: any) {
    return data.getPendingPrescriptions(filters);
}

export async function getPrescriptionsByPatientId(id: string) {
    return data.getPrescriptionsByPatientId(id);
}

// --- CONSULTATIONS ---
export async function saveMedicalConsultation(c: any) {
    const res = await data.saveMedicalConsultation(c);
    return res;
}

export async function getConsultationsByPatientId(id: string) {
    return data.getConsultationsByPatientId(id);
}

export async function searchCie10(term: string) {
    return data.searchCie10(term);
}
