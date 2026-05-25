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
  documentId,
  addDoc,
  getFirestore,
  getCountFromServer,
  increment,
  or,
  and
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
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
  PharmacySettings,
  WarehouseSettings,
  BISettings,
  AdminSettings,
  PatientStatus,
  ArchiveCounts,
  Medication,
  Supply,
  Holiday,
  SpecialActionDay,
  Prescription,
  Specialty,
  MedicalConsultation,
  Cie10Glossary,
  Cie10Record,
} from './definitions';
import { BookingMode, PatientStatus as PatientStatusEnum } from './definitions';

// =====================================================================
// UTILS & DB INITIALIZATION
// =====================================================================

function getDb() {
  const apps = getApps();
  const app = apps.length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app);
}

function serializeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (data instanceof Timestamp || (typeof data.toDate === 'function')) {
    return data.toDate().toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(item => serializeData(item));
  }
  if (typeof data === 'object' && data !== null && !(data instanceof Date)) {
    const serialized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (key === 'expediente' || key === 'derechoAbiencia' || key === 'curp') {
            serialized[key] = (data[key] !== null && data[key] !== undefined) ? String(data[key]).toUpperCase().trim() : null;
        } else {
            serialized[key] = serializeData(data[key]);
        }
      }
    }
    return serialized;
  }
  return data;
}

function normalizeStr(str: string): string {
  return (str || '')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  if (!array) return chunks;
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function getSettingsDoc<T>(docId: string, defaultVal: T): Promise<T> {
  const db = getDb();
  const docRef = doc(db, 'settings', docId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? serializeData(docSnap.data()) as T : defaultVal;
}

async function setSettingsDoc(docId: string, data: any) {
  const db = getDb();
  await setDoc(doc(db, 'settings', docId), data, { merge: true });
  return { success: true };
}

export async function logActivity(action: string, details: string) {
  const db = getDb();
  try {
    await addDoc(collection(db, 'activityLog'), { 
      action, 
      details, 
      timestamp: Timestamp.now() 
    });
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
}

function getTimeToMinutesInternal(t: string): number {
  if (!t || t.includes('Espera') || t.includes('Ficha')) return -1;
  const parts = t.split(':').map(Number);
  if (parts.length !== 2) return -1;
  return parts[0] * 60 + parts[1];
}

/**
 * Checks if a time slot is already occupied.
 * Re-implemented to avoid Firestore composite index errors by filtering in memory.
 */
async function isTimeSlotTaken(
    collectionName: 'appointments' | 'labAppointments' | 'xrayAppointments' | 'ultrasoundAppointments' | 'vaccineAppointments',
    dateIso: string,
    time: string,
    candidateDuration: number = 30,
    clinicId?: string,
    excludeId?: string
): Promise<boolean> {
    const db = getDb();
    
    // Create day range
    const dateObj = new Date(dateIso);
    const start = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0);
    const end = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59);

    // CRITICAL: We only query by date range to avoid requiring a composite index with clinicId.
    // Range filters + Equality filters on different fields REQUIRE a composite index in Firestore.
    // By filtering clinicId in memory, we bypass this restriction.
    let q = query(
        collection(db, collectionName), 
        where('date', '>=', Timestamp.fromDate(start)), 
        where('date', '<=', Timestamp.fromDate(end))
    );
    
    const snap = await getDocs(q);
    
    // Filter by clinicId and excludeId in memory
    const docs = snap.docs.filter(docSnap => {
        if (excludeId && docSnap.id === excludeId) return false;
        const d = docSnap.data();
        if (clinicId && d.clinicId !== clinicId) return false;
        return true;
    });

    const candStart = getTimeToMinutesInternal(time);
    
    if (candStart === -1) {
        // Handle waitlist or tokens by exact match string comparison
        return docs.some(docSnap => docSnap.data().time === time);
    }
    
    const candEnd = candStart + candidateDuration;

    return docs.some(docSnap => {
        const d = docSnap.data();
        const storedStart = getTimeToMinutesInternal(d.time);
        if (storedStart === -1) return false; 
        
        const storedEnd = storedStart + (d.duration || 30);
        
        // Overlap detection: max(start1, start2) < min(end1, end2)
        // If the start of one is before the end of the other, there is a collision
        return Math.max(candStart, storedStart) < Math.min(candEnd, storedEnd);
    });
}

// =====================================================================
// PATIENTS & ARCHIVE
// =====================================================================

export async function getPatientCounts(): Promise<ArchiveCounts> {
  const db = getDb();
  const coll = collection(db, 'patients');
  
  const [totalSnap, vigenteSnap, bajaSnap, definitivaSnap] = await Promise.all([
    getCountFromServer(coll),
    getCountFromServer(query(coll, where('status', '==', PatientStatusEnum.Vigente))),
    getCountFromServer(query(coll, where('status', '==', PatientStatusEnum.Baja))),
    getCountFromServer(query(coll, where('status', '==', PatientStatusEnum.BajaDefinitiva)))
  ]);

  return {
    total: totalSnap.data().count,
    vigente: vigenteSnap.data().count,
    bajaTemporal: bajaSnap.data().count,
    bajaDefinitiva: definitivaSnap.data().count
  };
}

export async function getPatients(options?: { 
  status?: string | 'Total', 
  searchName?: string, 
  searchCurp?: string, 
  searchExpediente?: string,
  limitNum?: number 
}): Promise<Patient[]> {
  const db = getDb();
  const patientsColl = collection(db, 'patients');
  
  try {
    if (options?.searchCurp) {
        const term = options.searchCurp.toUpperCase().trim();
        const q = query(patientsColl, where('curp', '==', term), limit(1));
        const snap = await getDocs(q);
        return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }));
    }

    if (options?.searchExpediente) {
        const term = options.searchExpediente.toString().trim();
        const qStr = query(patientsColl, where('expediente', '==', term), limit(5));
        const snapStr = await getDocs(qStr);
        let results = snapStr.docs.map(d => serializeData({ id: d.id, ...d.data() }));
        
        if (results.length === 0 && !isNaN(Number(term))) {
          const qNum = query(patientsColl, where('expediente', '==', Number(term)), limit(5));
          const snapNum = await getDocs(qNum);
          results = snapNum.docs.map(d => serializeData({ id: d.id, ...d.data() }));
        }
        return results;
    }

    if (options?.searchName) {
        const fullTerm = normalizeStr(options.searchName);
        const words = fullTerm.split(/\s+/).filter(w => w.length >= 2);
        
        if (words.length === 0) return [];

        const searchWord = words.sort((a, b) => b.length - a.length)[0];
        
        const promises = [
            getDocs(query(patientsColl, where('name', '>=', searchWord), where('name', '<=', searchWord + '\uf8ff'), limit(200))),
            getDocs(query(patientsColl, where('paternalLastName', '>=', searchWord), where('paternalLastName', '<=', searchWord + '\uf8ff'), limit(200))),
            getDocs(query(patientsColl, where('maternalLastName', '>=', searchWord), where('maternalLastName', '<=', searchWord + '\uf8ff'), limit(200)))
        ];

        const snaps = await Promise.all(promises);
        const combinedMap = new Map();
        
        snaps.forEach(snap => {
            snap.docs.forEach(d => {
                combinedMap.set(d.id, serializeData({ id: d.id, ...d.data() }));
            });
        });

        let results = Array.from(combinedMap.values()).filter(p => {
            const patientFullName = normalizeStr(`${p.name} ${p.paternalLastName} ${p.maternalLastName}`);
            return words.every(word => patientFullName.includes(word));
        });

        if (options?.status && options.status !== 'Total') {
            results = results.filter(p => p.status === options.status);
        }
        
        return results.slice(0, 100);
    }

    let q = query(patientsColl);
    if (options?.status && options.status !== 'Total') {
      q = query(q, where('status', '==', options.status));
    }

    const snap = await getDocs(query(q, limit(options?.limitNum || 1000)));
    return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Patient);

  } catch (error: any) {
    console.error("Error en consulta de pacientes:", error);
    throw error;
  }
}

