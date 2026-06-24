
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
    Cie10Record,
    MedicalConsultation
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
  serverTimestamp,
  addDoc,
  orderBy,
  limit,
  increment
} from 'firebase/firestore';
import { adminDb } from '@/firebase/server-config';
import { v4 as uuidv4 } from 'uuid';

// --- MÓDULOS ---
export async function getModuleSettings() { return data.getModuleSettings(); }
export async function updateModuleSettings(settings: ModuleSettings) { 
    await setDoc(doc(adminDb, 'settings', 'moduleSettings'), settings);
    revalidatePath('/');
    return { success: true };
}

// --- CATÁLOGOS ---
export async function getServiceTypes() { return data.getServiceTypesData(); }
export async function updateServiceTypes(types: ServiceType[]) { 
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'serviceTypes'));
    snap.docs.forEach(d => batch.delete(d.ref));
    types.forEach(t => batch.set(doc(adminDb, 'serviceTypes', t.id), { ...t, name: t.name.toUpperCase() }));
    await batch.commit();
    return { success: true };
}

export async function getSpecialties() { return data.getSpecialtiesData(); }
export async function updateSpecialties(specialties: Specialty[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'specialties'));
    snap.docs.forEach(d => batch.delete(d.ref));
    specialties.forEach(s => batch.set(doc(adminDb, 'specialties', s.id), { ...s, name: s.name.toUpperCase() }));
    await batch.commit();
    return { success: true };
}

// --- PACIENTES ---
export async function getPatients(options?: any) { return data.getPatientsData(options); }
export async function getPatientCounts() { return data.getPatientCounts(); }

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
export async function deletePatients(ids: string[]) {
    const batch = writeBatch(adminDb);
    ids.forEach(id => batch.delete(doc(adminDb, 'patients', id)));
    await batch.commit();
    return { success: true };
}
export async function getPatientByCURP(curp: string) {
    const q = query(collection(adminDb, 'patients'), where('curp', '==', curp.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) return { success: false };
    return { success: true, data: data.serializeData(snap.docs[0].data()) as Patient };
}

// --- CITAS ---
export async function getAppointments() { return data.getAppointmentsData(); }
export async function getLabAppointments() { return data.getLabAppointmentsData(); }
export async function getXRayAppointments() { return data.getXRayAppointmentsData(); }
export async function getUltrasoundAppointments() { return data.getUltrasoundAppointmentsData(); }
export async function getVaccineAppointments() { return data.getVaccineAppointmentsData(); }

export async function updateAppointmentStatus(appointmentId: string, status: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine') {
    const coll = type === 'medical' ? 'appointments' : type === 'lab' ? 'labAppointments' : type === 'xray' ? 'xrayAppointments' : type === 'ultrasound' ? 'ultrasoundAppointments' : 'vaccineAppointments';
    await updateDoc(doc(adminDb, coll, appointmentId), { status });
    return { success: true };
}

export async function deleteAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'appointments', id));
    return { success: true };
}
export async function deleteLabAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'labAppointments', id));
    return { success: true };
}
export async function deleteXRayAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'xrayAppointments', id));
    return { success: true };
}
export async function deleteUltrasoundAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'ultrasoundAppointments', id));
    return { success: true };
}
export async function deleteVaccineAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'vaccineAppointments', id));
    return { success: true };
}

export async function rescheduleAppointment(id: string, date: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine') {
    const coll = type === 'medical' ? 'appointments' : type === 'lab' ? 'labAppointments' : type === 'xray' ? 'xrayAppointments' : type === 'ultrasound' ? 'ultrasoundAppointments' : 'vaccineAppointments';
    await updateDoc(doc(adminDb, coll, id), { date });
    return { success: true, message: 'Cita reprogramada.' };
}

