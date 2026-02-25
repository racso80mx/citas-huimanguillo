
'use server';

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
  DocumentReference,
  addDoc,
  documentId
} from 'firebase/firestore';
import { adminDb } from '@/firebase/server-config';
import { v4 as uuidv4 } from 'uuid';

import type {
  Appointment,
  AppointmentStatus,
  Clinic,
  Colonia,
  LabAppointment,
  LabSettings,
  LabStudy,
  Patient,
  UltrasoundAppointment,
  UltrasoundSettings,
  UltrasoundStudy,
  XRayAppointment,
  XRaySettings,
  XRayStudy,
  ModuleSettings,
  Vaccine,
  VaccineSettings,
  VaccineAppointment,
  User,
  ActivityLog,
  ArchiveSettings,
  PatientStatus,
} from './definitions';
import { BookingMode, PatientStatus as PatientStatusEnum } from './definitions';

// =====================================================================
// HELPERS
// =====================================================================

/**
 * Divide un arreglo en fragmentos de tamaño específico para cumplir con los límites de Firebase.
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  if (!array || array.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function getSettingsDoc<T>(docId: string, defaultVal: T): Promise<T> {
  if (!adminDb) throw new Error("Database not initialized.");
  const docRef = doc(adminDb, 'settings', docId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as T;
  }
  return defaultVal;
}

async function setSettingsDoc(docId: string, data: any) {
  if (!adminDb) throw new Error("Database not initialized.");
  const docRef = doc(adminDb, 'settings', docId);
  await setDoc(docRef, data, { merge: true });
  return { success: true };
}

async function findPatient(patientData: Partial<Patient>): Promise<Patient | null> {
    if (!adminDb) return null;
    const patientsCollection = collection(adminDb, 'patients');

    const expediente = patientData.expediente ? String(patientData.expediente).trim() : '';
    if (expediente) {
        const q = query(patientsCollection, where('expediente', '==', expediente), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { ...doc.data(), id: doc.id } as Patient;
        }
    }

    const curp = patientData.curp ? patientData.curp.trim().toUpperCase() : '';
    if (curp && !curp.startsWith('RN-')) {
        const q = query(patientsCollection, where('curp', '==', curp), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { ...doc.data(), id: doc.id } as Patient;
        }
    }
    
    return null;
}

async function upsertPatient(patientData: Omit<Patient, 'id'>): Promise<DocumentReference> {
    if (!adminDb) throw new Error("Database not initialized.");
    
    const dataToSave: any = {
        ...patientData,
        lastAppointmentDate: new Date().toISOString().split('T')[0],
    };

    if (patientData.curp && patientData.curp.startsWith('RN-')) {
        const patientRef = doc(collection(adminDb, 'patients'));
        await setDoc(patientRef, { 
            ...dataToSave, 
            status: PatientStatusEnum.Vigente, 
            registrationDate: new Date().toISOString().split('T')[0] 
        });
        return patientRef;
    }

    const existingPatient = await findPatient(patientData);

    if (existingPatient) {
        const patientRef = doc(adminDb, 'patients', existingPatient.id);
        await updateDoc(patientRef, dataToSave);
        return patientRef;
    } else {
        if (!dataToSave.registrationDate) dataToSave.registrationDate = new Date().toISOString().split('T')[0];
        if (!dataToSave.status) dataToSave.status = PatientStatusEnum.Vigente;
        const patientRef = doc(collection(adminDb, 'patients'));
        await setDoc(patientRef, dataToSave);
        return patientRef;
    }
}

async function getCatalog<T>(collectionName: string): Promise<T[]> {
  if (!adminDb) return [];
  const collRef = collection(adminDb, collectionName);
  const snapshot = await getDocs(query(collRef));
  return snapshot.docs.map(d => ({ ...(d.data() as T), id: d.id }));
}

async function updateCatalog<T extends { id?: string }>(collectionName: string, items: T[]) {
  if (!adminDb) throw new Error("Database not initialized.");
  const batch = writeBatch(adminDb);
  const collRef = collection(adminDb, collectionName);
  const snapshot = await getDocs(collRef);
  const existingIds = new Set(snapshot.docs.map(d => d.id));
  const incomingIds = new Set();

  items.forEach(item => {
    let docId = item.id;
    if (!docId || docId.startsWith('new-')) docId = uuidv4();
    incomingIds.add(docId);
    const { id, ...data } = item;
    batch.set(doc(collRef, docId), data);
  });

  for (const id of existingIds) {
    if (!incomingIds.has(id)) batch.delete(doc(collRef, id));
  }

  await batch.commit();
  return { success: true };
}

/**
 * Enriquece una lista de citas con los datos completos del paciente.
 * Utiliza lotes de 10 para las consultas IN de Firestore, garantizando seguridad.
 */