export async function getPatientByCURP(curp: string): Promise<Patient | null> {
  const db = getDb();
  if (!curp) return null;
  const q = query(collection(db, 'patients'), where('curp', '==', curp.toUpperCase().trim()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return serializeData({ id: snap.docs[0].id, ...snap.docs[0].data() }) as Patient;
}

export async function savePatient(patient: Omit<Patient, 'id'>, id?: string) {
  const db = getDb();
  const docId = id || uuidv4();
  const dataToSave = { ...patient, name: normalizeStr(patient.name), paternalLastName: normalizeStr(patient.paternalLastName), maternalLastName: normalizeStr(patient.maternalLastName), expediente: patient.expediente ? String(patient.expediente).trim() : null, derechoAbiencia: patient.derechoAbiencia ? String(patient.derechoAbiencia).trim().toUpperCase() : null, curp: String(patient.curp).toUpperCase().trim(), status: patient.status || PatientStatusEnum.Vigente, updatedAt: Timestamp.now() };
  await setDoc(doc(db, 'patients', docId), dataToSave, { merge: true });
  return { success: true };
}

export async function updatePatient(id: string, data: Partial<Omit<Patient, 'id'>>) {
  const db = getDb();
  const updateData: any = { ...data, updatedAt: Timestamp.now() };
  if (data.name) updateData.name = normalizeStr(data.name);
  if (data.paternalLastName) updateData.paternalLastName = normalizeStr(data.paternalLastName);
  if (data.maternalLastName) updateData.maternalLastName = normalizeStr(data.maternalLastName);
  if (data.expediente !== undefined) updateData.expediente = data.expediente ? String(data.expediente).trim() : null;
  if (data.derechoAbiencia !== undefined) updateData.derechoAbiencia = data.derechoAbiencia ? String(data.derechoAbiencia).trim().toUpperCase() : null;
  if (data.curp !== undefined) updateData.curp = String(data.curp).toUpperCase().trim();
  await updateDoc(doc(db, 'patients', id), updateData);
  return { success: true };
}

export async function deletePatient(id: string) {
  const db = getDb();
  await deleteDoc(doc(db, 'patients', id));
  return { success: true };
}

export async function deletePatients(ids: string[]) {
  const db = getDb();
  if (!ids || ids.length === 0) return { success: true };
  const chunks = chunkArray(ids, 500); 
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(id => batch.delete(doc(db, 'patients', id)));
    await batch.commit();
  }
  return { success: true };
}

export async function updatePatientStatus(id: string, status: PatientStatus) {
  const db = getDb();
  await updateDoc(doc(db, 'patients', id), { status, updatedAt: Timestamp.now() });
  return { success: true };
}

// =====================================================================
// APPOINTMENTS
// =====================================================================

async function enrichWithPatientData(apps: any[]): Promise<any[]> {
  const db = getDb();
  if (!apps || apps.length === 0) return apps;
  const patientIds = Array.from(new Set(apps.map(a => a.patientId).filter(id => id && typeof id === 'string')));
  if (patientIds.length === 0) return apps.map(a => serializeData(a));
  const patientsMap: Record<string, Patient> = {};
  const chunks = chunkArray(patientIds, 10); 
  for (const batch of chunks) {
    const q = query(collection(db, 'patients'), where(documentId(), 'in', batch));
    const snap = await getDocs(q);
    snap.forEach(d => { patientsMap[d.id] = serializeData({ id: d.id, ...d.data() }) as Patient; });
  }
  return apps.map(app => serializeData({ ...app, patient: patientsMap[app.patientId] || null }));
}

export async function getAppointments(): Promise<Appointment[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc'), limit(1000)));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return await enrichWithPatientData(data) as Appointment[];
}

export async function getAppointmentsForCalendar(month: number, year: number): Promise<any[]> {
  const db = getDb();
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);
  const q = query(collection(db, 'appointments'), where('date', '>=', Timestamp.fromDate(startDate)), where('date', '<=', Timestamp.fromDate(endDate)));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return { id: d.id, date: (data.date as Timestamp).toDate().toISOString(), time: String(data.time), clinicId: data.clinicId, duration: data.duration || 30 };
  });
}

export async function getAppointmentsForClinic(clinicId: string): Promise<Appointment[]> {
  const db = getDb();
  const q = query(collection(db, 'appointments'), where('clinicId', '==', clinicId), limit(1000));
  const snap = await getDocs(q);
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  data.sort((a: any, b: any) => (b.date as Timestamp).toMillis() - (a.date as Timestamp).toMillis());
  return await enrichWithPatientData(data) as Appointment[];
}

export async function getAppointmentCountOnDate(clinicId: string, dateStr: string): Promise<number> {
  const db = getDb();
  const q = query(collection(db, 'appointments'), where('clinicId', '==', clinicId));
  const snap = await getDocs(q);
  return snap.docs.filter(doc => {
    const d = doc.data();
    return (d.date as Timestamp).toDate().toISOString().split('T')[0] === dateStr;
  }).length;
}

export async function getLabAppointments(): Promise<LabAppointment[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'labAppointments'), orderBy('date', 'desc'), limit(1000)));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return await enrichWithPatientData(data) as LabAppointment[];
}

export async function getXRayAppointments(): Promise<XRayAppointment[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'xrayAppointments'), orderBy('date', 'desc'), limit(1000)));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return await enrichWithPatientData(data) as XRayAppointment[];
}

export async function getUltrasoundAppointments(): Promise<UltrasoundAppointment[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'ultrasoundAppointments'), orderBy('date', 'desc'), limit(1000)));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return await enrichWithPatientData(data) as UltrasoundAppointment[];
}

export async function getVaccineAppointments(): Promise<VaccineAppointment[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'vaccineAppointments'), orderBy('date', 'desc'), limit(1000)));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return await enrichWithPatientData(data) as VaccineAppointment[];
}

export async function saveAppointment(appointment: any, patientInput: any, isDoubleSlot: boolean = false, coloniaName?: string) {
  const db = getDb();
  try {
    const clinicData = await getClinicById(appointment.clinicId);
    if (!clinicData) return { success: false, error: "La clínica no existe." };
    
    const baseDuration = clinicData.consultationDuration || 30;
    const finalDuration = isDoubleSlot ? baseDuration * 2 : baseDuration;

    // Check for collisions using the candidate duration
    const taken = await isTimeSlotTaken('appointments', appointment.date, appointment.time, finalDuration, appointment.clinicId);
    if (taken) return { success: false, error: "Horario/Ficha ya ocupado para este núcleo básico." };

    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    
    const batch = writeBatch(db);
    let patientId = existingPatient ? existingPatient.id : uuidv4();
    const cleanPatient = { curp, id: patientId, name: normalizeStr(patientInput.name), paternalLastName: normalizeStr(patientInput.paternalLastName), maternalLastName: normalizeStr(patientInput.maternalLastName), sex: patientInput.sex, age: Number(patientInput.age) || 0, birthDate: patientInput.birthDate || '', birthState: String(patientInput.birthState || '').toUpperCase().trim(), phoneNumber: String(patientInput.phoneNumber || '').trim(), coloniaName: coloniaName || patientInput.coloniaName || null, status: patientInput.status || PatientStatusEnum.Vigente, fatherName: normalizeStr(patientInput.fatherName) || null, motherName: normalizeStr(patientInput.motherName) || null, fatherAge: Number(patientInput.fatherAge) || null, motherAge: Number(patientInput.motherAge) || null, registrationDate: patientInput.registrationDate || null, derechoAbiencia: String(patientInput.derechoAbiencia || '').toUpperCase().trim() || null, expediente: patientInput.expediente ? String(patientInput.expediente).trim() : null, updatedAt: Timestamp.now() };
    batch.set(doc(db, 'patients', patientId), cleanPatient, { merge: true });
    
    const appRef = doc(collection(db, 'appointments'));
    const appointmentNumber = `FOLIO-${uuidv4().split('-')[0].toUpperCase()}`;
    const cleanApp = { 
        appointmentNumber, 
        patientId, 
        clinicId: appointment.clinicId, 
        date: Timestamp.fromDate(new Date(appointment.date)), 
        time: String(appointment.time), 
        duration: finalDuration, 
        patientType: appointment.patientType, 
        status: appointment.status || 'Agendada', 
        coloniaName: coloniaName || null, 
        createdAt: Timestamp.now() 
    };
    batch.set(appRef, cleanApp);
    await batch.commit();
    return { success: true, data: serializeData({ appointment: { ...cleanApp, id: appRef.id, patient: cleanPatient }, clinic: clinicData }) };
  } catch (e: any) { 
      console.error("Save appointment error:", e);
      return { success: false, error: e.message }; 
  }
}