export async function cloneAppointment(id: string, date: string, type: 'medical' | 'lab' | 'xray' | 'ultrasound' | 'vaccine', time?: string) {
    const coll = type === 'medical' ? 'appointments' : type === 'lab' ? 'labAppointments' : type === 'xray' ? 'xrayAppointments' : type === 'ultrasound' ? 'ultrasoundAppointments' : 'vaccineAppointments';
    const oldDoc = await getDoc(doc(adminDb, coll, id));
    if (!oldDoc.exists()) return { success: false, message: 'Cita original no encontrada.' };
    const oldData = oldDoc.data();
    const newId = uuidv4();
    const newData = { 
        ...oldData, 
        id: newId, 
        date, 
        time: time || oldData.time, 
        status: 'Agendada', 
        appointmentNumber: `${oldData.appointmentNumber.split('-')[0]}-${uuidv4().split('-')[0].toUpperCase()}`,
        createdAt: new Date().toISOString()
    };
    await setDoc(doc(adminDb, coll, newId), newData);
    return { success: true, message: 'Nueva cita asignada correctamente.' };
}

export async function getAppointmentsForCalendar(month: number, year: number) {
    const snap = await getDocs(collection(adminDb, 'appointments'));
    return snap.docs.map(d => data.serializeData(d.data()));
}

export async function getAppointmentsForClinic(clinicId: string) {
    return data.getAppointmentsForClinic(clinicId);
}

export async function getAvailableSlotsForDate(clinicId: string, date: string) {
    const start = data.startOfDay(new Date(date)).toISOString();
    const end = data.endOfDay(new Date(date)).toISOString();
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), where('date', '>=', start), where('date', '<=', end));
    const snap = await getDocs(q);
    const booked = snap.docs.map(d => d.data().time);
    const clinicSnap = await getDoc(doc(adminDb, 'clinics', clinicId));
    if (!clinicSnap.exists()) return { timeSlots: [] };
    const clinic = clinicSnap.data() as Clinic;
    
    if (clinic.bookingMode === 'token') {
        const tokens = Array.from({ length: clinic.dailySlots }, (_, i) => i + 1);
        return { tokens: tokens.filter(t => !booked.includes(`Ficha ${t}`)) };
    } else {
        const slots = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
        return { timeSlots: slots.filter(s => !booked.includes(s)) };
    }
}

export async function saveNewAppointment(appointment: any, patient: any, isDouble: boolean, colonia?: string) {
    const patientRef = doc(adminDb, 'patients', patient.curp);
    await setDoc(patientRef, { ...patient, id: patient.curp }, { merge: true });
    
    const id = uuidv4();
    const finalAppointment = {
        ...appointment,
        id,
        patientId: patient.curp,
        appointmentNumber: `MED-${uuidv4().split('-')[0].toUpperCase()}`,
        coloniaName: colonia || null,
        createdAt: new Date().toISOString()
    };
    
    await setDoc(doc(adminDb, 'appointments', id), finalAppointment);
    
    const clinic = (await getDoc(doc(adminDb, 'clinics', appointment.clinicId))).data() as Clinic;
    return { success: true, data: { appointment: { ...finalAppointment, patient }, clinic } };
}

export async function saveNewLabAppointment(appointment: any, patient: any) {
    const patientRef = doc(adminDb, 'patients', patient.curp);
    await setDoc(patientRef, { ...patient, id: patient.curp }, { merge: true });
    const id = uuidv4();
    const final = { ...appointment, id, patientId: patient.curp, createdAt: new Date().toISOString() };
    await setDoc(doc(adminDb, 'labAppointments', id), final);
    return { success: true, data: { ...final, patient } };
}

export async function saveNewXRayAppointment(appointment: any, patient: any) {
    const patientRef = doc(adminDb, 'patients', patient.curp);
    await setDoc(patientRef, { ...patient, id: patient.curp }, { merge: true });
    const id = uuidv4();
    const final = { ...appointment, id, patientId: patient.curp, createdAt: new Date().toISOString() };
    await setDoc(doc(adminDb, 'xrayAppointments', id), final);
    const study = (await getDoc(doc(adminDb, 'xRayStudies', appointment.studyId))).data() as XRayStudy;
    return { success: true, data: { appointment: { ...final, patient }, study } };
}

