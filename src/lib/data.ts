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
  CollectionReference,
  DocumentData,
  addDoc
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
// UTILS
// =====================================================================

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function getSettingsDoc<T>(docId: string, defaultVal: T): Promise<T> {
  if (!adminDb) return defaultVal;
  const docRef = doc(adminDb, 'settings', docId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as T) : defaultVal;
}

async function setSettingsDoc(docId: string, data: any) {
  if (!adminDb) return { success: false };
  await setDoc(doc(adminDb, 'settings', docId), data, { merge: true });
  return { success: true };
}

// =====================================================================
// PATIENTS
// =====================================================================

export async function getPatientByCURP(curp: string): Promise<Patient | null> {
  if (!adminDb || !curp) return null;
  const q = query(collection(adminDb, 'patients'), where('curp', '==', curp.toUpperCase().trim()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Patient;
}

export async function getPatients(options?: { searchTerm?: string }): Promise<Patient[]> {
  if (!adminDb) return [];
  const q = query(collection(adminDb, 'patients'), orderBy('paternalLastName'), limit(1000));
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Patient));
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

export async function updatePatient(id: string, data: Partial<Omit<Patient, 'id'>>) {
  if (!adminDb) return { success: false };
  await updateDoc(doc(adminDb, 'patients', id), data);
  return { success: true };
}

export async function deletePatient(id: string) {
  if (!adminDb) return { success: false };
  await deleteDoc(doc(adminDb, 'patients', id));
  return { success: true };
}

export async function deletePatients(ids: string[]) {
  if (!adminDb || ids.length === 0) return { success: true };
  const chunks = chunkArray(ids, 500);
  for (const chunk of chunks) {
    const batch = writeBatch(adminDb);
    chunk.forEach(id => batch.delete(doc(adminDb, 'patients', id)));
    await batch.commit();
  }
  return { success: true };
}

export async function updatePatientStatus(id: string, status: PatientStatus) {
  if (!adminDb) return { success: false };
  await updateDoc(doc(adminDb, 'patients', id), { status });
  return { success: true };
}

// =====================================================================
// APPOINTMENTS (ENRICHED)
// =====================================================================

async function enrichWithPatientData(apps: any[]): Promise<any[]> {
  if (!adminDb || apps.length === 0) return apps;
  
  const patientIds = Array.from(new Set(apps.map(a => a.patientId).filter(id => id && typeof id === 'string')));
  if (patientIds.length === 0) return apps;

  const patientsMap: Record<string, Patient> = {};
  const chunks = chunkArray(patientIds, 10); // Lotes de 10 para seguridad total en IN

  for (const batch of chunks) {
    const q = query(collection(adminDb, 'patients'), where(documentId(), 'in', batch));
    const snap = await getDocs(q);
    snap.forEach(d => {
      patientsMap[d.id] = { id: d.id, ...d.data() } as Patient;
    });
  }

  return apps.map(app => ({
    ...app,
    patient: patientsMap[app.patientId] || null,
    date: app.date instanceof Timestamp ? app.date.toDate().toISOString() : app.date
  }));
}

export async function getAppointments(): Promise<Appointment[]> {
  if (!adminDb) return [];
  const q = query(collection(adminDb, 'appointments'), orderBy('date', 'desc'), limit(500));
  const snap = await getDocs(q);
  return enrichWithPatientData(snap.docs.map(d => ({ id: d.id, ...d.data() }))) as Promise<Appointment[]>;
}

export async function getAppointmentsForClinic(clinicId: string): Promise<Appointment[]> {
  if (!adminDb) return [];
  const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId), orderBy('date', 'desc'), limit(500));
  const snap = await getDocs(q);
  return enrichWithPatientData(snap.docs.map(d => ({ id: d.id, ...d.data() }))) as Promise<Appointment[]>;
}

export async function getLabAppointments(): Promise<LabAppointment[]> {
  if (!adminDb) return [];
  const q = query(collection(adminDb, 'labAppointments'), orderBy('date', 'desc'), limit(500));
  const snap = await getDocs(q);
  return enrichWithPatientData(snap.docs.map(d => ({ id: d.id, ...d.data() }))) as Promise<LabAppointment[]>;
}