export async function saveLabAppointment(appointment: any, patientInput: any) {
  const db = getDb();
  try {
    const taken = await isTimeSlotTaken('labAppointments', appointment.date, appointment.time);
    if (appointment.time !== "Recepción General" && taken) return { success: false, error: "Turno ya ocupado." };
    
    if (appointment.time === "Recepción General") {
        const selectedDate = appointment.date.split('T')[0];
        const q = query(collection(db, 'labAppointments'), where('time', '==', 'Recepción General'));
        const snap = await getDocs(q);
        const count = snap.docs.filter(d => (d.data().date as Timestamp).toDate().toISOString().split('T')[0] === selectedDate).length;
        const s = await getLabSettings();
        if (count >= s.dailySlots) return { success: false, error: "Cupo lleno para recepción general." };
    }

    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    const batch = writeBatch(db);
    const patientId = existingPatient ? existingPatient.id : uuidv4();
    const cleanPatient = { curp, id: patientId, name: normalizeStr(patientInput.name), paternalLastName: normalizeStr(patientInput.paternalLastName), maternalLastName: normalizeStr(patientInput.maternalLastName), sex: patientInput.sex, age: Number(patientInput.age) || 0, birthState: String(patientInput.birthState || '').toUpperCase().trim(), phoneNumber: String(patientInput.phoneNumber || '').trim(), updatedAt: Timestamp.now() };
    batch.set(doc(db, 'patients', patientId), cleanPatient, { merge: true });
    const appRef = doc(collection(db, 'labAppointments'));
    const cleanApp = { appointmentNumber: appointment.appointmentNumber, patientId, date: Timestamp.fromDate(new Date(appointment.date)), time: String(appointment.time), studies: appointment.studies, status: 'Agendada', patientType: appointment.patientType, createdAt: Timestamp.now() };
    batch.set(appRef, cleanApp);
    await batch.commit();
    return { success: true, data: serializeData({ ...cleanApp, id: appRef.id, patient: cleanPatient }) };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function saveNewXRayAppointment(appointment: any, patientInput: any) {
  try {
    const taken = await isTimeSlotTaken('xrayAppointments', appointment.date, appointment.time);
    if (taken) return { success: false, error: "Horario ocupado." };

    const db = getDb();
    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    const batch = writeBatch(db);
    const patientId = existingPatient ? existingPatient.id : uuidv4();
    const cleanPatient = { curp, id: patientId, name: normalizeStr(patientInput.name), paternalLastName: normalizeStr(patientInput.paternalLastName), maternalLastName: normalizeStr(patientInput.maternalLastName), sex: patientInput.sex, age: Number(patientInput.age) || 0, birthState: String(patientInput.birthState || '').toUpperCase().trim(), phoneNumber: String(patientInput.phoneNumber || '').trim(), updatedAt: Timestamp.now() };
    batch.set(doc(db, 'patients', patientId), cleanPatient, { merge: true });
    const appRef = doc(collection(db, 'xrayAppointments'));
    const cleanApp = { appointmentNumber: appointment.appointmentNumber, patientId, date: Timestamp.fromDate(new Date(appointment.date)), time: String(appointment.time), studyId: appointment.studyId, studyName: appointment.studyName, status: 'Agendada', patientType: appointment.patientType, createdAt: Timestamp.now() };
    batch.set(appRef, cleanApp);
    await batch.commit();
    return { success: true, data: serializeData({ appointment: { ...cleanApp, id: appRef.id, patient: cleanPatient }, study: { name: appointment.studyName, indications: '' } }) };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function saveNewUltrasoundAppointment(appointment: any, patientInput: any) {
  try {
    const taken = await isTimeSlotTaken('ultrasoundAppointments', appointment.date, appointment.time);
    if (taken) return { success: false, error: "Horario ocupado." };

    const db = getDb();
    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    const batch = writeBatch(db);
    const patientId = existingPatient ? existingPatient.id : uuidv4();
    const cleanPatient = { curp, id: patientId, name: normalizeStr(patientInput.name), paternalLastName: normalizeStr(patientInput.paternalLastName), maternalLastName: normalizeStr(patientInput.maternalLastName), sex: patientInput.sex, age: Number(patientInput.age) || 0, birthState: String(patientInput.birthState || '').toUpperCase().trim(), phoneNumber: String(patientInput.phoneNumber || '').trim(), updatedAt: Timestamp.now() };
    batch.set(doc(db, 'patients', patientId), cleanPatient, { merge: true });
    const appRef = doc(collection(db, 'ultrasoundAppointments'));
    const cleanApp = { appointmentNumber: appointment.appointmentNumber, patientId, date: Timestamp.fromDate(new Date(appointment.date)), time: String(appointment.time), studyId: appointment.studyId, studyName: appointment.studyName, status: 'Agendada', patientType: appointment.patientType, createdAt: Timestamp.now() };
    batch.set(appRef, cleanApp);
    await batch.commit();
    return { success: true, data: serializeData({ appointment: { ...cleanApp, id: appRef.id, patient: cleanPatient }, study: { name: appointment.studyName, indications: '' } }) };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function saveNewVaccineAppointment(appointment: any, patientInput: any) {
  try {
    const taken = await isTimeSlotTaken('vaccineAppointments', appointment.date, appointment.time, 30, appointment.clinicId);
    if (taken) return { success: false, error: "Horario ocupado." };

    const db = getDb();
    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    const batch = writeBatch(db);
    const patientId = existingPatient ? existingPatient.id : uuidv4();
    const cleanPatient = { curp, id: patientId, name: normalizeStr(patientInput.name), paternalLastName: normalizeStr(patientInput.paternalLastName), maternalLastName: normalizeStr(patientInput.maternalLastName), sex: patientInput.sex, age: Number(patientInput.age) || 0, birthState: String(patientInput.birthState || '').toUpperCase().trim(), phoneNumber: String(patientInput.phoneNumber || '').trim(), coloniaName: appointment.coloniaName || null, updatedAt: Timestamp.now() };
    batch.set(doc(db, 'patients', patientId), cleanPatient, { merge: true });
    const appRef = doc(collection(db, 'vaccineAppointments'));
    const cleanApp = { appointmentNumber: appointment.appointmentNumber, patientId, date: Timestamp.fromDate(new Date(appointment.date)), time: String(appointment.time), vaccines: appointment.vaccines, status: 'Agendada', patientType: appointment.patientType, coloniaName: appointment.coloniaName || null, createdAt: Timestamp.now() };
    batch.set(appRef, cleanApp);
    await batch.commit();
    return { success: true, data: serializeData({ ...cleanApp, id: appRef.id, patient: cleanPatient }) };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function deleteAppointment(id: string) { const db = getDb(); await deleteDoc(doc(db, 'appointments', id)); return id; }
export async function deleteLabAppointment(id: string) { const db = getDb(); await deleteDoc(doc(db, 'labAppointments', id)); return id; }
export async function deleteXRayAppointment(id: string) { const db = getDb(); await deleteDoc(doc(db, 'xrayAppointments', id)); return id; }
export async function deleteUltrasoundAppointment(id: string) { const db = getDb(); await deleteDoc(doc(db, 'ultrasoundAppointments', id)); return id; }
export async function deleteVaccineAppointment(id: string) { const db = getDb(); await deleteDoc(doc(db, 'vaccineAppointments', id)); return id; }

export async function updateAppointmentStatus(id: string, status: AppointmentStatus, type: string) {
  const db = getDb();
  const collMap: Record<string, string> = { 'medical': 'appointments', 'lab': 'labAppointments', 'xray': 'xrayAppointments', 'ultrasound': 'ultrasoundAppointments', 'vaccine': 'vaccineAppointments' };
  await updateDoc(doc(db, collMap[type] || 'appointments', id), { status });
  return { success: true };
}

// =====================================================================
// MEDICAL CONSULTATIONS
// =====================================================================

export async function saveMedicalConsultation(consultation: any) {
    const db = getDb();
    try {
        const { id, isFinal, ...rest } = consultation;
        const docId = id || uuidv4();
        
        const data: any = { 
            ...rest, 
            id: docId, 
            updatedAt: Timestamp.now(),
        };

        if (!id) {
            data.createdAt = Timestamp.now();
        }
        
        await setDoc(doc(db, 'medicalConsultations', docId), data, { merge: true });
        
        if (isFinal) {
            await updateDoc(doc(db, 'appointments', rest.appointmentId), { status: 'Atendido' });
        }
        
        return { success: true, id: docId };
    } catch (e: any) {
        console.error("Save consultation error:", e);
        return { success: false, message: e.message };
    }
}

export async function getConsultationByAppointmentId(appointmentId: string): Promise<MedicalConsultation | null> {
    const db = getDb();
    const q = query(collection(db, 'medicalConsultations'), where('appointmentId', '==', appointmentId), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return serializeData({ id: snap.docs[0].id, ...snap.docs[0].data() }) as MedicalConsultation;
}

export async function getConsultationsByPatientId(patientId: string): Promise<MedicalConsultation[]> {
  const db = getDb();
  if (!patientId) return [];

  const colRef = collection(db, 'medicalConsultations');
  // Simple equality query on patientId is safe from composite index requirements
  const q = query(colRef, where('patientId', '==', String(patientId)));
  
  try {
    const snap = await getDocs(q);
    const results = snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as MedicalConsultation);
    
    // Perform chronologic sorting in memory to avoid needing composite indexes in Firestore
    return results.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA); // Most recent first
    });
  } catch (e) {
    console.error("Error fetching patient consultations history:", e);
    return [];
  }
}

export async function deleteMedicalConsultation(id: string) {
    const db = getDb();
    await deleteDoc(doc(db, 'medicalConsultations', id));
    return { success: true };
}

export async function getAttendedPatientsForClinic(clinicId: string): Promise<Patient[]> {
  const db = getDb();
  const q = query(collection(db, 'medicalConsultations'), where('clinicId', '==', clinicId));
  const snap = await getDocs(q);
  
  const patientIds = Array.from(new Set(snap.docs.map(d => d.data().patientId)));
  if (patientIds.length === 0) return [];
  
  const patients: Patient[] = [];
  const chunks = chunkArray(patientIds, 10);
  for (const chunk of chunks) {
    const pq = query(collection(db, 'patients'), where(documentId(), 'in', chunk));
    const psnap = await getDocs(pq);
    psnap.forEach(d => patients.push(serializeData({ id: d.id, ...d.data() }) as Patient));
  }
  return patients.sort((a, b) => a.name.localeCompare(b.name));
}

// =====================================================================
// SETTINGS
// =====================================================================

export async function getClinics(): Promise<Clinic[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, 'clinics'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Clinic);
}

export async function getClinicById(id: string): Promise<Clinic | null> {
  const db = getDb();
  const d = await getDoc(doc(db, 'clinics', id));
  return d.exists() ? serializeData({ id: d.id, ...d.data() }) as Clinic : null;
}

export async function updateClinics(clinics: Clinic[]) {
  const db = getDb();
  const batch = writeBatch(db);
  clinics.forEach(c => batch.set(doc(db, 'clinics', c.id), c));
  await batch.commit();
  return { success: true };
}

export async function deleteClinic(id: string) {
    const db = getDb();
    await deleteDoc(doc(db, 'clinics', id));
    return { success: true };
}

export async function getColonias(): Promise<Colonia[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, 'colonias'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Colonia);
}

export async function updateColonias(colonias: Colonia[]) {
  const db = getDb();
  const snap = await getDocs(collection(db, 'colonias'));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  colonias.forEach(c => batch.set(doc(db, 'colonias', c.id || uuidv4()), c));
  await batch.commit();
  return { success: true };
}

export async function getAnnouncements() { return (await getSettingsDoc<{ messages: string[] }>('announcements', { messages: [] })).messages; }
export async function updateAnnouncements(m: string[]) { return setSettingsDoc('announcements', { messages: m.slice(0, 4) }); }

export async function getModuleSettings() { 
  return getSettingsDoc<ModuleSettings>('moduleSettings', { 
    citasMedicasEnabled: true, laboratorioEnabled: true, rayosXEnabled: true, ultrasoundEnabled: true, vacunasEnabled: true, archivoEnabled: true, farmaciaEnabled: true, almacenEnabled: true, archivoConsultaEnabled: true, citasMedicasWhatsAppEnabled: true, laboratorioWhatsAppEnabled: true, rayosXWhatsAppEnabled: true, ultrasoundWhatsAppEnabled: true, vacunasWhatsAppEnabled: true, archivoWhatsAppEnabled: true
  }); 
}
export async function updateModuleSettings(s: ModuleSettings) { return setSettingsDoc('moduleSettings', s); }

export async function getLabSettings() { return getSettingsDoc<LabSettings>('labSettings', { dailySlots: 10, waitlistSlots: 0, weekendBookingEnabled: false, password: '', startTime: '08:00', endTime: '13:00', breakTime: '' }); }
export async function updateLabSettings(s: LabSettings) { return setSettingsDoc('labSettings', s); }

export async function getLabStudies() {
  const db = getDb();
  const snap = await getDocs(collection(db, 'labStudies'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as LabStudy);
}
export async function updateLabStudies(studies: LabStudy[]) {
  const db = getDb();
  const snap = await getDocs(collection(db, 'labStudies'));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  studies.forEach(s => batch.set(doc(db, 'labStudies', s.id || uuidv4()), s));
  await batch.commit();
  return { success: true };
}

export async function getXRaySettings() { return getSettingsDoc<XRaySettings>('xraySettings', { dailySlots: 10, waitlistSlots: 0, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '', breakTime: '' }); }
export async function updateXRaySettings(s: XRaySettings) { return setSettingsDoc('xraySettings', s); }

export async function getXRayStudies() {
  const db = getDb();
  const snap = await getDocs(collection(db, 'xrayStudies'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as XRayStudy);
}
export async function updateXRayStudies(studies: XRayStudy[]) {
  const db = getDb();
  const snap = await getDocs(collection(db, 'xrayStudies'));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  studies.forEach(s => batch.set(doc(db, 'xrayStudies', s.id || uuidv4()), s));
  await batch.commit();
  return { success: true };
}

export async function getUltrasoundSettings() { return getSettingsDoc<UltrasoundSettings>('ultrasoundSettings', { dailySlots: 10, waitlistSlots: 0, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '', breakTime: '' }); }
export async function updateUltrasoundSettings(s: UltrasoundSettings) { return setSettingsDoc('ultrasoundSettings', s); }

export async function getUltrasoundStudies() {
  const db = getDb();
  const snap = await getDocs(collection(db, 'ultrasoundStudies'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as UltrasoundStudy);
}
export async function updateUltrasoundStudies(studies: UltrasoundStudy[]) {
  const db = getDb();
  const snap = await getDocs(collection(db, 'ultrasoundStudies'));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  studies.forEach(s => batch.set(doc(db, 'ultrasoundStudies', s.id || uuidv4()), s));
  await batch.commit();
  return { success: true };
}

export async function getVaccineSettings() { return getSettingsDoc<VaccineSettings>('vaccineSettings', { dailySlots: 20, waitlistSlots: 0, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, password: '', breakTime: '' }); }
export async function updateVaccineSettings(s: VaccineSettings) { return setSettingsDoc('vaccineSettings', s); }

export async function getVaccines() {
  const db = getDb();
  const snap = await getDocs(collection(db, 'vaccines'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Vaccine);
}
export async function updateVaccines(vaccines: Vaccine[]) {
  const db = getDb();
  const batch = writeBatch(db);
  const snap = await getDocs(collection(db, 'vaccines'));
  snap.docs.forEach(d => batch.delete(d.ref));
  vaccines.forEach(v => batch.set(doc(db, 'vaccines', v.id || uuidv4()), v));
  await batch.commit();
  return { success: true };
}

export async function getUsers(): Promise<User[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as User);
}
export async function updateUsers(users: User[]) {
  const db = getDb();
  const batch = writeBatch(db);
  users.forEach(u => batch.set(doc(db, 'users', u.id), u));
  await batch.commit();
  return { success: true };
}

export async function getArchiveSettings() { return getSettingsDoc<ArchiveSettings>('archiveSettings', { password: '' }); }
export async function updateArchiveSettings(s: ArchiveSettings) { return setSettingsDoc('archiveSettings', s); }

export async function getPharmacySettings() { return getSettingsDoc<PharmacySettings>('pharmacySettings', { password: '' }); }
export async function updatePharmacySettings(s: PharmacySettings) { return setSettingsDoc('pharmacySettings', s); }

export async function getWarehouseSettings() { return getSettingsDoc<WarehouseSettings>('warehouseSettings', { password: '' }); }
export async function updateWarehouseSettings(s: WarehouseSettings) { return setSettingsDoc('warehouseSettings', s); }

export async function getBISettings() { return getSettingsDoc<BISettings>('biSettings', { password: '' }); }
export async function updateBISettings(s: BISettings) { return setSettingsDoc('biSettings', s); }

export async function getAdminSettings() { return getSettingsDoc<AdminSettings>('adminSettings', { password: 'Hu1m4ngu1ll0' }); }
export async function updateAdminSettings(s: AdminSettings) { return setSettingsDoc('adminSettings', s); }

export async function verifyArchivePassword(p: string) { const s = await getArchiveSettings(); return { success: s.password === p }; }
export async function verifyPharmacyPassword(p: string) { const s = await getPharmacySettings(); return { success: s.password === p }; }
export async function verifyWarehousePassword(p: string) { const s = await getWarehouseSettings(); return { success: s.password === p }; }
export async function verifyClinicPassword(id: string, p: string) { const c = await getClinicById(id); return { success: c?.password === p }; }
export async function verifyLabPassword(p: string) { const s = await getLabSettings(); return { success: s.password === p }; }
export async function verifyXRayPassword(p: string) { const s = await getXRaySettings(); return { success: s.password === p }; }
export async function verifyUltrasoundPassword(p: string) { const s = await getUltrasoundSettings(); return { success: s.password === p }; }
export async function verifyVaccinePassword(p: string) { const s = await getVaccineSettings(); return { success: s.password === p }; }
export async function verifyBIPassword(p: string) { const s = await getBISettings(); return { success: s.password === p }; }
export async function verifyAdminPassword(p: string) { const s = await getAdminSettings(); return { success: s.password === p }; }
export async function verifyCitasMedicasPassword(p: string) { const s = await getModuleSettings(); return { success: s.citasMedicasPassword === p }; }

export async function getLogs(): Promise<ActivityLog[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'activityLog'), orderBy('timestamp', 'desc'), limit(500)));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as ActivityLog);
}

export async function getHolidays(): Promise<Holiday[]> {
  return (await getSettingsDoc<{ items: Holiday[] }>('holidays', { items: [] })).items;
}

export async function updateHolidays(holidays: Holiday[]) {
  return setSettingsDoc('holidays', { items: holidays });
}

export async function getSpecialActionDays(): Promise<SpecialActionDay[]> {
    return (await getSettingsDoc<{ items: SpecialActionDay[] }>('specialActionDays', { items: [] })).items;
}

export async function updateSpecialActionDays(items: SpecialActionDay[]) {
    return setSettingsDoc('specialActionDays', { items });
}

// =====================================================================
// SPECIALTIES
// =====================================================================

export async function getSpecialties(): Promise<Specialty[]> {
  const db = getDb();
  const snap = await getDocs(collection(db, 'specialties'));
  let results = snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Specialty);
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateSpecialties(specialties: Specialty[]) {
  const db = getDb();
  const snap = await getDocs(collection(db, 'specialties'));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  specialties.forEach(s => { const id = s.id || uuidv4(); batch.set(doc(db, 'specialties', id), { ...s, id }); });
  await batch.commit();
  return { success: true };
}

// =====================================================================
// INVENTORY
// =====================================================================

async function getInventoryItems(col: string): Promise<Medication[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, col), limit(5000)));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Medication);
}