export async function saveNewUltrasoundAppointment(appointment: any, patient: any) {
    const patientRef = doc(adminDb, 'patients', patient.curp);
    await setDoc(patientRef, { ...patient, id: patient.curp }, { merge: true });
    const id = uuidv4();
    const final = { ...appointment, id, patientId: patient.curp, createdAt: new Date().toISOString() };
    await setDoc(doc(adminDb, 'ultrasoundAppointments', id), final);
    const study = (await getDoc(doc(adminDb, 'ultrasoundStudies', appointment.studyId))).data() as UltrasoundStudy;
    return { success: true, data: { appointment: { ...final, patient }, study } };
}

export async function saveNewVaccineAppointment(appointment: any, patient: any) {
    const patientRef = doc(adminDb, 'patients', patient.curp);
    await setDoc(patientRef, { ...patient, id: patient.curp }, { merge: true });
    const id = uuidv4();
    const final = { ...appointment, id, patientId: patient.curp, createdAt: new Date().toISOString() };
    await setDoc(doc(adminDb, 'vaccineAppointments', id), final);
    return { success: true, data: { ...final, patient } };
}

// --- CLÍNICAS ---
export async function getClinics() { return data.getClinicsData(); }
export async function updateClinics(clinics: Clinic[]) {
    const batch = writeBatch(adminDb);
    clinics.forEach(c => batch.set(doc(adminDb, 'clinics', c.id), c));
    await batch.commit();
    return { success: true };
}
export async function deleteClinic(id: string) {
    await deleteDoc(doc(adminDb, 'clinics', id));
    return { success: true };
}
export async function getColonias() { return data.getColoniasData(); }
export async function updateColonias(colonias: Colonia[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'colonias'));
    snap.docs.forEach(d => batch.delete(d.ref));
    colonias.forEach(c => batch.set(doc(adminDb, 'colonias', c.id), c));
    await batch.commit();
    return { success: true };
}

// --- BULK INSERTS ---
export async function bulkInsertPatients(patients: any[]) { return data.bulkInsertPatients(patients); }
export async function bulkInsertDoctors(doctors: any[]) { return data.bulkInsertDoctors(doctors); }

// --- SEGURIDAD ---
export async function getAdminSettings() { return data.getAdminSettingsData(); }
export async function updateAdminSettings(settings: AdminSettings) { await setDoc(doc(adminDb, 'settings', 'admin'), settings); return { success: true }; }
export async function getArchiveSettings() { return data.getArchiveSettingsData(); }
export async function updateArchiveSettings(settings: ArchiveSettings) { await setDoc(doc(adminDb, 'settings', 'archive'), settings); return { success: true }; }
export async function getPharmacySettings() { return data.getPharmacySettingsData(); }
export async function updatePharmacySettings(settings: PharmacySettings) { await setDoc(doc(adminDb, 'settings', 'pharmacy'), settings); return { success: true }; }
export async function getWarehouseSettings() { return data.getWarehouseSettingsData(); }
export async function updateWarehouseSettings(settings: WarehouseSettings) { await setDoc(doc(adminDb, 'settings', 'warehouse'), settings); return { success: true }; }
export async function getBISettings() { return data.getBISettingsData(); }
export async function updateBISettings(settings: BISettings) { await setDoc(doc(adminDb, 'settings', 'bi'), settings); return { success: true }; }