async function enrichAppointmentsWithPatientData(appointments: any[]): Promise<any[]> {
    if (!adminDb || appointments.length === 0) return appointments;
    
    // Extraer y limpiar IDs de pacientes únicos
    const patientIds = Array.from(new Set(
        appointments
            .map(app => app.patientId)
            .filter(id => id && typeof id === 'string' && id.trim() !== '')
    ));
    
    if (patientIds.length === 0) return appointments;

    const patients: Record<string, Patient> = {};
    const chunks = chunkArray(patientIds, 10); // Lotes de 10 para mayor seguridad (límite real 30)
    
    for (const batchIds of chunks) {
        if (batchIds.length === 0) continue;
        const q = query(collection(adminDb, 'patients'), where(documentId(), 'in', batchIds));
        const snap = await getDocs(q);
        snap.forEach(doc => { 
            patients[doc.id] = { id: doc.id, ...doc.data() } as Patient; 
        });
    }

    return appointments.map(app => ({
        ...app,
        patient: patients[app.patientId] || null,
        date: app.date instanceof Timestamp ? app.date.toDate().toISOString() : app.date,
    }));
}

function generateDynamicTimeSlots(startTimeStr: string, endTimeStr: string, duration: number): string[] {
    if (!startTimeStr || !endTimeStr || !duration) return [];
    const slots: string[] = [];
    const start = new Date(`1970-01-01T${startTimeStr}:00`);
    const end = new Date(`1970-01-01T${endTimeStr}:00`);
    let current = start;
    while (current < end) {
        slots.push(current.toTimeString().substring(0, 5));
        current = new Date(current.getTime() + duration * 60000);
    }
    return slots;
}

// =====================================================================
// EXPORTS: PATIENTS
// =====================================================================