async function bulkInsertInventory(col: string, chunk: any[]) {
  const db = getDb();
  if (!chunk || chunk.length === 0) return { success: false };
  try {
    const batch = writeBatch(db);
    let processed = 0;
    for (const raw of chunk) {
      const clave = String(raw['CLAVE DE CUADRO BASICO'] || '').trim();
      const desc = String(raw['DESCRIPCIÓN'] || '').trim().toUpperCase();
      if (!clave && !desc) continue;
      const itemData: Partial<Medication> = { claveCuadroBasico: clave, descripcion: desc, grupo: String(raw['GRUPO'] || '').trim(), existencia: Number(raw['EXISTENCIA']) || 0, precioUnitario: Number(raw['PRECIO UNITARIO']) || 0, totalImporte: Number(raw['TOTAL IMPORTE']) || 0, lote: String(raw['LOTE'] || '').trim(), proveedor: String(raw['PROVEEDOR'] || '').trim(), rfcProveedor: String(raw['RFC PROVEEDOR'] || '').trim(), almacen: String(raw['ALMACEN'] || '').trim(), fuenteFinanciamiento: String(raw['FUENTE FINANCIAMIENTO'] || '').trim(), fechaCaducidad: String(raw['FECHA CADUCIDAD'] || '').trim(), ordenSuministro: String(raw['ORDEN SUMINISTRO'] || '').trim(), tipoInsumo: String(raw['TIPO_INSUMO'] || '').trim(), numeroContrato: String(raw['NUMERO DE CONTRATO'] || '').trim(), updatedAt: new Date().toISOString() };
      const docId = uuidv4();
      batch.set(doc(db, col, docId), { ...itemData, id: docId });
      processed++;
    }
    await batch.commit();
    return { success: true, processedCount: processed };
  } catch (e: any) { return { success: false, message: e.message }; }
}