export async function verifyAdminPassword(p: string) { const s = await data.getAdminSettingsData(); return { success: s.password === p }; }
export async function verifyArchivePassword(p: string) { const s = await data.getArchiveSettingsData(); return { success: s.password === p }; }
export async function verifyPharmacyPassword(p: string) { const s = await data.getPharmacySettingsData(); return { success: s.password === p }; }
export async function verifyWarehousePassword(p: string) { const s = await data.getWarehouseSettingsData(); return { success: s.password === p }; }
export async function verifyBIPassword(p: string) { const s = await data.getBISettingsData(); return { success: s.password === p }; }
export async function verifyCitasMedicasPassword(p: string) { const s = await data.getModuleSettings(); return { success: s.citasMedicasPassword === p }; }
export async function verifyLabPassword(p: string) { const s = await data.getLabSettings(); return { success: s.password === p }; }
export async function verifyXRayPassword(p: string) { const s = await data.getXRaySettings(); return { success: s.password === p }; }
export async function verifyUltrasoundPassword(p: string) { const s = await data.getUltrasoundSettings(); return { success: s.password === p }; }
export async function verifyVaccinePassword(p: string) { const s = await data.getVaccineSettings(); return { success: s.password === p }; }

// --- LOGS ---
export async function getLogs() { return data.getLogsData(); }
export async function logActivity(action: string, details: string) {
    await addDoc(collection(adminDb, 'activityLog'), { timestamp: serverTimestamp(), action, details });
    return { success: true };
}

// --- CONSULTAS Y RECETAS ---
export async function getConsultationsByPatientId(patientId: string) { return data.getConsultationsByPatientId(patientId); }
export async function saveMedicalConsultation(consultation: any) {
    const id = consultation.id || uuidv4();
    await setDoc(doc(adminDb, 'medicalConsultations', id), { ...consultation, id });
    if (consultation.isFinal) {
        await updateDoc(doc(adminDb, 'appointments', consultation.appointmentId), { status: 'Atendido' });
    }
    return { success: true, id };
}
export async function deleteMedicalConsultation(id: string) {
    await deleteDoc(doc(adminDb, 'medicalConsultations', id));
    return { success: true };
}
export async function getConsultationByAppointmentId(appId: string) { return data.getConsultationByAppointmentId(appId); }