export async function getXRayAppointments(): Promise<XRayAppointment[]> {
  if (!adminDb) return [];
  const q = query(collection(adminDb, 'xrayAppointments'), orderBy('date', 'desc'), limit(500));
  const snap = await getDocs(q);
  return enrichWithPatientData(snap.docs.map(d => ({ id: d.id, ...d.data() }))) as Promise<XRayAppointment[]>;
}

export async function getUltrasoundAppointments(): Promise<UltrasoundAppointment[]> {
  if (!adminDb) return [];
  const q = query(collection(adminDb, 'ultrasoundAppointments'), orderBy('date', 'desc'), limit(500));
  const snap = await getDocs(q);
  return enrichWithPatientData(snap.docs.map(d => ({ id: d.id, ...d.data() }))) as Promise<UltrasoundAppointment[]>;
}

export async function getVaccineAppointments(): Promise<VaccineAppointment[]> {
  if (!adminDb) return [];
  const q = query(collection(adminDb, 'vaccineAppointments'), orderBy('date', 'desc'), limit(500));
  const snap = await getDocs(q);
  return enrichWithPatientData(snap.docs.map(d => ({ id: d.id, ...d.data() }))) as Promise<VaccineAppointment[]>;
}

// =====================================================================
// SAVE APPOINTMENTS
// =====================================================================

export async function saveAppointment(appointment: any, patientData: any, coloniaName?: string) {
  if (!adminDb) return { success: false };
  const batch = writeBatch(adminDb);
  
  let patientId = '';
  const existing = await getPatientByCURP(patientData.curp);
  if (existing) {
    patientId = existing.id;
    batch.update(doc(adminDb, 'patients', patientId), patientData);
  } else {
    patientId = uuidv4();
    batch.set(doc(adminDb, 'patients', patientId), patientData);
  }

  const appRef = doc(collection(adminDb, 'appointments'));
  const appointmentNumber = `FOLIO-${uuidv4().split('-')[0].toUpperCase()}`;
  const finalApp = {
    ...appointment,
    patientId,
    appointmentNumber,
    coloniaName: coloniaName || null,
    date: Timestamp.fromDate(new Date(appointment.date))
  };
  
  batch.set(appRef, finalApp);
  await batch.commit();

  const clinic = await getClinicById(appointment.clinicId);
  return { success: true, data: { appointment: { ...finalApp, id: appRef.id, date: appointment.date, patient: { ...patientData, id: patientId } }, clinic } };
}

export async function saveLabAppointment(appointment: any, patientData: any) {
  if (!adminDb) return { success: false };
  const patient = await getPatientByCURP(patientData.curp);
  const patientId = patient ? patient.id : uuidv4();
  await setDoc(doc(adminDb, 'patients', patientId), patientData, { merge: true });
  
  const appRef = doc(collection(adminDb, 'labAppointments'));
  const finalApp = {
    ...appointment,
    patientId,
    date: Timestamp.fromDate(new Date(appointment.date))
  };
  await setDoc(appRef, finalApp);
  return { success: true, data: { ...finalApp, id: appRef.id, date: appointment.date, patient: { ...patientData, id: patientId } } };
}

export async function saveNewXRayAppointment(appointment: any, patientData: any) {
  if (!adminDb) return { success: false };
  const patient = await getPatientByCURP(patientData.curp);
  const patientId = patient ? patient.id : uuidv4();
  await setDoc(doc(adminDb, 'patients', patientId), patientData, { merge: true });
  
  const appRef = doc(collection(adminDb, 'xrayAppointments'));
  const finalApp = {
    ...appointment,
    patientId,
    date: Timestamp.fromDate(new Date(appointment.date)),
    status: 'Agendada'
  };
  await setDoc(appRef, finalApp);
  return { success: true, data: { appointment: { ...finalApp, id: appRef.id, date: appointment.date, patient: { ...patientData, id: patientId } }, study: { name: appointment.studyName, indications: '' } } };
}