export async function getPatientByCURP(curp: string): Promise<Patient | null> {
    if (!adminDb) return null;
    const curpUpper = curp.trim().toUpperCase();
    if (!curpUpper) return null;
    const q = query(collection(adminDb, 'patients'), where('curp', '==', curpUpper), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Patient;
}

export async function getPatients(options?: { searchTerm?: string }): Promise<Patient[]> {
    if (!adminDb) return [];
    const q = query(collection(adminDb, 'patients'), orderBy('paternalLastName'), limit(1000));
    const snapshot = await getDocs(q);
    const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
    if (options?.searchTerm) {
        const term = options.searchTerm.toLowerCase();
        return all.filter(p => `${p.name} ${p.paternalLastName} ${p.maternalLastName}`.toLowerCase().includes(term) || p.curp.toLowerCase().includes(term));
    }
    return all;
}

export async function savePatient(patient: Omit<Patient, 'id'>, id?: string) { 
    if (!adminDb) return { success: false }; 
    const docId = id || uuidv4(); 
    await setDoc(doc(adminDb, 'patients', docId), { ...patient, status: patient.status || PatientStatusEnum.Vigente }, { merge: true }); 
    return { success: true }; 
}

export async function updatePatient(patientId: string, patientData: Partial<Omit<Patient, 'id'>>) {
    if (!adminDb) return { success: false, message: 'DB error' };
    await updateDoc(doc(adminDb, 'patients', patientId), patientData);
    return { success: true };
}

export async function deletePatient(id: string) { 
    if (!adminDb) return { success: false }; 
    await deleteDoc(doc(adminDb, 'patients', id)); 
    return { success: true }; 
}

export async function updatePatientStatus(id: string, status: PatientStatus) { 
    if (!adminDb) return { success: false }; 
    await updateDoc(doc(adminDb, 'patients', id), { status }); 
    return { success: true }; 
}

export async function bulkInsertPatients(patients: any[]) {
    if (!adminDb) return { success: false };
    const batchSize = 500;
    const batches = chunkArray(patients, batchSize);
    let totalAdded = 0;
    for (const chunk of batches) {
        const batch = writeBatch(adminDb);
        chunk.forEach(row => {
            const docId = uuidv4();
            batch.set(doc(adminDb, 'patients', docId), {
                ...row,
                registrationDate: row.FechaApertura || new Date().toISOString().split('T')[0],
                status: row.Estatus || PatientStatusEnum.Vigente
            });
            totalAdded++;
        });
        await batch.commit();
    }
    return { success: true, processedCount: patients.length, addedCount: totalAdded, updatedCount: 0 };
}

// =====================================================================
// EXPORTS: CLINICS & SLOTS
// =====================================================================

export async function getClinics(): Promise<Clinic[]> { return getCatalog<Clinic>('clinics'); }

export async function getClinicById(id: string): Promise<Clinic | null> {
    if (!adminDb) return null;
    const docSnap = await getDoc(doc(adminDb, 'clinics', id));
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() } as Clinic;
    return null;
}

export async function getAvailableSlotsForDate(clinicId: string, date: string): Promise<{ timeSlots?: string[], tokens?: number[] }> {
    const clinic = await getClinicById(clinicId);
    if (!clinic) return {};

    const dateOnly = new Date(date).toISOString().split('T')[0];
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId));
    const snap = await getDocs(q);
    const appointmentsOnDate = snap.docs
        .map(d => d.data())
        .filter(app => (app.date as Timestamp).toDate().toISOString().split('T')[0] === dateOnly);

    const takenTimes = appointmentsOnDate.map(app => app.time);

    if (clinic.bookingMode === BookingMode.Time) {
        const slots = generateDynamicTimeSlots(clinic.startTime, clinic.endTime, clinic.consultationDuration || 30);
        const timesToExclude = clinic.breakTime ? [...takenTimes, clinic.breakTime] : takenTimes;
        return { timeSlots: slots.filter(s => !timesToExclude.includes(s)) };
    } else {
        const totalSlots = clinic.dailySlots;
        const allTokens = Array.from({ length: totalSlots }, (_, i) => i + 1);
        const takenTokens = takenTimes.map(t => {
            const match = t.match(/Ficha (\d+)/);
            return match ? parseInt(match[1], 10) : null;
        }).filter(Boolean) as number[];
        return { tokens: allTokens.filter(token => !takenTokens.includes(token)) };
    }
}

// =====================================================================
// EXPORTS: APPOINTMENTS
// =====================================================================

export async function getAppointments(): Promise<Appointment[]> { if (!adminDb) return []; const snapshot = await getDocs(query(collection(adminDb, 'appointments'), orderBy('date', 'desc'), limit(500))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()}))); }

export async function getAppointmentsForClinic(clinicId: string): Promise<Appointment[]> {
    if (!adminDb) return [];
    const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), orderBy('date', 'desc'), limit(500));
    const snapshot = await getDocs(q);
    return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
}