async function deleteInventoryItems(col: string) {
  const db = getDb();
  const snap = await getDocs(collection(db, col));
  const chunks = chunkArray(snap.docs, 500);
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return { success: true };
}

export async function getMedications() { return getInventoryItems('medications'); }
export async function bulkInsertMedications(chunk: any[]) { return bulkInsertInventory('medications', chunk); }
export async function deleteAllMedications() { return deleteInventoryItems('medications'); }
export async function getSupplies() { return getInventoryItems('supplies'); }
export async function bulkInsertSupplies(chunk: any[]) { return bulkInsertInventory('supplies', chunk); }
export async function deleteAllSupplies() { return deleteInventoryItems('supplies'); }

// =====================================================================
// PRESCRIPTIONS
// =====================================================================

export async function createPrescription(data: Omit<Prescription, 'id' | 'folio' | 'status'>) {
    const db = getDb();
    try {
        const id = uuidv4();
        const folio = `REC-${uuidv4().split('-')[0].toUpperCase()}`;
        const expiresAt = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString();
        const prescription: Prescription = { ...data, id, folio, expiresAt, status: 'pendiente' };
        await setDoc(doc(db, 'prescriptions', id), prescription);
        return { success: true, folio, prescription: serializeData(prescription) };
    } catch (e: any) { return { success: false, message: e.message }; }
}