export async function saveNewUltrasoundAppointment(appointment: any, patientData: any) {
  if (!adminDb) return { success: false };
  const patient = await getPatientByCURP(patientData.curp);
  const patientId = patient ? patient.id : uuidv4();
  await setDoc(doc(adminDb, 'patients', patientId), patientData, { merge: true });
  
  const appRef = doc(collection(adminDb, 'ultrasoundAppointments'));
  const finalApp = {
    ...appointment,
    patientId,
    date: Timestamp.fromDate(new Date(appointment.date)),
    status: 'Agendada'
  };
  await setDoc(appRef, finalApp);
  return { success: true, data: { appointment: { ...finalApp, id: appRef.id, date: appointment.date, patient: { ...patientData, id: patientId } }, study: { name: appointment.studyName, indications: '' } } };
}

export async function saveNewVaccineAppointment(appointment: any, patientData: any) {
  if (!adminDb) return { success: false };
  const patient = await getPatientByCURP(patientData.curp);
  const patientId = patient ? patient.id : uuidv4();
  await setDoc(doc(adminDb, 'patients', patientId), patientData, { merge: true });
  
  const appRef = doc(collection(adminDb, 'vaccineAppointments'));
  const finalApp = {
    ...appointment,
    patientId,
    date: Timestamp.fromDate(new Date(appointment.date))
  };
  await setDoc(appRef, finalApp);
  return { success: true, data: { ...finalApp, id: appRef.id, date: appointment.date, patient: { ...patientData, id: patientId } } };
}

// =====================================================================
// DELETE APPOINTMENTS
// =====================================================================

export async function deleteAppointment(id: string) { if (!adminDb) return ''; await deleteDoc(doc(adminDb, 'appointments', id)); return id; }
export async function deleteLabAppointment(id: string) { if (!adminDb) return ''; await deleteDoc(doc(adminDb, 'labAppointments', id)); return id; }
export async function deleteXRayAppointment(id: string) { if (!adminDb) return ''; await deleteDoc(doc(adminDb, 'xrayAppointments', id)); return id; }
export async function deleteUltrasoundAppointment(id: string) { if (!adminDb) return ''; await deleteDoc(doc(adminDb, 'ultrasoundAppointments', id)); return id; }
export async function deleteVaccineAppointment(id: string) { if (!adminDb) return ''; await deleteDoc(doc(adminDb, 'vaccineAppointments', id)); return id; }

export async function updateAppointmentStatus(id: string, status: AppointmentStatus, type: string) {
  if (!adminDb) return { success: false };
  const collMap: Record<string, string> = { 'medical': 'appointments', 'lab': 'labAppointments', 'xray': 'xrayAppointments', 'ultrasound': 'ultrasoundAppointments', 'vaccine': 'vaccineAppointments' };
  const collectionName = collMap[type] || 'appointments';
  await updateDoc(doc(adminDb, collectionName, id), { status });
  return { success: true };
}

// =====================================================================
// SETTINGS & CONFIG
// =====================================================================

export async function getClinics(): Promise<Clinic[]> {
  if (!adminDb) return [];
  const snap = await getDocs(collection(adminDb, 'clinics'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Clinic));
}

export async function getClinicById(id: string): Promise<Clinic | null> {
  if (!adminDb) return null;
  const d = await getDoc(doc(adminDb, 'clinics', id));
  return d.exists() ? ({ id: d.id, ...d.data() } as Clinic) : null;
}

export async function updateClinics(clinics: Clinic[]) {
  if (!adminDb) return { success: false };
  const batch = writeBatch(adminDb);
  clinics.forEach(c => batch.set(doc(adminDb, 'clinics', c.id), c));
  await batch.commit();
  return { success: true };
}

export async function getColonias(): Promise<Colonia[]> {
  if (!adminDb) return [];
  const snap = await getDocs(collection(adminDb, 'colonias'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Colonia));
}

export async function updateColonias(colonias: Colonia[]) {
  if (!adminDb) return { success: false };
  const snap = await getDocs(collection(adminDb, 'colonias'));
  const batch = writeBatch(adminDb);
  snap.docs.forEach(d => batch.delete(d.ref));
  colonias.forEach(c => batch.set(doc(adminDb, 'colonias', c.id || uuidv4()), c));
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
  if (!adminDb) return [];
  const snap = await getDocs(collection(adminDb, 'labStudies'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LabStudy));
}
export async function updateLabStudies(studies: LabStudy[]) {
  if (!adminDb) return { success: false };
  const snap = await getDocs(collection(adminDb, 'labStudies'));
  const batch = writeBatch(adminDb);
  snap.docs.forEach(d => batch.delete(d.ref));
  studies.forEach(s => batch.set(doc(adminDb, 'labStudies', s.id || uuidv4()), s));
  await batch.commit();
  return { success: true };
}