export async function getLabAppointments(): Promise<LabAppointment[]> { if (!adminDb) return []; const snapshot = await getDocs(query(collection(adminDb, 'labAppointments'), orderBy('date', 'desc'), limit(200))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}
export async function getXRayAppointments(): Promise<XRayAppointment[]> { if (!adminDb) return []; const snapshot = await getDocs(query(collection(adminDb, 'xrayAppointments'), orderBy('date', 'desc'), limit(200))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}
export async function getUltrasoundAppointments(): Promise<UltrasoundAppointment[]> { if (!adminDb) return []; const snapshot = await getDocs(query(collection(adminDb, 'ultrasoundAppointments'), orderBy('date', 'desc'), limit(200))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}
export async function getVaccineAppointments(): Promise<VaccineAppointment[]> { if (!adminDb) return []; const snapshot = await getDocs(query(collection(adminDb, 'vaccineAppointments'), orderBy('date', 'desc'), limit(200))); return enrichAppointmentsWithPatientData(snapshot.docs.map(d => ({id: d.id, ...d.data()})));}

export async function saveAppointment(appointmentData: Omit<Appointment, 'id' | 'patientId' | 'patient' | 'appointmentNumber'>, patientData: Omit<Patient, 'id'>, coloniaName: string | undefined) {
    if (!adminDb) throw new Error("Database not initialized.");
    const patientRef = await upsertPatient({ ...patientData, coloniaName: coloniaName ?? patientData.coloniaName ?? '' });
    const clinic = await getClinicById(appointmentData.clinicId);
    if (!clinic) throw new Error("Clínica no válida.");
    
    const appointmentNumber = `CITA-${uuidv4().substring(0, 4).toUpperCase()}`;
    const newAppointmentData: any = { ...appointmentData, appointmentNumber, patientId: patientRef.id, date: new Date(appointmentData.date), status: 'Agendada', coloniaName: coloniaName ?? '' };
    const newAppointmentRef = await addDoc(collection(adminDb, 'appointments'), newAppointmentData);
    const patientSnap = await getDoc(patientRef);
    return { success: true, data: { appointment: { ...newAppointmentData, id: newAppointmentRef.id, patient: { ...patientSnap.data(), id: patientSnap.id } }, clinic } };
}

export async function saveLabAppointment(appointmentData: Omit<LabAppointment, 'id' | 'patientId' | 'patient'>, patientData: Omit<Patient, 'id'>) {
    if (!adminDb) throw new Error("Database not initialized.");
    const patientRef = await upsertPatient(patientData);
    const newAppointmentData = { ...appointmentData, patientId: patientRef.id, date: new Date(appointmentData.date) };
    const newAppointmentRef = await addDoc(collection(adminDb, 'labAppointments'), newAppointmentData);
    const patientSnap = await getDoc(patientRef);
    return { success: true, data: { ...newAppointmentData, id: newAppointmentRef.id, patient: { ...patientSnap.data(), id: patientSnap.id } } };
}

export async function saveNewXRayAppointment(appointmentData: Omit<XRayAppointment, 'id' | 'patientId' | 'patient' | 'status'>, patientData: Omit<Patient, 'id'>) {
    if (!adminDb) throw new Error("Database not initialized.");
    const patientRef = await upsertPatient(patientData);
    const newAppointmentData = { ...appointmentData, patientId: patientRef.id, date: new Date(appointmentData.date), status: 'Agendada' };
    const newAppointmentRef = await addDoc(collection(adminDb, 'xrayAppointments'), newAppointmentData);
    const patientSnap = await getDoc(patientRef);
    return { success: true, data: { appointment: { ...newAppointmentData, id: newAppointmentRef.id, patient: { ...patientSnap.data(), id: patientSnap.id } }, study: { id: appointmentData.studyId, name: appointmentData.studyName } } };
}

export async function saveNewUltrasoundAppointment(appointmentData: Omit<UltrasoundAppointment, 'id' | 'patientId' | 'patient' | 'status'>, patientData: Omit<Patient, 'id'>) {
    if (!adminDb) throw new Error("Database not initialized.");
    const patientRef = await upsertPatient(patientData);
    const newAppointmentData = { ...appointmentData, patientId: patientRef.id, date: new Date(appointmentData.date), status: 'Agendada' };
    const newAppointmentRef = await addDoc(collection(adminDb, 'ultrasoundAppointments'), newAppointmentData);
    const patientSnap = await getDoc(patientRef);
    return { success: true, data: { appointment: { ...newAppointmentData, id: newAppointmentRef.id, patient: { ...patientSnap.data(), id: patientSnap.id } }, study: { id: appointmentData.studyId, name: appointmentData.studyName } } };
}

export async function saveNewVaccineAppointment(appointmentData: Omit<VaccineAppointment, 'id' | 'patientId' | 'patient'>, patientData: Omit<Patient, 'id'>) {
    if (!adminDb) throw new Error("Database not initialized.");
    const patientRef = await upsertPatient(patientData);
    const newAppointmentData = { ...appointmentData, patientId: patientRef.id, date: new Date(appointmentData.date) };
    const newAppointmentRef = await addDoc(collection(adminDb, 'vaccineAppointments'), newAppointmentData);
    const patientSnap = await getDoc(patientRef);
    return { success: true, data: { ...newAppointmentData, id: newAppointmentRef.id, patient: { ...patientSnap.data(), id: patientSnap.id } } };
}

export async function deleteAppointment(id: string) { 
    if (!adminDb) return ''; 
    const snap = await getDoc(doc(adminDb, 'appointments', id));
    const folio = snap.exists() ? snap.data().appointmentNumber : id;
    await deleteDoc(doc(adminDb, 'appointments', id)); 
    return folio; 
}
export async function deleteLabAppointment(id: string) { 
    if (!adminDb) return ''; 
    const snap = await getDoc(doc(adminDb, 'labAppointments', id));
    const folio = snap.exists() ? snap.data().appointmentNumber : id;
    await deleteDoc(doc(adminDb, 'labAppointments', id)); 
    return folio; 
}
export async function deleteXRayAppointment(id: string) { 
    if (!adminDb) return ''; 
    const snap = await getDoc(doc(adminDb, 'xrayAppointments', id));
    const folio = snap.exists() ? snap.data().appointmentNumber : id;
    await deleteDoc(doc(adminDb, 'xrayAppointments', id)); 
    return folio; 
}
export async function deleteUltrasoundAppointment(id: string) { 
    if (!adminDb) return ''; 
    const snap = await getDoc(doc(adminDb, 'ultrasoundAppointments', id));
    const folio = snap.exists() ? snap.data().appointmentNumber : id;
    await deleteDoc(doc(adminDb, 'ultrasoundAppointments', id)); 
    return folio; 
}
export async function deleteVaccineAppointment(id: string) { 
    if (!adminDb) return ''; 
    const snap = await getDoc(doc(adminDb, 'vaccineAppointments', id));
    const folio = snap.exists() ? snap.data().appointmentNumber : id;
    await deleteDoc(doc(adminDb, 'vaccineAppointments', id)); 
    return folio; 
}

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus, type: string): Promise<{ success: boolean }> { 
    if (!adminDb) return { success: false }; 
    const coll = type === 'medical' ? 'appointments' : (type === 'lab' ? 'labAppointments' : `${type}Appointments`); 
    await updateDoc(doc(adminDb, coll, appointmentId), { status }); 
    return { success: true };
}

export async function rescheduleAppointment(appointmentId: string, newDate: string, type: string): Promise<{ success: boolean; message: string }> { 
    if (!adminDb) return { success: false, message: 'DB error' }; 
    const coll = type === 'medical' ? 'appointments' : (type === 'lab' ? 'labAppointments' : `${type}Appointments`); 
    await updateDoc(doc(adminDb, coll, appointmentId), { date: new Date(newDate), status: 'Agendada' }); 
    return { success: true, message: 'Fecha actualizada.' };
}

export async function cloneAppointment(originalId: string, newDate: string, type: string, newTime?: string) {
    if (!adminDb) return { success: false, message: 'DB error' };
    const coll = type === 'medical' ? 'appointments' : (type === 'lab' ? 'labAppointments' : `${type}Appointments`);
    const snap = await getDoc(doc(adminDb, coll, originalId));
    if (!snap.exists()) return { success: false, message: 'Cita no encontrada.' };
    const data = snap.data();
    const pSnap = await getDoc(doc(adminDb, 'patients', data.patientId));
    const pData = pSnap.data() as Omit<Patient, 'id'>;
    const { id, date, status, ...payload } = data;
    if (newTime) payload.time = newTime;
    try {
        let res;
        if (type === 'medical') res = await saveAppointment(payload as any, pData, payload.coloniaName);
        else if (type === 'lab') res = await saveLabAppointment(payload as any, pData);
        else if (type === 'xray') res = await saveNewXRayAppointment(payload as any, pData);
        else if (type === 'ultrasound') res = await saveNewUltrasoundAppointment(payload as any, pData);
        else if (type === 'vaccine') res = await saveNewVaccineAppointment(payload as any, pData);
        return { success: true, message: 'Cita clonada.', originalFolio: data.appointmentNumber, data: res?.data };
    } catch (e: any) { return { success: false, message: e.message }; }
}

// =====================================================================
// EXPORTS: SETTINGS & LOGS
// =====================================================================

export async function getColonias(): Promise<Colonia[]> { return getCatalog<Colonia>('colonias'); }
export async function getAnnouncements(): Promise<string[]> { const data = await getSettingsDoc<{ messages: string[] }>('announcements', { messages: [] }); return data.messages; }
export async function updateAnnouncements(messages: string[]) { return setSettingsDoc('announcements', { messages: messages.slice(0, 4) }); }
export async function getModuleSettings(): Promise<ModuleSettings> { return getSettingsDoc<ModuleSettings>('moduleSettings', { citasMedicasEnabled: true, laboratorioEnabled: true, rayosXEnabled: true, ultrasoundEnabled: true, vacunasEnabled: true, archivoEnabled: true }); }
export async function updateModuleSettings(settings: ModuleSettings) { return setSettingsDoc('moduleSettings', settings); }
export async function getLabSettings(): Promise<LabSettings> { return getSettingsDoc<LabSettings>('labSettings', { dailySlots: 10, weekendBookingEnabled: false, password: '' }); }
export async function updateLabSettings(settings: LabSettings) { return setSettingsDoc('labSettings', settings); }
export async function getLabStudies(): Promise<LabStudy[]> { return getCatalog<LabStudy>('labStudies'); }
export async function updateLabStudies(studies: LabStudy[]) { return updateCatalog('labStudies', studies); }
export async function getXRaySettings(): Promise<XRaySettings> { return getSettingsDoc<XRaySettings>('xraySettings', { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '' }); }
export async function updateXRaySettings(settings: XRaySettings) { return setSettingsDoc('xraySettings', settings); }
export async function getXRayStudies(): Promise<XRayStudy[]> { return getCatalog<XRayStudy>('xrayStudies'); }
export async function updateXRayStudies(studies: XRayStudy[]) { return updateCatalog('xrayStudies', studies); }
export async function getUltrasoundSettings(): Promise<UltrasoundSettings> { return getSettingsDoc<UltrasoundSettings>('ultrasoundSettings', { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '' }); }
export async function updateUltrasoundSettings(settings: UltrasoundSettings) { return setSettingsDoc('ultrasoundSettings', settings); }
export async function getUltrasoundStudies(): Promise<UltrasoundStudy[]> { return getCatalog<UltrasoundStudy>('ultrasoundStudies'); }
export async function updateUltrasoundStudies(studies: UltrasoundStudy[]) { return updateCatalog('ultrasoundStudies', studies); }
export async function getVaccineSettings(): Promise<VaccineSettings> { return getSettingsDoc<VaccineSettings>('vaccineSettings', { dailySlots: 20, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '' }); }
export async function updateVaccineSettings(settings: VaccineSettings) { return setSettingsDoc('vaccineSettings', settings); }
export async function getVaccines(): Promise<Vaccine[]> { return getCatalog<Vaccine>('vaccines'); }
export async function updateVaccines(vaccines: Vaccine[]) { return updateCatalog('vaccines', vaccines); }
export async function updateClinics(clinics: Clinic[]) { return updateCatalog('clinics', clinics); }
export async function updateColonias(colonias: Colonia[]) { return updateCatalog('colonias', colonias); }
export async function getUsers(): Promise<User[]> { return getCatalog<User>('users'); }
export async function updateUsers(users: User[]) { return updateCatalog('users', users); }
export async function getArchiveSettings(): Promise<ArchiveSettings> { return getSettingsDoc<ArchiveSettings>('archiveSettings', { password: '' }); }
export async function updateArchiveSettings(settings: ArchiveSettings) { return setSettingsDoc('archiveSettings', settings); }
export async function verifyArchivePassword(attempt: string) { const s = await getArchiveSettings(); return { isValid: s.password === attempt }; }

export async function verifyClinicPassword(clinicId: string, passwordAttempt: string) { const clinic = await getClinicById(clinicId); return { isValid: clinic?.password === passwordAttempt }; }
export async function verifyLabPassword(p: string) { const s = await getLabSettings(); return { isValid: s.password === p }; }
export async function verifyXRayPassword(p: string) { const s = await getXRaySettings(); return { isValid: s.password === p }; }
export async function verifyUltrasoundPassword(p: string) { const s = await getUltrasoundSettings(); return { isValid: s.password === p }; }
export async function verifyVaccinePassword(p: string) { const s = await getVaccineSettings(); return { isValid: s.password === p }; }

export async function logActivity(action: string, details: string) {
    if (!adminDb) return;
    try { await addDoc(collection(adminDb, 'activityLog'), { action, details, timestamp: Timestamp.now() }); } catch (e) {}
}

export async function getLogs(): Promise<ActivityLog[]> {
    if (!adminDb) return [];
    const q = query(collection(adminDb, 'activityLog'), orderBy('timestamp', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data(), timestamp: (d.data().timestamp as Timestamp).toDate().toISOString() })) as any;
}

// =====================================================================
// EXPORTS: MAINTENANCE & DUPLICATES
// =====================================================================

/**
 * Busca pacientes duplicados usando una carga "ligera" para evitar saturar la memoria.
 * Procesa solo los campos esenciales y limita el escaneo a 5,000 registros.
 */
export async function findDuplicatePatients(): Promise<{ byExpediente: Patient[][]; byCurp: Patient[][]; byName: Patient[][] }> {
    if (!adminDb) throw new Error("Database not initialized.");
    
    // Escaneo limitado para proteger el servidor
    const snap = await getDocs(query(collection(adminDb, 'patients'), limit(5000)));
    
    const all: any[] = snap.docs.map(doc => {
        const d = doc.data();
        // Definir un paciente seguro para serializar
        return {
            id: doc.id,
            name: String(d.name || '').toUpperCase(),
            paternalLastName: String(d.paternalLastName || '').toUpperCase(),
            maternalLastName: String(d.maternalLastName || '').toUpperCase(),
            curp: String(d.curp || '').toUpperCase(),
            expediente: d.expediente ? String(d.expediente) : null,
            phoneNumber: String(d.phoneNumber || ''),
            registrationDate: d.registrationDate ? (d.registrationDate instanceof Timestamp ? d.registrationDate.toDate().toISOString() : String(d.registrationDate)) : null,
        };
    });

    const groupBy = (list: any[], keyGetter: (item: any) => string | null) => {
        const map = new Map<string, any[]>();
        list.forEach((item) => {
            const key = keyGetter(item);
            if (key && key.trim() !== '') {
                const group = map.get(key) || [];
                group.push(item);
                map.set(key, group);
            }
        });
        // Filtrar solo grupos que tengan más de un registro (duplicados)
        return Array.from(map.values()).filter(g => g.length > 1);
    };

    return {
        byExpediente: groupBy(all, p => p.expediente).slice(0, 300),
        byCurp: groupBy(all, p => p.curp && !p.curp.startsWith('RN-') ? p.curp : null).slice(0, 300),
        byName: groupBy(all, p => `${p.name} ${p.paternalLastName} ${p.maternalLastName}`).slice(0, 300),
    };
}

export async function deletePatients(ids: string[]) {
    if (!adminDb) return { success: false };
    const batchSize = 500;
    const chunks = chunkArray(ids, batchSize);
    for (const chunk of chunks) {
        const batch = writeBatch(adminDb);
        chunk.forEach(id => batch.delete(doc(adminDb, 'patients', id)));
        await batch.commit();
    }
    return { success: true, message: `${ids.length} eliminados.` };
}

export async function autoCleanupDuplicatePatients() {
    const dups = await findDuplicatePatients();
    const allGroups = [...dups.byExpediente, ...dups.byCurp, ...dups.byName];
    const idsToDelete = new Set<string>();
    
    allGroups.forEach(group => {
        // Conservar el registro más antiguo
        const sorted = group.sort((a, b) => (a.registrationDate || '').localeCompare(b.registrationDate || ''));
        sorted.slice(1).forEach(p => idsToDelete.add(p.id));
    });
    
    return deletePatients(Array.from(idsToDelete));
}

/**
 * Actualiza el estatus de pacientes por número de expediente en lotes seguros.
 */
export async function bulkUpdateStatusByExpediente(expedientes: string[], status: PatientStatus): Promise<{ success: boolean; updatedCount: number; message: string }> {
    if (!adminDb) throw new Error("Database not initialized.");
    
    const uniqueExps = Array.from(new Set(expedientes.filter(e => e && e.trim() !== '')));
    const chunks = chunkArray(uniqueExps, 10); // Lotes de 10 para evitar error 'IN'
    
    let updatedCount = 0;
    let batch = writeBatch(adminDb);
    let countInBatch = 0;

    for (const batchIds of chunks) {
        if (batchIds.length === 0) continue;
        const q = query(collection(adminDb, 'patients'), where('expediente', 'in', batchIds));
        const snap = await getDocs(q);
        
        for (const d of snap.docs) {
            batch.update(d.ref, { status });
            updatedCount++;
            countInBatch++;
            
            // Confirmar lote cada 500 escrituras
            if (countInBatch >= 500) { 
                await batch.commit(); 
                batch = writeBatch(adminDb); 
                countInBatch = 0; 
            }
        }
    }
    
    if (countInBatch > 0) await batch.commit();
    
    return { success: true, updatedCount, message: `Se actualizaron exitosamente ${updatedCount} registros de pacientes.` };
}

export async function cleanupOldRecords() {
    if (!adminDb) return { deletedCount: 0 };
    const now = new Date();
    const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let totalDeleted = 0;
    
    const collectionsToClean = ['appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments'];
    
    for (const collName of collectionsToClean) {
        const q = query(collection(adminDb, collName), where('date', '<', firstDayCurrentMonth));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            const batch = writeBatch(adminDb);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            totalDeleted += snap.size;
        }
    }
    
    return { deletedCount: totalDeleted };
}

export async function createBackupData() { 
    return { 
        patients: await getPatients(), 
        appointments: await getAppointments(), 
        clinics: await getClinics() 
    }; 
}

export async function restoreBackupData(data: any) { 
    return { success: false, message: 'La restauración desde archivo está deshabilitada por motivos de seguridad en la nube.' }; 
}
