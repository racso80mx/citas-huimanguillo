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
    Prescription
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
  Timestamp, 
  orderBy, 
  limit,
  serverTimestamp,
  getCountFromServer,
  addDoc
} from 'firebase/firestore';
import { adminDb } from '@/firebase/server-config';
import { v4 as uuidv4 } from 'uuid';

// --- Módulos y Configuración ---
export async function getModuleSettings() { return data.getModuleSettings(); }
export async function updateModuleSettings(settings: ModuleSettings) { 
    const res = await data.updateModuleSettings(settings);
    revalidatePath('/');
    return res;
}

// --- Catálogos ---
export async function getServiceTypes() { return data.getServiceTypes(); }
export async function updateServiceTypes(types: ServiceType[]) { return data.updateServiceTypes(types); }
export async function getSpecialties() { return data.getSpecialties(); }
export async function updateSpecialties(specs: Specialty[]) { return data.updateSpecialties(specs); }

// --- Pacientes ---
export async function getPatients(options?: any) { return data.getPatientsData(options); }
export async function getPatientByCURP(curp: string) {
    const q = query(collection(adminDb, 'patients'), where('curp', '==', curp.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) return { success: false };
    const p = snap.docs[0].data();
    return { success: true, data: p as Patient };
}
export async function savePatient(patient: Omit<Patient, 'id'>, id?: string) { return data.savePatientData(patient, id); }
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
export async function bulkInsertPatients(patients: any[]) {
    const batch = writeBatch(adminDb);
    let added = 0, updated = 0;
    for (const p of patients) {
        const curp = String(p.CURP || '').toUpperCase();
        if (!curp) continue;
        const q = query(collection(adminDb, 'patients'), where('curp', '==', curp));
        const snap = await getDocs(q);
        const patientData = {
            id: snap.empty ? uuidv4() : snap.docs[0].id,
            expediente: String(p['No.Expediente'] || ''),
            curp: curp,
            name: String(p.Nombre || '').toUpperCase(),
            paternalLastName: String(p.Apaterno || '').toUpperCase(),
            maternalLastName: String(p.Amaterno || '').toUpperCase(),
            birthDate: String(p.FNacimiento || ''),
            age: parseInt(p.Edad) || 0,
            sex: p.Sexo === 'H' ? 'Hombre' : 'Mujer',
            birthState: String(p.Estado || '').toUpperCase(),
            address: String(p.Domicilio || '').toUpperCase(),
            coloniaName: String(p.Colonia || '').toUpperCase(),
            phoneNumber: String(p.Telefono || ''),
            status: p.Estatus || 'Vigente'
        };
        batch.set(doc(adminDb, 'patients', patientData.id), patientData);
        if (snap.empty) added++; else updated++;
    }
    await batch.commit();
    return { success: true, addedCount: added, updatedCount: updated, processedCount: patients.length };
}
export async function deletePatients(ids: string[]) {
    const batch = writeBatch(adminDb);
    ids.forEach(id => batch.delete(doc(adminDb, 'patients', id)));
    await batch.commit();
    return { success: true };
}
export async function scanDuplicates(criteria: 'expediente' | 'curp' | 'name') {
    const snap = await getDocs(collection(adminDb, 'patients'));
    const all = snap.docs.map(d => d.data() as Patient);
    const groups: Record<string, Patient[]> = {};
    all.forEach(p => {
        let key = '';
        if (criteria === 'expediente') key = p.expediente || 'S/E';
        else if (criteria === 'curp') key = p.curp;
        else key = `${p.name} ${p.paternalLastName}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
    });
    return Object.values(groups).filter(g => g.length > 1);
}
export async function normalizeExpedientesAction() {
    const snap = await getDocs(collection(adminDb, 'patients'));
    const batch = writeBatch(adminDb);
    let count = 0;
    snap.docs.forEach(d => {
        const data = d.data();
        if (data.expediente && !data.expediente.startsWith('0')) {
            batch.update(d.ref, { expediente: '0' + data.expediente });
            count++;
        }
    });
    await batch.commit();
    return { success: true, count };
}
export async function applyStatusUpdateChunk(expedientes: string[], status: string) {
    let count = 0;
    for (const exp of expedientes) {
        const q = query(collection(adminDb, 'patients'), where('expediente', '==', exp));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const batch = writeBatch(adminDb);
            snap.docs.forEach(d => {
                batch.update(d.ref, { status });
                count++;
            });
            await batch.commit();
        }
    }
    return { success: true, count };
}

// --- CITAS MÉDICAS ---
export async function getAppointments() { return data.getAppointmentsData(); }
export async function saveNewAppointment(appointment: any, patient: any, isDouble: boolean, coloniaName?: string) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp;
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const aId = uuidv4();
    const finalApp = { ...appointment, id: aId, patientId: pId, patient, appointmentNumber: `MED-${uuidv4().split('-')[0].toUpperCase()}`, coloniaName, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'appointments', aId), finalApp);
    await batch.commit();
    return { success: true, data: { appointment: finalApp, clinic: {} } };
}
export async function updateAppointmentStatus(id: string, status: string, type: string) {
    const coll = type === 'lab' ? 'labAppointments' : type === 'xray' ? 'xrayAppointments' : type === 'ultrasound' ? 'ultrasoundAppointments' : type === 'vaccine' ? 'vaccineAppointments' : 'appointments';
    await updateDoc(doc(adminDb, coll, id), { status });
    return { success: true };
}
export async function deleteAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'appointments', id));
    return { success: true };
}
export async function getAppointmentsForClinic(clinicId: string) {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Appointment);
}
export async function getAttendedPatientsForClinic(clinicId: string) {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), where('status', '==', 'Atendido'));
    const snap = await getDocs(q);
    const patientIds = Array.from(new Set(snap.docs.map(d => d.data().patientId)));
    const patients: Patient[] = [];
    for (const id of patientIds) {
        const pSnap = await getDoc(doc(adminDb, 'patients', id));
        if (pSnap.exists()) patients.push(pSnap.data() as Patient);
    }
    return patients;
}
export async function getAppointmentCountOnDate(clinicId: string, date: string) { return data.getAppointmentCountOnDate(clinicId, date); }
export async function rescheduleAppointment(id: string, newDate: string, type: string) {
    const coll = type === 'lab' ? 'labAppointments' : type === 'xray' ? 'xrayAppointments' : type === 'ultrasound' ? 'ultrasoundAppointments' : type === 'vaccine' ? 'vaccineAppointments' : 'appointments';
    await updateDoc(doc(adminDb, coll, id), { date: newDate });
    return { success: true, message: 'Cita reprogramada' };
}
export async function cloneAppointment(id: string, newDate: string, type: string, newTime?: string) {
    const coll = type === 'lab' ? 'labAppointments' : type === 'xray' ? 'xrayAppointments' : type === 'ultrasound' ? 'ultrasoundAppointments' : type === 'vaccine' ? 'vaccineAppointments' : 'appointments';
    const snap = await getDoc(doc(adminDb, coll, id));
    if (!snap.exists()) return { success: false, message: 'Cita no encontrada' };
    const data = snap.data();
    const newId = uuidv4();
    const newApp = { ...data, id: newId, date: newDate, status: 'Agendada', createdAt: new Date().toISOString() };
    if (newTime) newApp.time = newTime;
    await setDoc(doc(adminDb, coll, newId), newApp);
    return { success: true, message: 'Cita clonada' };
}
export async function getAvailableSlotsForDate(clinicId: string, date: string) {
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), where('date', '==', date.split('T')[0]));
    const snap = await getDocs(q);
    const booked = snap.docs.map(d => d.data().time);
    const cSnap = await getDoc(doc(adminDb, 'clinics', clinicId));
    if (!cSnap.exists()) return {};
    const clinic = cSnap.data() as Clinic;
    const all = Array.from({ length: clinic.dailySlots }, (_, i) => i + 1);
    const tokens = all.filter(t => !booked.includes(String(t)));
    return { tokens };
}

// --- LABORATORIO ---
export async function getLabAppointments() { return data.getLabAppointmentsData(); }
export async function saveNewLabAppointment(app: any, patient: any) { return data.saveNewLabAppointment(app, patient); }
export async function deleteLabAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'labAppointments', id));
    return { success: true };
}
export async function getLabStudies() { return data.getLabStudiesData(); }
export async function updateLabStudies(studies: LabStudy[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'labStudies'));
    snap.docs.forEach(d => batch.delete(d.ref));
    studies.forEach(s => batch.set(doc(adminDb, 'labStudies', s.id), s));
    await batch.commit();
    return { success: true };
}
export async function getLabSettings() { return data.getLabSettingsData(); }
export async function updateLabSettings(settings: LabSettings) {
    await setDoc(doc(adminDb, 'settings', 'lab'), settings);
    return { success: true };
}

// --- RAYOS X ---
export async function getXRayAppointments() { return data.getXRayAppointmentsData(); }
export async function saveNewXRayAppointment(app: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp;
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const aId = uuidv4();
    const finalApp = { ...app, id: aId, patientId: pId, patient, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'xrayAppointments', aId), finalApp);
    await batch.commit();
    return { success: true, data: { appointment: finalApp, study: {} } };
}
export async function deleteXRayAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'xrayAppointments', id));
    return { success: true };
}
export async function getXRayStudies() { return data.getXRayStudiesData(); }
export async function updateXRayStudies(studies: XRayStudy[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'xrayStudies'));
    snap.docs.forEach(d => batch.delete(d.ref));
    studies.forEach(s => batch.set(doc(adminDb, 'xrayStudies', s.id), s));
    await batch.commit();
    return { success: true };
}
export async function getXRaySettings() { return data.getXRaySettingsData(); }
export async function updateXRaySettings(settings: XRaySettings) {
    await setDoc(doc(adminDb, 'settings', 'xray'), settings);
    return { success: true };
}

// --- ULTRASONIDOS ---
export async function getUltrasoundAppointments() { return data.getUltrasoundAppointmentsData(); }
export async function saveNewUltrasoundAppointment(app: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp;
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const aId = uuidv4();
    const finalApp = { ...app, id: aId, patientId: pId, patient, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'ultrasoundAppointments', aId), finalApp);
    await batch.commit();
    return { success: true, data: { appointment: finalApp, study: {} } };
}
export async function deleteUltrasoundAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'ultrasoundAppointments', id));
    return { success: true };
}
export async function getUltrasoundStudies() { return data.getUltrasoundStudiesData(); }
export async function updateUltrasoundStudies(studies: UltrasoundStudy[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'ultrasoundStudies'));
    snap.docs.forEach(d => batch.delete(d.ref));
    studies.forEach(s => batch.set(doc(adminDb, 'ultrasoundStudies', s.id), s));
    await batch.commit();
    return { success: true };
}
export async function getUltrasoundSettings() { return data.getUltrasoundSettingsData(); }
export async function updateUltrasoundSettings(settings: UltrasoundSettings) {
    await setDoc(doc(adminDb, 'settings', 'ultrasound'), settings);
    return { success: true };
}

// --- VACUNAS ---
export async function getVaccineAppointments() { return data.getVaccineAppointmentsData(); }
export async function saveNewVaccineAppointment(app: any, patient: any) {
    const batch = writeBatch(adminDb);
    const pId = patient.curp;
    batch.set(doc(adminDb, 'patients', pId), { ...patient, id: pId }, { merge: true });
    const aId = uuidv4();
    const finalApp = { ...app, id: aId, patientId: pId, patient, createdAt: new Date().toISOString() };
    batch.set(doc(adminDb, 'vaccineAppointments', aId), finalApp);
    await batch.commit();
    return { success: true, data: finalApp };
}
export async function deleteVaccineAppointment(id: string) {
    await deleteDoc(doc(adminDb, 'vaccineAppointments', id));
    return { success: true };
}
export async function getVaccines() { return data.getVaccinesData(); }
export async function updateVaccines(vaccines: Vaccine[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'vaccines'));
    snap.docs.forEach(d => batch.delete(d.ref));
    vaccines.forEach(v => batch.set(doc(adminDb, 'vaccines', v.id), v));
    await batch.commit();
    return { success: true };
}
export async function getVaccineSettings() { return data.getVaccineSettingsData(); }
export async function updateVaccineSettings(settings: VaccineSettings) {
    await setDoc(doc(adminDb, 'settings', 'vaccine'), settings);
    return { success: true };
}

// --- INVENTARIOS ---
export async function getMedications() { return data.getMedicationsData(); }
export async function bulkInsertMedications(items: any[]) { return data.bulkInsertMedications(items); }
export async function deleteAllMedications() { return data.deleteAllMedications(); }
export async function getSupplies() { return data.getSuppliesData(); }
export async function bulkInsertSupplies(items: any[]) { return data.bulkInsertSupplies(items); }
export async function deleteAllSupplies() { return data.deleteAllSupplies(); }

// --- SEGURIDAD ---
export async function getAdminSettings() { return data.getAdminSettingsData(); }
export async function updateAdminSettings(settings: AdminSettings) {
    await setDoc(doc(adminDb, 'settings', 'admin'), settings);
    return { success: true };
}
export async function getArchiveSettings() { return data.getArchiveSettingsData(); }
export async function updateArchiveSettings(settings: ArchiveSettings) {
    await setDoc(doc(adminDb, 'settings', 'archive'), settings);
    return { success: true };
}
export async function getPharmacySettings() { return data.getPharmacySettingsData(); }
export async function updatePharmacySettings(settings: PharmacySettings) {
    await setDoc(doc(adminDb, 'settings', 'pharmacy'), settings);
    return { success: true };
}
export async function getWarehouseSettings() { return data.getWarehouseSettingsData(); }
export async function updateWarehouseSettings(settings: WarehouseSettings) {
    await setDoc(doc(adminDb, 'settings', 'warehouse'), settings);
    return { success: true };
}
export async function getBISettings() { return data.getBISettingsData(); }
export async function updateBISettings(settings: BISettings) {
    await setDoc(doc(adminDb, 'settings', 'bi'), settings);
    return { success: true };
}

// --- LOGS ---
export async function getLogs() { return data.getLogsData(); }
export async function logActivity(action: string, details: string) { return data.logActivity(action, details); }
export async function cleanupOldRecords() { return data.cleanupOldRecords(); }

// --- AVISOS Y FESTIVOS ---
export async function getAnnouncements() { return data.getAnnouncementsData(); }
export async function updateAnnouncements(messages: string[]) {
    await setDoc(doc(adminDb, 'settings', 'announcements'), { messages });
    return { success: true };
}
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
export async function updateSpecialActionDays(days: SpecialActionDay[]) {
    const batch = writeBatch(adminDb);
    const snap = await getDocs(collection(adminDb, 'specialActionDays'));
    snap.docs.forEach(d => batch.delete(d.ref));
    days.forEach(d => batch.set(doc(adminDb, 'specialActionDays', uuidv4()), d));
    await batch.commit();
    return { success: true };
}

// --- CLÍNICAS Y COLONIAS ---
export async function getClinics() { return data.getClinicsData(); }
export async function updateClinics(clinics: Clinic[]) {
    const batch = writeBatch(adminDb);
    for (const c of clinics) {
        batch.set(doc(adminDb, 'clinics', c.id), c);
    }
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

// --- CONSULTAS MÉDICA ---
export async function getConsultationsByPatientId(patientId: string) {
    const q = query(collection(adminDb, 'consultations'), where('patientId', '==', patientId), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => data.serializeData(d.data()) as MedicalConsultation);
}
export async function getConsultationByAppointmentId(appointmentId: string) {
    const q = query(collection(adminDb, 'consultations'), where('appointmentId', '==', appointmentId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return data.serializeData(snap.docs[0].data()) as MedicalConsultation;
}
export async function saveMedicalConsultation(consultation: any) {
    const id = consultation.id || uuidv4();
    await setDoc(doc(adminDb, 'consultations', id), { ...consultation, id, createdAt: new Date().toISOString() });
    return { success: true, id };
}
export async function deleteMedicalConsultation(id: string) {
    await deleteDoc(doc(adminDb, 'consultations', id));
    return { success: true };
}

// --- RECETAS ---
export async function createPrescription(p: any) {
    const id = uuidv4();
    const folio = `REC-${uuidv4().split('-')[0].toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    const finalPresc = { ...p, id, folio, expiresAt: expiresAt.toISOString(), status: 'pendiente' };
    await setDoc(doc(adminDb, 'prescriptions', id), finalPresc);
    return { success: true, folio, prescription: finalPresc };
}
export async function updatePrescription(id: string, p: any) {
    await updateDoc(doc(adminDb, 'prescriptions', id), p);
    return { success: true };
}
export async function deletePrescription(id: string) {
    await deleteDoc(doc(adminDb, 'prescriptions', id));
    return { success: true };
}
export async function getPendingPrescriptions(filter: any) {
    let q = query(collection(adminDb, 'prescriptions'), where('status', '==', 'pendiente'));
    const snap = await getDocs(q);
    let results = snap.docs.map(d => data.serializeData(d.data()) as Prescription);
    if (filter.folio) results = results.filter(r => r.folio.toUpperCase().includes(filter.folio.toUpperCase()));
    if (filter.clinicId) results = results.filter(r => r.clinicId === filter.clinicId);
    return results;
}
export async function dispensePrescription(id: string, items: any[]) {
    const batch = writeBatch(adminDb);
    const pRef = doc(adminDb, 'prescriptions', id);
    batch.update(pRef, { status: 'surtida', dispensedDate: new Date().toISOString() });
    for (const item of items) {
        const mRef = doc(adminDb, 'medications', item.medicationId);
        batch.update(mRef, { existencia: increment(-item.quantity) });
    }
    await batch.commit();
    return { success: true };
}
export async function getPrescriptionHistory(options: any) {
    let q = query(collection(adminDb, 'prescriptions'), where('status', '==', 'surtida'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    let results = snap.docs.map(d => data.serializeData(d.data()) as Prescription);
    if (options.startDate) results = results.filter(r => r.date >= options.startDate);
    if (options.endDate) results = results.filter(r => r.date <= options.endDate);
    return results;
}

export async function bulkInsertDoctors(items: any[]) {
    const batch = writeBatch(adminDb);
    for (const item of items) {
        const id = uuidv4();
        const doctorData = {
            id,
            doctorName: String(item['Médico'] || '').toUpperCase(),
            doctorCurp: String(item.CURP || '').toUpperCase(),
            professionalLicense: String(item['Cédula'] || '').toUpperCase(),
            name: String(item['Unidad'] || '').toUpperCase(),
            clinicType: String(item['Servicio'] || 'Consulta Externa').toUpperCase(),
            password: 'hospital_default',
            dailySlots: 10,
            startTime: '08:00',
            endTime: '13:00',
            weekendBookingEnabled: false,
            bookingMode: BookingMode.Time,
            consultationDuration: 30
        };
        batch.set(doc(adminDb, 'clinics', id), doctorData);
    }
    await batch.commit();
    return { success: true, processedCount: items.length };
}

// --- CITAS POR CALENDARIO (SOLO LECTURA) ---
export async function getAppointmentsForCalendar(month: number, year: number) {
  const start = new Date(year, month, 1).toISOString();
  const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
  const q = query(collection(adminDb, 'appointments'), where('date', '>=', start), where('date', '<=', end));
  const snap = await getDocs(q);
  return snap.docs.map(d => data.serializeData(d.data()) as Appointment);
}