export async function updatePrescription(id: string, data: Partial<Prescription>) {
    const db = getDb();
    try {
        await updateDoc(doc(db, 'prescriptions', id), {
            ...data,
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    } catch (e: any) { return { success: false, message: e.message }; }
}

export async function deletePrescription(id: string) {
    const db = getDb();
    try {
        await deleteDoc(doc(db, 'prescriptions', id));
        return { success: true };
    } catch (e: any) { return { success: false, message: e.message }; }
}

export async function getPendingPrescriptions(filter?: { folio?: string, clinicId?: string }) {
    const db = getDb();
    let q = query(collection(db, 'prescriptions'), where('status', '==', 'pendiente'));
    if (filter?.folio) { q = query(q, where('folio', '==', filter.folio.toUpperCase().trim())); }
    if (filter?.clinicId && filter.clinicId !== 'all') { q = query(q, where('clinicId', '==', filter.clinicId)); }
    const snap = await getDocs(q);
    const now = new Date().getTime();
    return snap.docs.map(d => serializeData(d.data()) as Prescription).filter(p => new Date(p.expiresAt).getTime() > now).sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPrescriptionHistory(filter: { startDate?: string, endDate?: string, clinicId?: string }) {
    const db = getDb();
    let q = query(collection(db, 'prescriptions'));
    if (filter.startDate || filter.endDate) {
        if (filter.startDate) q = query(q, where('date', '>=', filter.startDate));
        if (filter.endDate) q = query(q, where('date', '<=', filter.endDate));
    } else {
        q = query(q, where('status', '==', 'surtida'));
    }
    const snap = await getDocs(q);
    let results = snap.docs.map(d => serializeData(d.data()) as Prescription);
    results = results.filter(p => p.status === 'surtida');
    if (filter.clinicId && filter.clinicId !== 'all') {
        results = results.filter(p => p.clinicId === filter.clinicId);
    }
    return results.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getPrescriptionsByPatientId(patientId: string): Promise<Prescription[]> {
    const db = getDb();
    const q = query(collection(db, 'prescriptions'), where('patientId', '==', patientId));
    const snap = await getDocs(q);
    return snap.docs.map(d => serializeData(d.data()) as Prescription).sort((a, b) => b.date.localeCompare(a.date));
}

export async function dispensePrescription(prescriptionId: string, itemsToDispense?: { medicationId: string, quantity: number }[]) {
    const db = getDb();
    try {
        const pRef = doc(db, 'prescriptions', prescriptionId);
        const pSnap = await getDoc(pRef);
        if (!pSnap.exists()) return { success: false, message: "Receta no encontrada." };
        const prescription = serializeData(pSnap.data()) as Prescription;
        if (prescription.status !== 'pendiente') return { success: false, message: "Esta receta ya ha sido procesada." };
        
        const batch = writeBatch(db);
        const dispenseList = itemsToDispense || prescription.items.map(i => ({ medicationId: i.medicationId, quantity: i.quantity }));
        const finalItems = prescription.items.filter(pItem => dispenseList.some(d => d.medicationId === pItem.medicationId)).map(pItem => { const updateInfo = dispenseList.find(d => d.medicationId === pItem.medicationId); return { ...pItem, quantity: updateInfo ? updateInfo.quantity : pItem.quantity }; });
        if (finalItems.length === 0) return { success: false, message: "No se seleccionó ningún artículo para surtir." };
        for (const item of dispenseList) { if (item.quantity <= 0) continue; const medRef = doc(db, 'medications', item.medicationId); batch.update(medRef, { existencia: increment(-item.quantity), updatedAt: new Date().toISOString() }); }
        batch.update(pRef, { status: 'surtida', items: finalItems, updatedAt: new Date().toISOString() });
        await batch.commit();
        return { success: true };
    } catch (e: any) { console.error("Dispense error:", e); return { success: false, message: "Error interno al procesar el surtido." }; }
}

export async function getPatientPrescriptionsCountToday(patientId: string): Promise<number> {
    const db = getDb();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    const q = query(collection(db, 'prescriptions'), where('patientId', '==', patientId));
    const snap = await getDocs(q);
    const count = snap.docs.filter(d => { const date = d.data().date; return date >= start && date <= end; }).length;
    return count;
}

// =====================================================================
// CIE-10 CATALOGS
// =====================================================================

export async function bulkInsertCie10Glossary(chunk: any[]) {
    const db = getDb();
    if (!chunk || chunk.length === 0) return { success: false };
    try {
        const batch = writeBatch(db);
        chunk.forEach(raw => {
            const id = uuidv4();
            batch.set(doc(db, 'cie10Glossary', id), {
                id,
                campo: String(raw['Campo'] || '').trim(),
                descripcion: String(raw['Descripción'] || raw['DESCRIPCIÃ'] || '').trim()
            });
        });
        await batch.commit();
        return { success: true, processedCount: chunk.length };
    } catch (e: any) { return { success: false, message: e.message }; }
}

export async function bulkInsertCie10Catalog(chunk: any[]) {
    const db = getDb();
    if (!chunk || chunk.length === 0) return { success: false };
    try {
        const batch = writeBatch(db);
        chunk.forEach(raw => {
            const id = uuidv4();
            const record: Cie10Record = {
                id,
                consecutivo: String(raw['CONSECUTIVO'] || ''),
                letra: String(raw['LETRA'] || ''),
                catalogKey: String(raw['CATALOG_KEY'] || ''),
                nombre: String(raw['NOMBRE'] || ''),
                codigox: String(raw['CODIGOX'] || ''),
                lsex: String(raw['LSEX'] || ''),
                linf: String(raw['LINF'] || ''),
                lsup: String(raw['LSUP'] || ''),
                trivial: String(raw['TRIVIAL'] || ''),
                erradicado: String(raw['ERRADICADO'] || ''),
                n_inter: String(raw['N_INTER'] || ''),
                nin: String(raw['NIN'] || ''),
                ninmtobs: String(raw['NINMTOBS'] || ''),
                codSitLesion: String(raw['COD_SIT_LESION'] || ''),
                noCbd: String(raw['NO_CBD'] || ''),
                cbd: String(raw['CBD'] || ''),
                noAph: String(raw['NO_APH'] || ''),
                afPrin: String(raw['AF_PRIN'] || ''),
                diaSis: String(raw['DIA_SIS'] || ''),
                claveProgramaSis: String(raw['CLAVE_PROGRAMA_SIS'] || ''),
                codComplemenMorbi: String(raw['COD_COMPLEMEN_MORBI'] || ''),
                diaFetal: String(raw['DIA_FETAL'] || ''),
                defFetalCm: String(raw['DEF_FETAL_CM'] || ''),
                defFetalCbd: String(raw['DEF_FETAL_CBD'] || ''),
                claveCapitulo: String(raw['CLAVE_CAPITULO'] || ''),
                capitulo: String(raw['CAPITULO'] || ''),
                lista1: String(raw['LISTA1'] || ''),
                grupo1: String(raw['GRUPO1'] || ''),
                lista5: String(raw['LISTA5'] || ''),
                rubricaType: String(raw['RUBRICA_TYPE'] || ''),
                yearModifi: String(raw['YEAR_MODIFI'] || ''),
                yearAplicacion: String(raw['YEAR_APLICACION'] || ''),
                valid: String(raw['VALID'] || ''),
                prinmorta: String(raw['PRINMORTA'] || ''),
                prinmorbi: String(raw['PRINMORBI'] || ''),
                lmMorbi: String(raw['LM_MORBI'] || ''),
                lmMorta: String(raw['LM_MORTA'] || ''),
                lgbd165: String(raw['LGBD165'] || ''),
                lomsbeck: String(raw['LOMSBECK'] || ''),
                lgbd190: String(raw['LGBD190'] || ''),
                notdiaria: String(raw['NOTDIARIA'] || ''),
                notsemanal: String(raw['NOTSEMANAL'] || ''),
                sistemaEspecial: String(raw['SISTEMA_ESPECIAL'] || ''),
                birmm: String(raw['BIRMM'] || ''),
                cveCausaType: String(raw['CVE_CAUSA_TYPE'] || ''),
                causaType: String(raw['CAUSA_TYPE'] || ''),
                epiMorta: String(raw['EPI_MORTA'] || ''),
                edasEIrasEnM5: String(raw['EDAS_E_IRAS_EN_M5'] || ''),
                cveMaternasSeedEpid: String(raw['CVE_MATERNAS-SEED-EPID'] || ''),
                epiMortaM5: String(raw['EPI_MORTA_M5'] || ''),
                epiMorbi: String(raw['EPI_MORBI'] || ''),
                defMaternas: String(raw['DEF_MATERNAS'] || ''),
                esCauses: String(raw['ES_CAUSES'] || ''),
                numCauses: String(raw['NUM_CAUSES'] || ''),
                esSuiveMorta: String(raw['ES_SUIVE_MORTA'] || ''),
                esSuiveMorbi: String(raw['ES_SUIVE_MORBI'] || ''),
                epiClave: String(raw['EPI_CLAVE'] || ''),
                epiClaveDesc: String(raw['EPI_CLAVE_DESC'] || ''),
                esSuiveNotin: String(raw['ES_SUIVE_NOTIN'] || ''),
                esSuiveEstEpi: String(raw['ES_SUIVE_EST_EPID'] || ''),
                esSuiveEstBrote: String(raw['ES_SUIVE_EST_BROTE'] || ''),
                sinac: String(raw['SINAC'] || ''),
                prin_sinac: String(raw['PRIN_SINAC'] || ''),
                prin_sinac_grupo: String(raw['PRIN_SINAC_GRUPO'] || ''),
                descripcion_sinac_grupo: String(raw['DESCRIPCION_SINAC_GRUPO'] || ''),
                prin_sinac_subgrupo: String(raw['PRIN_SINAC_SUBGRUPO'] || ''),
                descripcion_sinac_subgrupo: String(raw['DESCRIPCION_SINAC_SUBGRUPO'] || ''),
                daga: String(raw['DAGA'] || ''),
                asterisco: String(raw['ASTERISCO'] || ''),
                prin_mm: String(raw['PRIN_MM'] || ''),
                prin_mm_grupo: String(raw['PRIN_MM_GRUPO'] || ''),
                descripcion_mm_grupo: String(raw['DESCRIPCION_MM_GRUPO'] || ''),
                prin_mm_subgrupo: String(raw['PRIN_MM_SUBGRUPO'] || ''),
                descripcion_mm_subgrupo: String(raw['DESCRIPCION_MM_SUBGRUPO'] || ''),
                cod_adi_mort: String(raw['COD_ADI_MORT'] || ''),
            };
            batch.set(doc(db, 'cie10Catalog', id), record);
        });
        await batch.commit();
        return { success: true, processedCount: chunk.length };
    } catch (e: any) { return { success: false, message: e.message }; }
}

export async function deleteAllCie10Glossary() { return deleteInventoryItems('cie10Glossary'); }
export async function deleteAllCie10Catalog() { return deleteInventoryItems('cie10Catalog'); }

export async function searchCie10(searchTerm: string): Promise<Cie10Record[]> {
  const db = getDb();
  const term = searchTerm.toUpperCase().trim();
  if (!term || term.length < 2) return [];

  const catalogColl = collection(db, 'cie10Catalog');
  
  const qCode = query(catalogColl, where('catalogKey', '==', term), limit(5));
  const snapCode = await getDocs(qCode);
  
  if (!snapCode.empty) {
    return snapCode.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Cie10Record);
  }

  const qDesc = query(catalogColl, where('nombre', '>=', term), where('nombre', '<=', term + '\uf8ff'), limit(20));
  const snapDesc = await getDocs(qDesc);
  
  return snapDesc.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Cie10Record);
}

// =====================================================================
// MAINTENANCE
// =====================================================================

export async function findDuplicatePatients(criteria: 'expediente' | 'curp' | 'name'): Promise<Patient[][]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'patients'), limit(5000)));
  const all = snap.docs.map(doc => { const d = doc.data(); return { id: doc.id, name: String(d.name || '').toUpperCase().trim(), paternalLastName: String(d.paternalLastName || '').toUpperCase().trim(), maternalLastName: String(d.maternalLastName || '').toUpperCase().trim(), curp: String(d.curp || '').toUpperCase().trim(), expediente: d.expediente ? String(d.expediente).trim() : '', phoneNumber: String(d.phoneNumber || '') }; });
  const map = new Map<string, any[]>();
  all.forEach(p => {
    let key = '';
    if (criteria === 'expediente') key = p.expediente;
    else if (criteria === 'curp') key = (p.curp && !p.curp.startsWith('RN-')) ? p.curp : '';
    else key = `${p.name} ${p.paternalLastName} ${p.maternalLastName}`.trim();
    if (key && key !== 'N/A' && key !== '') { const group = map.get(key) || []; group.push(p); map.set(key, group); }
  });
  return Array.from(map.values()).filter(g => g.length > 1).slice(0, 300);
}

