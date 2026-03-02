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
  getCountFromServer
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
  PatientStatus,
  ArchiveCounts,
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
        serialized[key] = serializeData(data[key]);
      }
    }
    return serialized;
  }
  return data;
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
  search?: string, 
  limitNum?: number 
}): Promise<Patient[]> {
  const db = getDb();
  const collRef = collection(db, 'patients');
  
  // Exact search priority (Fast)
  if (options?.search) {
    const term = options.search.toUpperCase().trim();
    
    // Check CURP
    const qCurp = query(collRef, where('curp', '==', term), limit(5));
    const snapCurp = await getDocs(qCurp);
    if (!snapCurp.empty) {
      return snapCurp.docs.map(d => serializeData({ id: d.id, ...d.data() }));
    }

    // Check Expediente
    const qExp = query(collRef, where('expediente', '==', term), limit(5));
    const snapExp = await getDocs(qExp);
    if (!snapExp.empty) {
      return snapExp.docs.map(d => serializeData({ id: d.id, ...d.data() }));
    }
  }

  // Load batch for client-side interaction
  let q = query(collRef);
  if (options?.status && options.status !== 'Total') {
    q = query(q, where('status', '==', options.status));
  }
  
  const snap = await getDocs(query(q, limit(options?.limitNum || 5000)));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Patient);
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
  const dataToSave = { 
    ...patient, 
    status: patient.status || PatientStatusEnum.Vigente,
    updatedAt: Timestamp.now()
  };
  await setDoc(doc(db, 'patients', docId), dataToSave, { merge: true });
  return { success: true };
}

export async function updatePatient(id: string, data: Partial<Omit<Patient, 'id'>>) {
  const db = getDb();
  await updateDoc(doc(db, 'patients', id), { ...data, updatedAt: Timestamp.now() });
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
    snap.forEach(d => {
      patientsMap[d.id] = serializeData({ id: d.id, ...d.data() }) as Patient;
    });
  }

  return apps.map(app => serializeData({
    ...app,
    patient: patientsMap[app.patientId] || null
  }));
}

export async function getAppointments(): Promise<Appointment[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc'), limit(2000)));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return await enrichWithPatientData(data) as Appointment[];
}

export async function getAppointmentsForClinic(clinicId: string): Promise<Appointment[]> {
  const db = getDb();
  const q = query(collection(db, 'appointments'), where('clinicId', '==', clinicId), limit(2000));
  const snap = await getDocs(q);
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  data.sort((a: any, b: any) => (b.date as Timestamp).toMillis() - (a.date as Timestamp).toMillis());
  return await enrichWithPatientData(data) as Appointment[];
}

export async function getLabAppointments(): Promise<LabAppointment[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'labAppointments'), orderBy('date', 'desc'), limit(2000)));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return await enrichWithPatientData(data) as LabAppointment[];
}

export async function getXRayAppointments(): Promise<XRayAppointment[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'xrayAppointments'), orderBy('date', 'desc'), limit(2000)));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return await enrichWithPatientData(data) as XRayAppointment[];
}

export async function getUltrasoundAppointments(): Promise<UltrasoundAppointment[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'ultrasoundAppointments'), orderBy('date', 'desc'), limit(2000)));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return await enrichWithPatientData(data) as UltrasoundAppointment[];
}

export async function getVaccineAppointments(): Promise<VaccineAppointment[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'vaccineAppointments'), orderBy('date', 'desc'), limit(2000)));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return await enrichWithPatientData(data) as VaccineAppointment[];
}