export async function getXRaySettings() { return getSettingsDoc<XRaySettings>('xraySettings', { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false }); }
export async function updateXRaySettings(s: XRaySettings) { return setSettingsDoc('xraySettings', s); }

export async function getXRayStudies() {
  if (!adminDb) return [];
  const snap = await getDocs(collection(adminDb, 'xrayStudies'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as XRayStudy));
}
export async function updateXRayStudies(studies: XRayStudy[]) {
  if (!adminDb) return { success: false };
  const snap = await getDocs(collection(adminDb, 'xrayStudies'));
  const batch = writeBatch(adminDb);
  snap.docs.forEach(d => batch.delete(d.ref));
  studies.forEach(s => batch.set(doc(adminDb, 'xrayStudies', s.id || uuidv4()), s));
  await batch.commit();
  return { success: true };
}

export async function getUltrasoundSettings() { return getSettingsDoc<UltrasoundSettings>('ultrasoundSettings', { dailySlots: 10, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false }); }
export async function updateUltrasoundSettings(s: UltrasoundSettings) { return setSettingsDoc('ultrasoundSettings', s); }

export async function getUltrasoundStudies() {
  if (!adminDb) return [];
  const snap = await getDocs(collection(adminDb, 'ultrasoundStudies'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as UltrasoundStudy));
}
export async function updateUltrasoundStudies(studies: UltrasoundStudy[]) {
  if (!adminDb) return { success: false };
  const snap = await getDocs(collection(adminDb, 'ultrasoundStudies'));
  const batch = writeBatch(adminDb);
  snap.docs.forEach(d => batch.delete(d.ref));
  studies.forEach(s => batch.set(doc(adminDb, 'ultrasoundStudies', s.id || uuidv4()), s));
  await batch.commit();
  return { success: true };
}

export async function getVaccineSettings() { return getSettingsDoc<VaccineSettings>('vaccineSettings', { dailySlots: 20, startTime: '08:00', endTime: '13:00', weekendBookingEnabled: false }); }
export async function updateVaccineSettings(s: VaccineSettings) { return setSettingsDoc('vaccineSettings', s); }

export async function getVaccines() {
  if (!adminDb) return [];
  const snap = await getDocs(collection(adminDb, 'vaccines'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Vaccine));
}
export async function updateVaccines(vaccines: Vaccine[]) {
  if (!adminDb) return { success: false };
  const snap = await getDocs(collection(adminDb, 'vaccines'));
  const batch = writeBatch(adminDb);
  snap.docs.forEach(d => batch.delete(d.ref));
  vaccines.forEach(v => batch.set(doc(adminDb, 'vaccines', v.id || uuidv4()), v));
  await batch.commit();
  return { success: true };
}