export async function bulkUpdateStatusChunk(expedientes: string[], status: PatientStatus) {
  const db = getDb();
  if (!expedientes || expedientes.length === 0) return { success: true, count: 0 };
  const allSnap = await getDocs(query(collection(db, 'patients'), limit(10000)));
  const cleanExpedientes = expedientes.map(e => e.toString().trim().replace(/^0+/, ''));
  const matches = allSnap.docs.filter(doc => { const exp = (doc.data().expediente || '').toString().trim().replace(/^0+/, ''); return cleanExpedientes.includes(exp); });
  if (matches.length > 0) { const updateChunks = chunkArray(matches, 500); for (const chunk of updateChunks) { const batch = writeBatch(db); chunk.forEach(d => batch.update(d.ref, { status, updatedAt: Timestamp.now() })); await batch.commit(); } }
  return { success: true, count: matches.length };
}

export async function normalizePatientExpedientes() {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'patients'), limit(10000)));
  let count = 0; const updates: {id: string, data: any}[] = [];
  snap.docs.forEach(docSnap => { const data = docSnap.data(); let exp = data.expediente; if (exp !== null && exp !== undefined) { const expStr = String(exp).trim(); if (expStr.length > 0 && !expStr.startsWith('0')) { updates.push({ id: docSnap.id, data: { expediente: '0' + expStr, updatedAt: Timestamp.now() } }); count++; } } });
  if (updates.length > 0) { const chunks = chunkArray(updates, 500); for (const chunk of chunks) { const batch = writeBatch(db); chunk.forEach(u => batch.update(doc(db, 'patients', u.id), u.data)); await batch.commit(); } }
  return { success: true, count };
}

// =====================================================================
// DATA MANAGEMENT
// =====================================================================

export async function createBackupData() {
  const db = getDb();
  const collections = ['patients', 'appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments', 'clinics'];
  const data: any = {};
  for (const col of collections) { const snap = await getDocs(collection(db, col)); data[col] = snap.docs.map(d => serializeData({ id: d.id, ...d.data() })); }
  return data;
}

export async function cleanupOldRecords() {
  const db = getDb();
  const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
  const cutoff = Timestamp.fromDate(lastMonth);
  const collections = ['appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments'];
  let total = 0;
  for (const col of collections) { const q = query(collection(db, col), where('date', '<', cutoff)); const snap = await getDocs(q); if (!snap.empty) { const batch = writeBatch(db); snap.docs.forEach(d => { batch.delete(d.ref); total++; }); await batch.commit(); } }
  return { success: true, deletedCount: total };
}