export async function getPrescriptionsByPatientId(patientId: string) { return data.getPrescriptionsByPatientId(patientId); }
export async function createPrescription(p: any) {
    const id = uuidv4();
    const folio = `REC-${uuidv4().split('-')[0].toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    const newPresc = { ...p, id, folio, status: 'pendiente', expiresAt: expiresAt.toISOString() };
    await setDoc(doc(adminDb, 'prescriptions', id), newPresc);
    return { success: true, folio, prescription: newPresc };
}
export async function updatePrescription(id: string, p: any) {
    await updateDoc(doc(adminDb, 'prescriptions', id), p);
    return { success: true };
}
export async function deletePrescription(id: string) {
    await deleteDoc(doc(adminDb, 'prescriptions', id));
    return { success: true };
}
export async function dispensePrescription(id: string, items: any[]) {
    const batch = writeBatch(adminDb);
    for (const item of items) {
        batch.update(doc(adminDb, 'medications', item.medicationId), { existencia: increment(-item.quantity) });
    }
    batch.update(doc(adminDb, 'prescriptions', id), { status: 'surtida', dispensedAt: new Date().toISOString() });
    await batch.commit();
    return { success: true };
}

// --- OTROS ---
export async function getAnnouncements() { return data.getAnnouncementsData(); }
export async function updateAnnouncements(messages: string[]) { await setDoc(doc(adminDb, 'settings', 'announcements'), { messages }); return { success: true }; }
export async function getHolidays() { return data.getHolidaysData(); }
export async function updateHolidays(holidays: Holiday[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'holidays'));
    snap.docs.forEach(d => batch.delete(d.ref));
    holidays.forEach(h => batch.set(doc(adminDb, 'holidays', uuidv4()), h));
    await batch.commit();
    return { success: true };
}
export async function getSpecialActionDays() { return data.getSpecialActionDaysData(); }
export async function updateSpecialActionDays(items: SpecialActionDay[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'specialActionDays'));
    snap.docs.forEach(d => batch.delete(d.ref));
    items.forEach(i => batch.set(doc(adminDb, 'specialActionDays', uuidv4()), i));
    await batch.commit();
    return { success: true };
}

export async function searchCie10(term: string) { return data.searchCie10Data(term); }
export async function getLabSettings() { return data.getLabSettings(); }
export async function updateLabSettings(s: LabSettings) { await setDoc(doc(adminDb, 'settings', 'labSettings'), s); return { success: true }; }
export async function getXRaySettings() { return data.getXRaySettings(); }
export async function updateXRaySettings(s: XRaySettings) { await setDoc(doc(adminDb, 'settings', 'xraySettings'), s); return { success: true }; }
export async function getUltrasoundSettings() { return data.getUltrasoundSettings(); }
export async function updateUltrasoundSettings(s: UltrasoundSettings) { await setDoc(doc(adminDb, 'settings', 'ultrasoundSettings'), s); return { success: true }; }
export async function getVaccineSettings() { return data.getVaccineSettings(); }
export async function updateVaccineSettings(s: VaccineSettings) { await setDoc(doc(adminDb, 'settings', 'vaccineSettings'), s); return { success: true }; }

export async function getLabStudies() { return data.getLabStudies(); }
export async function updateLabStudies(s: LabStudy[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'labStudies'));
    snap.docs.forEach(d => batch.delete(d.ref));
    s.forEach(item => batch.set(doc(adminDb, 'labStudies', item.id), item));
    await batch.commit();
    return { success: true };
}

export async function getXRayStudies() { return data.getXRayStudies(); }
export async function updateXRayStudies(s: XRayStudy[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'xRayStudies'));
    snap.docs.forEach(d => batch.delete(d.ref));
    s.forEach(item => batch.set(doc(adminDb, 'xRayStudies', item.id), item));
    await batch.commit();
    return { success: true };
}

export async function getUltrasoundStudies() { return data.getUltrasoundStudies(); }
export async function updateUltrasoundStudies(s: UltrasoundStudy[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'ultrasoundStudies'));
    snap.docs.forEach(d => batch.delete(d.ref));
    s.forEach(item => batch.set(doc(adminDb, 'ultrasoundStudies', item.id), item));
    await batch.commit();
    return { success: true };
}

export async function getVaccines() { return data.getVaccines(); }
export async function updateVaccines(v: Vaccine[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'vaccines'));
    snap.docs.forEach(d => batch.delete(d.ref));
    v.forEach(item => batch.set(doc(adminDb, 'vaccines', item.id), item));
    await batch.commit();
    return { success: true };
}

export async function getMedications() { return data.getMedications(); }
export async function bulkInsertMedications(meds: any[]) {
    const batch = writeBatch(adminDb);
    for (const m of meds) {
        const id = uuidv4();
        batch.set(doc(adminDb, 'medications', id), { ...m, id });
    }
    await batch.commit();
    return { success: true, processedCount: meds.length };
}
export async function deleteAllMedications() {
    const snap = await getDocs(collection(adminDb, 'medications'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true };
}

export async function getSupplies() { return data.getSupplies(); }
export async function bulkInsertSupplies(supplies: any[]) {
    const batch = writeBatch(adminDb);
    for (const s of supplies) {
        const id = uuidv4();
        batch.set(doc(adminDb, 'supplies', id), { ...s, id });
    }
    await batch.commit();
    return { success: true, processedCount: supplies.length };
}
export async function deleteAllSupplies() {
    const snap = await getDocs(collection(adminDb, 'supplies'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true };
}

export async function getAttendedPatientsForClinic(clinicId: string) {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), where('status', '==', 'Atendido'));
    const snap = await getDocs(q);
    const patientIds = Array.from(new Set(snap.docs.map(d => d.data().patientId)));
    if (patientIds.length === 0) return [];
    const patients = [];
    for (const id of patientIds) {
        const pSnap = await getDoc(doc(adminDb, 'patients', id));
        if (pSnap.exists()) patients.push(data.serializeData(pSnap.data()));
    }
    return patients;
}

export async function getPrescriptionHistory(filters: any) { return data.getPrescriptionHistory(filters); }
export async function getPendingPrescriptions(filters: any) { return data.getPendingPrescriptions(filters); }

export async function getPatientPrescriptionsCountTodayAction(patientId: string) {
    const start = data.startOfDay(new Date()).toISOString();
    const end = data.endOfDay(new Date()).toISOString();
    const q = query(collection(adminDb, 'prescriptions'), where('patientId', '==', patientId), where('date', '>=', start), where('date', '<=', end));
    const snap = await getDocs(q);
    return snap.size;
}

export async function getAppointmentCountOnDate(clinicId: string, date: string) {
    const start = data.startOfDay(new Date(date)).toISOString();
    const end = data.endOfDay(new Date(date)).toISOString();
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), where('date', '>=', start), where('date', '<=', end));
    const snap = await getDocs(q);
    return snap.size;
}

export async function downloadBackupAction() {
    const [apps, lab, xray, us, vaccine, patients, clinics] = await Promise.all([
        getAppointments(), getLabAppointments(), getXRayAppointments(), getUltrasoundAppointments(), getVaccineAppointments(), getPatients(), getClinics()
    ]);
    return { success: true, data: { appointments: apps, labAppointments: lab, xRayAppointments: xray, ultrasoundAppointments: us, vaccineAppointments: vaccine, patients, clinics } };
}

export async function cleanupOldRecords() {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    const limitDate = date.toISOString();
    
    const collections = ['appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments'];
    let total = 0;
    for (const c of collections) {
        const q = query(collection(adminDb, c), where('date', '<', limitDate));
        const snap = await getDocs(q);
        const batch = writeBatch(adminDb);
        snap.docs.forEach(d => { batch.delete(d.ref); total++; });
        await batch.commit();
    }
    return { success: true, deletedCount: total };
}

export async function scanDuplicates(criteria: 'expediente' | 'curp' | 'name') {
    const snap = await getDocs(collection(adminDb, 'patients'));
    const all = snap.docs.map(d => d.data() as Patient);
    const groups: Record<string, Patient[]> = {};
    all.forEach(p => {
        let key = '';
        if (criteria === 'curp') key = p.curp.toUpperCase();
        else if (criteria === 'expediente') key = p.expediente || 'S/E';
        else key = `${p.name} ${p.paternalLastName}`.toUpperCase();
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
    });
    return Object.values(groups).filter(g => g.length > 1);
}

export async function applyStatusUpdateChunk(expedientes: string[], status: any) {
    let count = 0;
    for (const exp of expedientes) {
        const q = query(collection(adminDb, 'patients'), where('expediente', '==', exp));
        const snap = await getDocs(q);
        const batch = writeBatch(adminDb);
        snap.docs.forEach(d => { batch.update(d.ref, { status }); count++; });
        await batch.commit();
    }
    return { success: true, count };
}

export async function normalizeExpedientesAction() {
    const snap = await getDocs(collection(adminDb, 'patients'));
    const batch = writeBatch(adminDb);
    let count = 0;
    snap.docs.forEach(d => {
        const p = d.data();
        if (p.expediente && !p.expediente.startsWith('0')) {
            batch.update(d.ref, { expediente: '0' + p.expediente });
            count++;
        }
    });
    await batch.commit();
    return { success: true, count };
}

export async function bulkInsertCie10Glossary(items: any[]) {
    const batch = writeBatch(adminDb);
    items.forEach(item => batch.set(doc(adminDb, 'cie10_glossary', uuidv4()), item));
    await batch.commit();
    return { success: true, processedCount: items.length };
}

export async function bulkInsertCie10Catalog(items: any[]) {
    const batch = writeBatch(adminDb);
    items.forEach(item => batch.set(doc(adminDb, 'cie10_catalog', uuidv4()), item));
    await batch.commit();
    return { success: true, processedCount: items.length };
}

export async function deleteAllCie10Glossary() {
    const snap = await getDocs(collection(adminDb, 'cie10_glossary'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true };
}

export async function deleteAllCie10Catalog() {
    const snap = await getDocs(collection(adminDb, 'cie10_catalog'));
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true };
}