export async function saveAppointment(appointmentData: any, patientInput: any, coloniaName?: string) {
  const db = getDb();
  try {
    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    
    if (existingPatient && !curp.startsWith('RN-')) {
      const selectedDate = new Date(appointmentData.date).toISOString().split('T')[0];
      const q = query(collection(db, 'appointments'), where('patientId', '==', existingPatient.id));
      const snap = await getDocs(q);
      const isDuplicate = snap.docs.some(doc => {
        const d = doc.data();
        const appDate = (d.date as Timestamp).toDate().toISOString().split('T')[0];
        return appDate === selectedDate;
      });
      if (isDuplicate) return { success: false, error: `El paciente con CURP ${curp} ya tiene una cita médica para este día.` };
    }

    const batch = writeBatch(db);
    let patientId = existingPatient ? existingPatient.id : uuidv4();
    
    const cleanPatient = {
      curp,
      name: String(patientInput.name || '').toUpperCase().trim(),
      paternalLastName: String(patientInput.paternalLastName || '').toUpperCase().trim(),
      maternalLastName: String(patientInput.maternalLastName || '').toUpperCase().trim(),
      sex: patientInput.sex,
      age: Number(patientInput.age) || 0,
      birthDate: patientInput.birthDate || '',
      birthState: String(patientInput.birthState || '').toUpperCase().trim(),
      phoneNumber: String(patientInput.phoneNumber || '').trim(),
      coloniaName: coloniaName || patientInput.coloniaName || null,
      status: patientInput.status || PatientStatusEnum.Vigente,
      fatherName: patientInput.fatherName || null,
      motherName: patientInput.motherName || null,
      fatherAge: patientInput.fatherAge || null,
      motherAge: patientInput.motherAge || null,
      registrationDate: patientInput.registrationDate || null,
      derechoAbiencia: patientInput.derechoAbiencia || null,
      updatedAt: Timestamp.now()
    };

    batch.set(doc(db, 'patients', patientId), { ...cleanPatient, id: patientId }, { merge: true });

    const appRef = doc(collection(db, 'appointments'));
    const appointmentNumber = `FOLIO-${uuidv4().split('-')[0].toUpperCase()}`;
    
    const cleanApp = {
      appointmentNumber,
      patientId,
      clinicId: appointmentData.clinicId,
      date: Timestamp.fromDate(new Date(appointmentData.date)),
      time: String(appointmentData.time),
      patientType: appointmentData.patientType,
      status: 'Agendada',
      coloniaName: coloniaName || null,
      createdAt: Timestamp.now()
    };

    batch.set(appRef, cleanApp);
    await batch.commit();
    await logActivity("Nueva Cita Médica", `Folio ${appointmentNumber} para ${cleanPatient.name}`);
    const clinicData = await getClinicById(appointmentData.clinicId);
    return { success: true, data: serializeData({ appointment: { ...cleanApp, id: appRef.id, patient: { ...cleanPatient, id: patientId } }, clinic: clinicData }) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function saveLabAppointment(appointmentData: any, patientInput: any) {
  const db = getDb();
  try {
    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    
    if (existingPatient && !curp.startsWith('RN-')) {
      const selectedDate = new Date(appointmentData.date).toISOString().split('T')[0];
      const q = query(collection(db, 'labAppointments'), where('patientId', '==', existingPatient.id));
      const snap = await getDocs(q);
      const isDuplicate = snap.docs.some(doc => {
        const d = doc.data();
        const appDate = (d.date as Timestamp).toDate().toISOString().split('T')[0];
        return appDate === selectedDate;
      });
      if (isDuplicate) return { success: false, error: `El paciente con CURP ${curp} ya tiene una cita de laboratorio para este día.` };
    }

    const batch = writeBatch(db);
    const patientId = existingPatient ? existingPatient.id : uuidv4();
    const cleanPatient = { 
      curp, 
      name: String(patientInput.name || '').toUpperCase().trim(), 
      paternalLastName: String(patientInput.paternalLastName || '').toUpperCase().trim(), 
      maternalLastName: String(patientInput.maternalLastName || '').toUpperCase().trim(), 
      sex: patientInput.sex, 
      age: Number(patientInput.age) || 0, 
      birthState: String(patientInput.birthState || '').toUpperCase().trim(), 
      phoneNumber: String(patientInput.phoneNumber || '').trim(), 
      fatherName: patientInput.fatherName || null,
      motherName: patientInput.motherName || null,
      fatherAge: patientInput.fatherAge || null,
      motherAge: patientInput.motherAge || null,
      registrationDate: patientInput.registrationDate || null,
      derechoAbiencia: patientInput.derechoAbiencia || null,
      updatedAt: Timestamp.now() 
    };
    batch.set(doc(db, 'patients', patientId), { ...cleanPatient, id: patientId }, { merge: true });
    
    const appRef = doc(collection(db, 'labAppointments'));
    const cleanApp = { appointmentNumber: appointmentData.appointmentNumber, patientId, date: Timestamp.fromDate(new Date(appointmentData.date)), time: String(appointmentData.time), studies: appointmentData.studies, status: 'Agendada', patientType: appointmentData.patientType, createdAt: Timestamp.now() };
    batch.set(appRef, cleanApp);
    await batch.commit();
    await logActivity("Nueva Cita Laboratorio", `Folio ${cleanApp.appointmentNumber} para ${cleanPatient.name}`);
    return { success: true, data: serializeData({ ...cleanApp, id: appRef.id, patient: { ...cleanPatient, id: patientId } }) };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function saveNewXRayAppointment(appointmentData: any, patientInput: any) {
  const db = getDb();
  try {
    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    
    if (existingPatient && !curp.startsWith('RN-')) {
      const selectedDate = new Date(appointmentData.date).toISOString().split('T')[0];
      const q = query(collection(db, 'xrayAppointments'), where('patientId', '==', existingPatient.id));
      const snap = await getDocs(q);
      const isDuplicate = snap.docs.some(doc => {
        const d = doc.data();
        const appDate = (d.date as Timestamp).toDate().toISOString().split('T')[0];
        return appDate === selectedDate;
      });
      if (isDuplicate) return { success: false, error: 'Este paciente ya tiene una cita de Rayos X para este día.' };
    }

    const batch = writeBatch(db);
    const patientId = existingPatient ? existingPatient.id : uuidv4();
    const cleanPatient = { 
      curp, 
      name: String(patientInput.name || '').toUpperCase().trim(), 
      paternalLastName: String(patientInput.paternalLastName || '').toUpperCase().trim(), 
      maternalLastName: String(patientInput.maternalLastName || '').toUpperCase().trim(), 
      sex: patientInput.sex, 
      age: Number(patientInput.age) || 0, 
      birthState: String(patientInput.birthState || '').toUpperCase().trim(), 
      phoneNumber: String(patientInput.phoneNumber || '').trim(), 
      fatherName: patientInput.fatherName || null,
      motherName: patientInput.motherName || null,
      fatherAge: patientInput.fatherAge || null,
      motherAge: patientInput.motherAge || null,
      registrationDate: patientInput.registrationDate || null,
      derechoAbiencia: patientInput.derechoAbiencia || null,
      updatedAt: Timestamp.now() 
    };
    batch.set(doc(db, 'patients', patientId), { ...cleanPatient, id: patientId }, { merge: true });
    
    const appRef = doc(collection(db, 'xrayAppointments'));
    const cleanApp = { appointmentNumber: appointmentData.appointmentNumber, patientId, date: Timestamp.fromDate(new Date(appointmentData.date)), time: String(appointmentData.time), studyId: appointmentData.studyId, studyName: appointmentData.studyName, status: 'Agendada', patientType: appointmentData.patientType, createdAt: Timestamp.now() };
    batch.set(appRef, cleanApp);
    await batch.commit();
    return { success: true, data: serializeData({ appointment: { ...cleanApp, id: appRef.id, patient: { ...cleanPatient, id: patientId } }, study: { name: appointmentData.studyName, indications: '' } }) };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function saveNewUltrasoundAppointment(appointmentData: any, patientInput: any) {
  const db = getDb();
  try {
    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    
    if (existingPatient && !curp.startsWith('RN-')) {
      const selectedDate = new Date(appointmentData.date).toISOString().split('T')[0];
      const q = query(collection(db, 'ultrasoundAppointments'), where('patientId', '==', existingPatient.id));
      const snap = await getDocs(q);
      const isDuplicate = snap.docs.some(doc => {
        const d = doc.data();
        const appDate = (d.date as Timestamp).toDate().toISOString().split('T')[0];
        return appDate === selectedDate;
      });
      if (isDuplicate) return { success: false, error: 'Este paciente ya tiene una cita de Ultrasonido para este día.' };
    }

    const batch = writeBatch(db);
    const patientId = existingPatient ? existingPatient.id : uuidv4();
    const cleanPatient = { 
      curp, 
      name: String(patientInput.name || '').toUpperCase().trim(), 
      paternalLastName: String(patientInput.paternalLastName || '').toUpperCase().trim(), 
      maternalLastName: String(patientInput.maternalLastName || '').toUpperCase().trim(), 
      sex: patientInput.sex, 
      age: Number(patientInput.age) || 0, 
      birthState: String(patientInput.birthState || '').toUpperCase().trim(), 
      phoneNumber: String(patientInput.phoneNumber || '').trim(), 
      fatherName: patientInput.fatherName || null,
      motherName: patientInput.motherName || null,
      fatherAge: patientInput.fatherAge || null,
      motherAge: patientInput.motherAge || null,
      registrationDate: patientInput.registrationDate || null,
      derechoAbiencia: patientInput.derechoAbiencia || null,
      updatedAt: Timestamp.now() 
    };
    batch.set(doc(db, 'patients', patientId), { ...cleanPatient, id: patientId }, { merge: true });
    
    const appRef = doc(collection(db, 'ultrasoundAppointments'));
    const cleanApp = { appointmentNumber: appointmentData.appointmentNumber, patientId, date: Timestamp.fromDate(new Date(appointmentData.date)), time: String(appointmentData.time), studyId: appointmentData.studyId, studyName: appointmentData.studyName, status: 'Agendada', patientType: appointmentData.patientType, createdAt: Timestamp.now() };
    batch.set(appRef, cleanApp);
    await batch.commit();
    return { success: true, data: serializeData({ appointment: { ...cleanApp, id: appRef.id, patient: { ...cleanPatient, id: patientId } }, study: { name: appointmentData.studyName, indications: '' } }) };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function saveNewVaccineAppointment(appointmentData: any, patientInput: any) {
  const db = getDb();
  try {
    const curp = String(patientInput.curp).toUpperCase().trim();
    const existingPatient = await getPatientByCURP(curp);
    
    if (existingPatient && !curp.startsWith('RN-')) {
      const selectedDate = new Date(appointmentData.date).toISOString().split('T')[0];
      const q = query(collection(db, 'vaccineAppointments'), where('patientId', '==', existingPatient.id));
      const snap = await getDocs(q);
      const isDuplicate = snap.docs.some(doc => {
        const d = doc.data();
        const appDate = (d.date as Timestamp).toDate().toISOString().split('T')[0];
        return appDate === selectedDate;
      });
      if (isDuplicate) return { success: false, error: 'Este paciente ya tiene una cita de Vacunación para este día.' };
    }

    const batch = writeBatch(db);
    const patientId = existingPatient ? existingPatient.id : uuidv4();
    const cleanPatient = { 
      curp, 
      name: String(patientInput.name || '').toUpperCase().trim(), 
      paternalLastName: String(patientInput.paternalLastName || '').toUpperCase().trim(), 
      maternalLastName: String(patientInput.maternalLastName || '').toUpperCase().trim(), 
      sex: patientInput.sex, 
      age: Number(patientInput.age) || 0, 
      birthState: String(patientInput.birthState || '').toUpperCase().trim(), 
      phoneNumber: String(patientInput.phoneNumber || '').trim(), 
      fatherName: patientInput.fatherName || null,
      motherName: patientInput.motherName || null,
      fatherAge: patientInput.fatherAge || null,
      motherAge: patientInput.motherAge || null,
      registrationDate: patientInput.registrationDate || null,
      derechoAbiencia: patientInput.derechoAbiencia || null,
      updatedAt: Timestamp.now() 
    };
    batch.set(doc(db, 'patients', patientId), { ...cleanPatient, id: patientId }, { merge: true });
    
    const appRef = doc(collection(db, 'vaccineAppointments'));
    const cleanApp = { appointmentNumber: appointmentData.appointmentNumber, patientId, date: Timestamp.fromDate(new Date(appointmentData.date)), time: String(appointmentData.time), vaccines: appointmentData.vaccines, status: 'Agendada', patientType: appointmentData.patientType, coloniaName: appointmentData.coloniaName || null, createdAt: Timestamp.now() };
    batch.set(appRef, cleanApp);
    await batch.commit();
    return { success: true, data: serializeData({ ...cleanApp, id: appRef.id, patient: { ...cleanPatient, id: patientId } }) };
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

export async function getModuleSettings() { return getSettingsDoc<ModuleSettings>('moduleSettings', { citasMedicasEnabled: true, laboratorioEnabled: true, rayosXEnabled: true, ultrasoundEnabled: true, vacunasEnabled: true, archivoEnabled: true }); }
export async function updateModuleSettings(s: ModuleSettings) { return setSettingsDoc('moduleSettings', s); }

export async function getLabSettings() { return getSettingsDoc<LabSettings>('labSettings', { dailySlots: 10, weekendBookingEnabled: false }); }
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

export async function getXRaySettings() { return getSettingsDoc<XRaySettings>('xraySettings', { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false }); }
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

export async function getUltrasoundSettings() { return getSettingsDoc<UltrasoundSettings>('ultrasoundSettings', { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false }); }
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

export async function getVaccineSettings() { return getSettingsDoc<VaccineSettings>('vaccineSettings', { dailySlots: 20, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false }); }
export async function updateVaccineSettings(s: VaccineSettings) { return setSettingsDoc('vaccineSettings', s); }

export async function getVaccines() {
  const db = getDb();
  const snap = await getDocs(collection(db, 'vaccines'));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as Vaccine);
}
export async function updateVaccines(vaccines: Vaccine[]) {
  const db = getDb();
  const snap = await getDocs(collection(db, 'vaccines'));
  const batch = writeBatch(db);
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

export async function verifyArchivePassword(p: string) { const s = await getArchiveSettings(); return { success: s.password === p }; }
export async function verifyClinicPassword(id: string, p: string) { const c = await getClinicById(id); return { success: c?.password === p }; }
export async function verifyLabPassword(p: string) { const s = await getLabSettings(); return { success: s.password === p }; }
export async function verifyXRayPassword(p: string) { const s = await getXRaySettings(); return { success: s.password === p }; }
export async function verifyUltrasoundPassword(p: string) { const s = await getUltrasoundSettings(); return { success: s.password === p }; }
export async function verifyVaccinePassword(p: string) { const s = await getVaccineSettings(); return { success: s.password === p }; }

export async function getLogs(): Promise<ActivityLog[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'activityLog'), orderBy('timestamp', 'desc'), limit(500)));
  return snap.docs.map(d => serializeData({ id: d.id, ...d.data() }) as ActivityLog);
}

// =====================================================================
// MAINTENANCE
// =====================================================================

export async function findDuplicatePatients(criteria: 'expediente' | 'curp' | 'name'): Promise<Patient[][]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, 'patients'), limit(5000)));
  const all = snap.docs.map(doc => {
    const d = doc.data();
    return { id: doc.id, name: String(d.name || '').toUpperCase().trim(), paternalLastName: String(d.paternalLastName || '').toUpperCase().trim(), maternalLastName: String(d.maternalLastName || '').toUpperCase().trim(), curp: String(d.curp || '').toUpperCase().trim(), expediente: d.expediente ? String(d.expediente).trim() : '', phoneNumber: String(d.phoneNumber || '') };
  });
  const map = new Map<string, any[]>();
  all.forEach(p => {
    let key = '';
    if (criteria === 'expediente') key = p.expediente;
    else if (criteria === 'curp') key = (p.curp && !p.curp.startsWith('RN-')) ? p.curp : '';
    else key = `${p.name} ${p.paternalLastName} ${p.maternalLastName}`.trim();
    if (key && key !== 'N/A' && key !== '') {
      const group = map.get(key) || [];
      group.push(p);
      map.set(key, group);
    }
  });
  return Array.from(map.values()).filter(g => g.length > 1).slice(0, 300);
}

export async function bulkUpdateStatusChunk(expedientes: string[], status: PatientStatus) {
  const db = getDb();
  if (!expedientes || expedientes.length === 0) return { success: true, count: 0 };
  
  const allSnap = await getDocs(query(collection(db, 'patients'), limit(10000)));
  const allPatients = allSnap.docs;
  
  const cleanExpedientes = expedientes.map(e => e.toString().trim().replace(/^0+/, ''));
  const matches = allPatients.filter(doc => {
    const exp = (doc.data().expediente || '').toString().trim().replace(/^0+/, '');
    return cleanExpedientes.includes(exp);
  });

  if (matches.length > 0) {
    const updateChunks = chunkArray(matches, 500);
    for (const chunk of updateChunks) {
      const batch = writeBatch(db);
      chunk.forEach(d => batch.update(d.ref, { status, updatedAt: Timestamp.now() }));
      await batch.commit();
    }
    await logActivity("Actualización Masiva", `Se actualizaron ${matches.length} registros a ${status}`);
  }
  
  return { success: true, count: matches.length };
}

// =====================================================================
// DATA MANAGEMENT
// =====================================================================

export async function createBackupData() {
  const db = getDb();
  const collections = ['patients', 'appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments', 'clinics'];
  const data: any = {};
  for (const col of collections) {
    const snap = await getDocs(collection(db, col));
    data[col] = snap.docs.map(d => serializeData({ id: d.id, ...d.data() }));
  }
  return data;
}

export async function cleanupOldRecords() {
  const db = getDb();
  const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
  const cutoff = Timestamp.fromDate(lastMonth);
  const collections = ['appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments'];
  let total = 0;
  for (const col of collections) {
    const q = query(collection(db, col), where('date', '<', cutoff));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(d => { batch.delete(d.ref); total++; });
        await batch.commit();
    }
  }
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
      const patientData = { expediente: raw['No.Expediente'] ? String(raw['No.Expediente']).trim() : null, name: String(raw.Nombre || '').toUpperCase().trim(), paternalLastName: String(raw.Apaterno || '').toUpperCase().trim(), maternalLastName: String(raw.Amaterno || '').toUpperCase().trim(), birthDate: raw.FNacimiento ? String(raw.FNacimiento) : null, age: Number(raw.Edad) || 0, sex: String(raw.Sexo).startsWith('M') ? 'Mujer' : 'Hombre', birthState: String(raw.Estado || 'TABASCO').toUpperCase().trim(), address: String(raw.Domicilio || '').toUpperCase().trim(), coloniaName: String(raw.Colonia || '').toUpperCase().trim(), fatherName: String(raw.NombrePadre || '').toUpperCase().trim(), motherName: String(raw.NombreMadre || '').toUpperCase().trim(), fatherAge: Number(raw.EdadPadre) || null, motherAge: Number(raw.EdadMadre) || null, registrationDate: raw.FechaApertura ? String(raw.FechaApertura) : null, status: raw.Estatus || PatientStatusEnum.Vigente, derechoAbiencia: String(raw.DerechoAbiencia || '').toUpperCase().trim(), phoneNumber: String(raw.Telefono || '').trim(), curp, updatedAt: Timestamp.now() };
      const existing = await getPatientByCURP(curp);
      if (existing) { batch.update(doc(db, 'patients', existing.id), patientData); updated++; }
      else { const newId = uuidv4(); batch.set(doc(db, 'patients', newId), { ...patientData, id: newId }); added++; }
    }
    await batch.commit();
    return { success: true, addedCount: added, updatedCount: updated, processedCount: chunk.length };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function getAvailableSlotsForDate(clinicId: string, dateIso: string) {
  const clinic = await getClinicById(clinicId);
  if (!clinic) return {};
  const db = getDb();
  const dateOnly = dateIso.split('T')[0];
  const q = query(collection(db, 'appointments'), where('clinicId', '==', clinicId));
  const snap = await getDocs(q);
  const taken = snap.docs.map(d => d.data()).filter(a => serializeData(a.date).split('T')[0] === dateOnly).map(a => a.time);
  if (clinic.bookingMode === BookingMode.Time) {
    const slots = []; let curr = new Date(`1970-01-01T${clinic.startTime}:00`); const end = new Date(`1970-01-01T${clinic.endTime}:00`); const duration = clinic.consultationDuration || 30;
    while (curr < end) { const t = curr.toTimeString().substring(0, 5); if (!taken.includes(t) && t !== clinic.breakTime) slots.push(t); curr = new Date(curr.getTime() + duration * 60000); }
    return { timeSlots: slots };
  } else {
    const tokens = Array.from({ length: clinic.dailySlots }, (_, i) => i + 1).filter(t => !taken.map(tk => parseInt(tk.replace('Ficha ', ''))).includes(t));
    return { tokens };
  }
}

export async function rescheduleAppointment(id: string, newDate: string, type: string) {
  const db = getDb();
  try {
    const collMap: Record<string, string> = { 'medical': 'appointments', 'lab': 'labAppointments', 'xray': 'xrayAppointments', 'ultrasound': 'ultrasoundAppointments', 'vaccine': 'vaccineAppointments' };
    await updateDoc(doc(db, collMap[type] || 'appointments', id), { date: Timestamp.fromDate(new Date(newDate)) });
    return { success: true, message: 'Fecha actualizada correctamente' };
  } catch (e: any) { return { success: false, message: e.message }; }
}

export async function cloneAppointment(originalId: string, newDate: string, type: string, newTime?: string) {
  const db = getDb();
  try {
    const collMap: Record<string, string> = { 'medical': 'appointments', 'lab': 'labAppointments', 'xray': 'xrayAppointments', 'ultrasound': 'ultrasoundAppointments', 'vaccine': 'vaccineAppointments' };
    const collectionName = collMap[type] || 'appointments';
    const originalDoc = await getDoc(doc(db, collectionName, originalId));
    if (!originalDoc.exists()) return { success: false, message: 'Cita original no encontrada' };
    const data = originalDoc.data();
    const newRef = doc(collection(db, collectionName));
    const newFolio = `${data.appointmentNumber.split('-')[0]}-${uuidv4().split('-')[0].toUpperCase()}`;
    const newAppData = { ...data, date: Timestamp.fromDate(new Date(newDate)), appointmentNumber: newFolio, status: 'Agendada' };
    if (newTime) newAppData.time = newTime;
    await setDoc(newRef, newAppData);
    return { success: true, message: `Nueva cita asignada con folio: ${newFolio}` };
  } catch (e: any) { return { success: false, message: e.message }; }
}