export async function bulkInsertPatients(chunk: any[]) {
  const db = getDb();
  if (!chunk || chunk.length === 0) return { success: false };
  try {
    const batch = writeBatch(db);
    let added = 0, updated = 0;
    for (const raw of chunk) {
      if (!raw.CURP) continue;
      const curp = String(raw.CURP).toUpperCase().trim();
      const patientData = { expediente: raw['No.Expediente'] ? String(raw['No.Expediente']).trim() : null, name: normalizeStr(raw.Nombre), paternalLastName: normalizeStr(raw.Apaterno), maternalLastName: normalizeStr(raw.Amaterno), birthDate: raw.FNacimiento ? String(raw.FNacimiento) : null, age: Number(raw.Edad) || 0, sex: String(raw.Sexo).startsWith('M') ? 'Mujer' : 'Hombre', birthState: String(raw.Estado || 'TABASCO').toUpperCase().trim(), address: String(raw.Domicilio || '').toUpperCase().trim(), coloniaName: String(raw.Colonia || '').toUpperCase().trim(), fatherName: normalizeStr(raw.NombrePadre) || null, motherName: normalizeStr(raw.NombreMadre) || null, fatherAge: Number(raw.EdadPadre) || null, motherAge: Number(raw.EdadMadre) || null, registrationDate: raw.FechaApertura ? String(raw.FechaApertura) : null, status: raw.Estatus || PatientStatusEnum.Vigente, derechoAbiencia: raw.DerechoAbiencia ? String(raw.DerechoAbiencia).trim().toUpperCase() : null, phoneNumber: String(raw.Telefono || '').trim(), curp, updatedAt: Timestamp.now() };
      const existing = await getPatientByCURP(curp);
      if (existing) { batch.update(doc(db, 'patients', existing.id), patientData); updated++; }
      else { const newId = uuidv4(); batch.set(doc(db, 'patients', newId), { ...patientData, id: newId }); added++; }
    }
    await batch.commit();
    return { success: true, addedCount: added, updatedCount: updated, processedCount: chunk.length };
  } catch (e: any) { return { success: false, message: e.message }; }
}

export async function bulkInsertDoctors(chunk: any[], specialties: string[]) {
    const db = getDb();
    if (!chunk || chunk.length === 0) return { success: false };
    try {
        const batch = writeBatch(db);
        let processed = 0;
        for (const raw of chunk) {
            const name = String(raw['Médico'] || raw['Nombre'] || '').trim().toUpperCase();
            const curp = String(raw['CURP'] || '').trim().toUpperCase();
            const license = String(raw['Cédula'] || raw['Cedula'] || '').trim().toUpperCase();
            const unit = String(raw['Unidad'] || raw['Unidad Médica'] || '').trim().toUpperCase();
            let service = String(raw['Servicio'] || '').trim();
            if (!name) continue;
            if (!specialties.includes(service)) { service = specialties[0] || 'Consulta Externa'; }
            const id = uuidv4();
            const doctorData: Clinic = { id, name: unit || 'OTRA ÁREA', doctorName: name, doctorCurp: curp, professionalLicense: license, password: 'hospital_ext', dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false, clinicType: service, bookingMode: BookingMode.Time, consultationDuration: 30 };
            batch.set(doc(db, 'clinics', id), doctorData);
            processed++;
        }
        await batch.commit();
        return { success: true, processedCount: processed };
    } catch (e: any) { return { success: false, message: e.message }; }
}

export async function getAvailableSlotsForDate(clinicId: string, dateIso: string) {
  const clinic = await getClinicById(clinicId);
  if (!clinic) return {};
  const db = getDb();
  const dateOnly = dateIso.split('T')[0];
  const q = query(collection(db, 'appointments'), where('clinicId', '==', clinicId));
  const snap = await getDocs(q);
  const taken = snap.docs.map(d => serializeData(d.data())).filter(a => a.date.split('T')[0] === dateOnly);
  if (clinic.bookingMode === BookingMode.Time) {
    const slots = []; let curr = new Date(`1970-01-01T${clinic.startTime}:00`); const end = new Date(`1970-01-01T${clinic.endTime}:00`); const duration = clinic.consultationDuration || 30;
    const timeToMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    while (curr < end) { 
        const t = curr.toTimeString().substring(0, 5); const tMins = timeToMinutes(t);
        if (t === clinic.breakTime) { curr = new Date(curr.getTime() + duration * 60000); continue; }
        const hasCollision = taken.some(app => { if (app.time.includes('Espera') || app.time.includes('Ficha')) return false; const appStart = timeToMinutes(app.time); const appEnd = appStart + (app.duration || 30); const slotEnd = tMins + duration; return Math.max(tMins, appStart) < Math.min(slotEnd, appEnd); });
        if (!hasCollision) slots.push(t); curr = new Date(curr.getTime() + duration * 60000); 
    }
    const waitlist = Array.from({ length: clinic.waitlistSlots || 0 }, (_, i) => `Espera ${i + 1}`).filter(t => !taken.some(a => a.time === t));
    return { timeSlots: [...slots, ...waitlist] };
  } else {
    const tokens = Array.from({ length: clinic.dailySlots }, (_, i) => `Ficha ${i + 1}`).filter(t => !taken.some(a => a.time === t));
    const waitlist = Array.from({ length: clinic.waitlistSlots || 0 }, (_, i) => `Espera ${i + 1}`).filter(t => !taken.some(a => a.time === t));
    return { tokens: [...tokens, ...waitlist] };
  }
}

export async function rescheduleAppointment(id: string, date: string, type: string) {
  try {
    const collMap: Record<string, string> = { 
        'medical': 'appointments', 'lab': 'labAppointments', 'xray': 'xrayAppointments', 'ultrasound': 'ultrasoundAppointments', 'vaccineAppointments': 'vaccineAppointments' 
    };
    const collectionName = collMap[type] || 'appointments';
    
    const db = getDb();
    const appSnap = await getDoc(doc(db, collectionName, id));
    if (!appSnap.exists()) return { success: false, message: 'Cita no encontrada.' };
    const appData = appSnap.data();
    
    // Check for collisions using memory filter path
    const taken = await isTimeSlotTaken(collectionName as any, date, appData.time, appData.duration || 30, appData.clinicId, id);
    if (taken) return { success: false, message: 'No se puede reagendar: El horario de destino ya está ocupado.' };

    await updateDoc(doc(db, collectionName, id), { date: Timestamp.fromDate(new Date(date)) });
    return { success: true, message: 'Fecha actualizada correctamente' };
  } catch (e: any) { return { success: false, message: e.message }; }
}

export async function cloneAppointment(originalId: string, date: string, type: string, time?: string) {
  const db = getDb();
  try {
    const collMap: Record<string, string> = { 'medical': 'appointments', 'lab': 'labAppointments', 'xray': 'xrayAppointments', 'ultrasound': 'ultrasoundAppointments', 'vaccine': 'vaccineAppointments' };
    const collectionName = collMap[type] || 'appointments';
    const originalDoc = await getDoc(doc(db, collectionName, originalId));
    if (!originalDoc.exists()) return { success: false, message: 'Cita original no encontrada' };
    const data = originalDoc.data();
    
    const finalTime = time || data.time;
    
    // Check for collisions using memory filter path
    const taken = await isTimeSlotTaken(collectionName as any, date, finalTime, data.duration || 30, data.clinicId);
    if (taken) return { success: false, message: 'No se puede asignar: El horario/ficha seleccionado ya está ocupado.' };

    const newRef = doc(collection(db, collectionName));
    const newFolio = `${data.appointmentNumber.split('-')[0]}-${uuidv4().split('-')[0].toUpperCase()}`;
    const newAppData = { 
        ...data, 
        date: Timestamp.fromDate(new Date(date)), 
        appointmentNumber: newFolio, 
        status: 'Agendada',
        time: finalTime,
        createdAt: Timestamp.now()
    };
    
    await setDoc(newRef, newAppData);
    return { success: true, message: `Nueva cita asignada con folio: ${newFolio}` };
  } catch (e: any) { return { success: false, message: e.message }; }
}

export async function getBIData(): Promise<any> {
    const [appointments, labAppointments, xrayAppointments, ultrasoundAppointments, vaccineAppointments, clinics, colonias] = await Promise.all([
        getAppointments(),
        getLabAppointments(),
        getXRayAppointments(),
        getUltrasoundAppointments(),
        getVaccineAppointments(),
        getClinics(),
        getColonias()
    ]);
    return { appointments, labAppointments, xrayAppointments, ultrasoundAppointments, vaccineAppointments, clinics, colonias };
}