export async function getUsers(): Promise<User[]> {
  if (!adminDb) return [];
  const snap = await getDocs(collection(adminDb, 'users'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
}
export async function updateUsers(users: User[]) {
  if (!adminDb) return { success: false };
  const batch = writeBatch(adminDb);
  users.forEach(u => batch.set(doc(adminDb, 'users', u.id), u));
  await batch.commit();
  return { success: true };
}

export async function getArchiveSettings() { return getSettingsDoc<ArchiveSettings>('archiveSettings', { password: '' }); }
export async function updateArchiveSettings(s: ArchiveSettings) { return setSettingsDoc('archiveSettings', s); }

// =====================================================================
// AUTH & LOGS
// =====================================================================

export async function verifyArchivePassword(p: string) { const s = await getArchiveSettings(); return { success: s.password === p }; }
export async function verifyClinicPassword(id: string, p: string) { const c = await getClinicById(id); return { success: c?.password === p }; }
export async function verifyLabPassword(p: string) { const s = await getLabSettings(); return { success: s.password === p }; }
export async function verifyXRayPassword(p: string) { const s = await getXRaySettings(); return { success: s.password === p }; }
export async function verifyUltrasoundPassword(p: string) { const s = await getUltrasoundSettings(); return { success: s.password === p }; }
export async function verifyVaccinePassword(p: string) { const s = await getVaccineSettings(); return { success: s.password === p }; }

export async function getLogs(): Promise<ActivityLog[]> {
  if (!adminDb) return [];
  const snap = await getDocs(query(collection(adminDb, 'activityLog'), orderBy('timestamp', 'desc'), limit(500)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
}
export async function logActivity(action: string, details: string) {
  if (!adminDb) return;
  await addDoc(collection(adminDb, 'activityLog'), { action, details, timestamp: Timestamp.now() });
}

// =====================================================================
// MAINTENANCE
// =====================================================================

export async function findDuplicatesByCriteria(criteria: 'expediente' | 'curp' | 'name'): Promise<Patient[][]> {
  if (!adminDb) return [];
  const snap = await getDocs(query(collection(adminDb, 'patients'), limit(5000)));
  const all = snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      name: String(d.name || '').toUpperCase().trim(),
      paternalLastName: String(d.paternalLastName || '').toUpperCase().trim(),
      maternalLastName: String(d.maternalLastName || '').toUpperCase().trim(),
      curp: String(d.curp || '').toUpperCase().trim(),
      expediente: d.expediente ? String(d.expediente).trim() : '',
      phoneNumber: String(d.phoneNumber || '')
    };
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
  if (!adminDb || expedientes.length === 0) return { success: true, count: 0 };
  const cleanExpedientes = Array.from(new Set(expedientes.filter(e => e && typeof e === 'string')));
  
  const chunks = chunkArray(cleanExpedientes, 10); // Batch de 10 para IN
  let totalUpdated = 0;

  for (const expBatch of chunks) {
    const q = query(collection(adminDb, 'patients'), where('expediente', 'in', expBatch));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(adminDb);
      snap.docs.forEach(d => {
        batch.update(d.ref, { status });
        totalUpdated++;
      });
      await batch.commit();
    }
  }
  return { success: true, count: totalUpdated };
}

export async function autoCleanupDuplicatePatients() { return { success: true }; }

// =====================================================================
// BACKUP & CLEANUP
// =====================================================================

export async function createBackupData() {
  if (!adminDb) return null;
  const collections = ['patients', 'appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments', 'clinics'];
  const data: any = {};
  for (const col of collections) {
    const snap = await getDocs(collection(adminDb, col));
    data[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  return data;
}

export async function cleanupOldRecords() {
  if (!adminDb) return { success: false, deletedCount: 0 };
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const cutoff = Timestamp.fromDate(lastMonth);

  const collections = ['appointments', 'labAppointments', 'xrayAppointments', 'ultrasoundAppointments', 'vaccineAppointments'];
  let total = 0;

  for (const col of collections) {
    const q = query(collection(adminDb, col), where('date', '<', cutoff));
    const snap = await getDocs(q);
    const batch = writeBatch(adminDb);
    snap.docs.forEach(d => { batch.delete(d.ref); total++; });
    await batch.commit();
  }
  return { success: true, deletedCount: total };
}

export async function bulkInsertPatients(chunk: any[]) {
  if (!adminDb) return { success: false };
  const batch = writeBatch(adminDb);
  let added = 0, updated = 0;

  for (const raw of chunk) {
    if (!raw.CURP) continue;
    const curp = String(raw.CURP).toUpperCase().trim();
    const patientData = {
      expediente: raw['No.Expediente'] ? String(raw['No.Expediente']) : null,
      name: String(raw.Nombre || '').toUpperCase(),
      paternalLastName: String(raw.Apaterno || '').toUpperCase(),
      maternalLastName: String(raw.Amaterno || '').toUpperCase(),
      birthDate: raw.FNacimiento ? String(raw.FNacimiento) : null,
      age: Number(raw.Edad) || 0,
      sex: String(raw.Sexo).startsWith('M') ? 'Mujer' : 'Hombre',
      birthState: String(raw.Estado || 'TABASCO').toUpperCase(),
      address: String(raw.Domicilio || '').toUpperCase(),
      coloniaName: String(raw.Colonia || '').toUpperCase(),
      fatherName: String(raw.NombrePadre || '').toUpperCase(),
      motherName: String(raw.NombreMadre || '').toUpperCase(),
      fatherAge: Number(raw.EdadPadre) || null,
      motherAge: Number(raw.EdadMadre) || null,
      registrationDate: raw.FechaApertura ? String(raw.FechaApertura) : null,
      status: raw.Estatus || PatientStatusEnum.Vigente,
      derechoAbiencia: String(raw.DerechoAbiencia || '').toUpperCase(),
      phoneNumber: String(raw.Telefono || ''),
      curp
    };

    const existing = await getPatientByCURP(curp);
    if (existing) {
      batch.update(doc(adminDb, 'patients', existing.id), patientData);
      updated++;
    } else {
      batch.set(doc(adminDb, 'patients', uuidv4()), patientData);
      added++;
    }
  }
  await batch.commit();
  return { success: true, addedCount: added, updatedCount: updated, processedCount: chunk.length };
}

export async function getAvailableSlotsForDate(clinicId: string, dateIso: string) {
  const clinic = await getClinicById(clinicId);
  if (!clinic) return {};
  
  const dateOnly = dateIso.split('T')[0];
  const q = query(collection(adminDb, 'appointments'), where('clinicId', '==', clinicId));
  const snap = await getDocs(q);
  
  const taken = snap.docs
    .map(d => d.data())
    .filter(a => {
      const d = a.date instanceof Timestamp ? a.date.toDate().toISOString() : String(a.date);
      return d.split('T')[0] === dateOnly;
    })
    .map(a => a.time);

  if (clinic.bookingMode === BookingMode.Time) {
    const slots = [];
    let curr = new Date(`1970-01-01T${clinic.startTime}:00`);
    const end = new Date(`1970-01-01T${clinic.endTime}:00`);
    const duration = clinic.consultationDuration || 30;
    
    while (curr < end) {
      const t = curr.toTimeString().substring(0, 5);
      if (!taken.includes(t) && t !== clinic.breakTime) slots.push(t);
      curr = new Date(curr.getTime() + duration * 60000);
    }
    return { timeSlots: slots };
  } else {
    const total = clinic.dailySlots;
    const takenTokens = taken.map(t => parseInt(t.replace('Ficha ', ''))).filter(Boolean);
    const tokens = Array.from({ length: total }, (_, i) => i + 1).filter(t => !takenTokens.includes(t));
    return { tokens };
  }
}

export async function rescheduleAppointment(id: string, newDate: string, type: string) {
  if (!adminDb) return { success: false };
  const collMap: Record<string, string> = { 'medical': 'appointments', 'lab': 'labAppointments', 'xray': 'xrayAppointments', 'ultrasound': 'ultrasoundAppointments', 'vaccine': 'vaccineAppointments' };
  const collectionName = collMap[type] || 'appointments';
  await updateDoc(doc(adminDb, collectionName, id), { date: Timestamp.fromDate(new Date(newDate)) });
  return { success: true, message: 'Fecha actualizada correctamente' };
}

export async function cloneAppointment(originalId: string, newDate: string, type: string, newTime?: string) {
  if (!adminDb) return { success: false };
  const collMap: Record<string, string> = { 'medical': 'appointments', 'lab': 'labAppointments', 'xray': 'xrayAppointments', 'ultrasound': 'ultrasoundAppointments', 'vaccine': 'vaccineAppointments' };
  const collectionName = collMap[type] || 'appointments';
  
  const originalDoc = await getDoc(doc(adminDb, collectionName, originalId));
  if (!originalDoc.exists()) return { success: false, message: 'Cita original no encontrada' };
  
  const data = originalDoc.data();
  const newRef = doc(collection(adminDb, collectionName));
  const newFolio = `${data.appointmentNumber.split('-')[0]}-${uuidv4().split('-')[0].toUpperCase()}`;
  
  const newAppData = {
    ...data,
    date: Timestamp.fromDate(new Date(newDate)),
    appointmentNumber: newFolio,
    status: 'Agendada'
  };
  if (newTime) newAppData.time = newTime;
  
  await setDoc(newRef, newAppData);
  return { success: true, message: `Nueva cita asignada con folio: ${newFolio}` };
}
