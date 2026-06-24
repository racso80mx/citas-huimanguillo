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
    Medication,
    Supply,
    Clinic,
    Colonia,
    ServiceType,
    Specialty,
    Prescription,
} from './definitions';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  writeBatch, 
  orderBy, 
  serverTimestamp,
  getCountFromServer,
  increment,
  addDoc
} from 'firebase/firestore';
import { adminDb } from '@/firebase/server-config';
import { v4 as uuidv4 } from 'uuid';

// --- MÓDULOS ---
export async function getModuleSettings() { return data.getModuleSettings(); }
export async function updateModuleSettings(settings: ModuleSettings) { 
    const res = await data.updateModuleSettings(settings);
    revalidatePath('/');
    return res;
}

// --- CATÁLOGOS DINÁMICOS ---
export async function getServiceTypes() { return data.getServiceTypesData(); }
export async function updateServiceTypes(types: ServiceType[]) { return data.updateServiceTypesData(types); }
export async function getSpecialties() { return data.getSpecialtiesData(); }
export async function updateSpecialties(specs: Specialty[]) { return data.updateSpecialtiesData(specs); }

// --- PACIENTES ---
export async function getPatients(options?: any) { return data.getPatientsData(options); }
export async function bulkInsertPatients(patients: any[]) { return data.bulkInsertPatients(patients); }
export async function deletePatients(ids: string[]) { return data.deletePatients(ids); }
export async function scanDuplicates(criteria: 'expediente' | 'curp' | 'name') { return data.scanDuplicates(criteria); }
export async function normalizeExpedientesAction() { return data.normalizeExpedientesAction(); }
export async function applyStatusUpdateChunk(expedientes: string[], status: string) { return data.applyStatusUpdateChunk(expedientes, status); }

export async function getPatientByCURP(curp: string) {
    const q = query(collection(adminDb, 'patients'), where('curp', '==', curp.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) return { success: false };
    const p = snap.docs[0].data();
    return { success: true, data: data.serializeData(p) as Patient };
}

export async function savePatient(patient: Omit<Patient, 'id'>, id?: string) {
    const finalId = id || patient.curp;
    await setDoc(doc(adminDb, 'patients', finalId), { ...patient, id: finalId }, { merge: true });
    return { success: true, id: finalId };
}

export async function updatePatient(id: string, patient: Partial<Patient>) {
    await updateDoc(doc(adminDb, 'patients', id), patient);
    return { success: true };
}

export async function updatePatientStatus(id: string, status: string) {
    await updateDoc(doc(adminDb, 'patients', id), { status });
    return { success: true };
}

export async function deletePatient(id: string) {
    await deleteDoc(doc(adminDb, 'patients', id));
    return { success: true };
}

// --- CITAS MÉDICAS ---
export async function getAppointments() { return data.getAppointmentsData(); }
export async function getLabAppointments() { return data.getLabAppointmentsData(); }
export async function getXRayAppointments() { return data.getXRayAppointmentsData(); }
export async function getUltrasoundAppointments() { return data.getUltrasoundAppointmentsData(); }
export async function getVaccineAppointments() { return data.getVaccineAppointmentsData(); }

export async function saveNewAppointment(appointment: any, patient: any, isDouble: boolean, coloniaName?: string) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp;
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const aId = uuidv4();
    const finalApp = { ...appointment, id: aId, patientId: pId, patient, appointmentNumber: `MED-${uuidv4().split('-')[0].toUpperCase()}`, coloniaName, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'appointments', aId), finalApp);
    if (isDouble) {
        const nextId = uuidv4();
        const nextApp = { ...finalApp, id: nextId, appointmentNumber: `${finalApp.appointmentNumber}-B` };
        batch.set(doc(adminDb, 'appointments', nextId), nextApp);
    }
    await batch.commit();
    return { success: true, data: { appointment: finalApp, clinic: {} } };
}

export async function deleteAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'appointments', id));
    return { success: true };
}

// --- CLÍNICAS Y COLONIAS ---
export async function getClinics() { return data.getClinicsData(); }
export async function updateClinics(clinics: Clinic[]) { return data.updateClinicsData(clinics); }
export async function deleteClinic(id: string) { return data.deleteClinic(id); }
export async function getColonias() { return data.getColoniasData(); }
export async function updateColonias(colonias: Colonia[]) { return data.updateColoniasData(colonias); }

// --- CONFIGURACIÓN DE SEGURIDAD ---
export async function getAdminSettings() { return data.getAdminSettingsData(); }
export async function getArchiveSettings() { return data.getArchiveSettingsData(); }
export async function getPharmacySettings() { return data.getPharmacySettingsData(); }
export async function getWarehouseSettings() { return data.getWarehouseSettingsData(); }
export async function getBISettings() { return data.getBISettingsData(); }

export async function updateAdminSettings(settings: AdminSettings) { await setDoc(doc(adminDb, 'settings', 'admin'), settings); return { success: true }; }
export async function updateArchiveSettings(settings: ArchiveSettings) { await setDoc(doc(adminDb, 'settings', 'archive'), settings); return { success: true }; }
export async function updatePharmacySettings(settings: PharmacySettings) { await setDoc(doc(adminDb, 'settings', 'pharmacy'), settings); return { success: true }; }
export async function updateWarehouseSettings(settings: WarehouseSettings) { await setDoc(doc(adminDb, 'settings', 'warehouse'), settings); return { success: true }; }
export async function updateBISettings(settings: BISettings) { await setDoc(doc(adminDb, 'settings', 'bi'), settings); return { success: true }; }

// --- LOGS ---
export async function getLogs() { return data.getLogsData(); }
export async function logActivity(action: string, details: string) {
    await addDoc(collection(adminDb, 'activityLog'), { timestamp: serverTimestamp(), action, details });
    return { success: true };
}

// --- CIE-10 ---
export async function searchCie10(term: string) { return data.searchCie10Data(term); }

// --- OTROS ---
export async function getAnnouncements() { return data.getAnnouncementsData(); }
export async function getHolidays() { return data.getHolidaysData(); }
export async function getSpecialActionDays() { return data.getSpecialActionDaysData(); }
